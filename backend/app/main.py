from contextlib import asynccontextmanager
from dataclasses import asdict
from pathlib import Path
from threading import Lock
from time import perf_counter

from alembic import command
from alembic.config import Config
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .catalog import CATEGORIES, REGIONS, edit_supplier, import_supplier, query_catalog, selected, serialize
from .config import settings
from .db import SessionLocal, engine, get_db
from .demo import seed_demo
from .exporter import export_file
from .models import Supplier
from .providers import UnconfiguredProvider
from .schemas import Collection, ExportRequest, Filters, SearchRequest, Selection, SupplierInput
from .scoring import information_score, review_status


def migrate(target_engine):
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    with target_engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")


def create_app(initialize=True, serve_frontend=True):
    @asynccontextmanager
    async def lifespan(app):
        if initialize:
            migrate(engine)
            if settings.seed_demo:
                with SessionLocal() as session:
                    seed_demo(session)
        yield

    app = FastAPI(title="Food Supplier Finder", version="0.1.0", lifespan=lifespan)
    import_lock = Lock()

    @app.middleware("http")
    async def protect(request: Request, call_next):
        # This unauthenticated prototype is intended for loopback/private demo use.
        # Block cross-origin browser writes; production serves the UI from this same origin.
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            origin = request.headers.get("origin")
            if origin and origin != str(request.base_url).rstrip("/"):
                return JSONResponse(
                    {"error": {"code": "origin_rejected", "message": "Запрос с другого сайта запрещён"}}, 403
                )
            if int(request.headers.get("content-length", "0")) > 1_000_000:
                return JSONResponse({"error": {"code": "too_large", "message": "Запрос слишком большой"}}, 413)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        if request.url.path.startswith("/api"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(HTTPException)
    async def http_error(request, exc):
        return JSONResponse({"error": {"code": f"http_{exc.status_code}", "message": str(exc.detail)}}, exc.status_code)

    @app.exception_handler(RequestValidationError)
    @app.exception_handler(ValidationError)
    async def invalid(request, exc):
        messages = [f"{'.'.join(map(str, error['loc'][1:]))}: {error['msg']}" for error in exc.errors()]
        return JSONResponse(
            {"error": {"code": "validation", "message": "Проверьте введённые данные", "details": messages}}, 422
        )

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request, exc):
        # No request payloads, personal notes or database connection strings in responses/logs.
        return JSONResponse(
            {"error": {"code": "database", "message": "База данных недоступна. Повторите попытку."}}, 503
        )

    @app.get("/api/v1/health")
    def health(db: Session = Depends(get_db)):
        db.execute(select(1))
        return {"status": "ok", "ai": "disabled", "external_search": "not_configured", "paid_requests": False}

    @app.get("/api/v1/meta")
    def meta(db: Session = Depends(get_db)):
        counts = {
            bool(demo): count
            for demo, count in db.execute(select(Supplier.is_demo, func.count()).group_by(Supplier.is_demo))
        }
        return {
            "categories": CATEGORIES,
            "regions": sorted(
                set(REGIONS) | set(db.scalars(select(Supplier.city).where(Supplier.city.is_not(None))).all())
            ),
            "counts": {"real": counts.get(False, 0), "demo": counts.get(True, 0)},
            "external_search": "not_configured",
            "ai": "disabled",
            "stale_days": settings.stale_days,
        }

    @app.get("/api/v1/categories")
    def categories():
        return CATEGORIES

    @app.get("/api/v1/overview")
    def overview(mode: str = Query("real", pattern="^(real|demo)$"), db: Session = Depends(get_db)):
        suppliers = db.scalars(select(Supplier).where(Supplier.is_demo == (mode == "demo"))).all()
        source_map = {}
        for supplier in suppliers:
            for source in supplier.sources:
                url = source["url"]
                entry = source_map.setdefault(
                    url,
                    {
                        "url": url,
                        "name": source["name"],
                        "type": source["type"],
                        "retrieved_at": source["retrieved_at"],
                        "checked_at": source.get("checked_at"),
                        "supplier_ids": set(),
                    },
                )
                entry["supplier_ids"].add(supplier.id)
                entry["retrieved_at"] = max(entry["retrieved_at"], source["retrieved_at"])
                if source.get("checked_at"):
                    entry["checked_at"] = max(entry["checked_at"] or "", source["checked_at"])
        sources = [{**entry, "supplier_count": len(entry["supplier_ids"])} for entry in source_map.values()]
        for entry in sources:
            del entry["supplier_ids"]
        return {
            "total": len(suppliers),
            "with_contacts": sum(bool(s.contacts) for s in suppliers),
            "with_terms": sum(
                any(t.get("price") is not None or t.get("min_order") is not None for t in s.terms) for s in suppliers
            ),
            "needs_review": sum(review_status(s) == "needs_review" for s in suppliers),
            "unverified": sum(review_status(s) == "unverified" for s in suppliers),
            "average_rating": round(sum(information_score(s)["value"] for s in suppliers) / len(suppliers))
            if suppliers
            else None,
            "categories": {
                category["id"]: sum(category["id"] in s.categories for s in suppliers) for category in CATEGORIES
            },
            "sources": sources,
        }

    @app.get("/api/v1/suppliers")
    def list_suppliers(
        filters: Filters = Depends(),
        page: int = Query(1, ge=1),
        page_size: int = Query(12, ge=1, le=100),
        db: Session = Depends(get_db),
    ):
        return query_catalog(db, filters, page, page_size)

    @app.post("/api/v1/collection")
    def collection(body: Collection, db: Session = Depends(get_db)):
        return query_catalog(db, body.filters, body.page, body.page_size, ids=body.ids)

    @app.post("/api/v1/search")
    def search(body: SearchRequest, db: Session = Depends(get_db)):
        if not any([body.filters.q.strip(), body.filters.category, body.filters.region, body.filters.delivery_region]):
            raise HTTPException(
                422, "Введите товар, выберите категорию или регион. Для просмотра всех записей откройте каталог."
            )
        start = perf_counter()
        result = query_catalog(db, body.filters)
        external = (
            asdict(UnconfiguredProvider().search(body.filters.q, body.filters.region))
            if body.external
            else {"status": "not_requested", "message": None}
        )
        return {
            **result,
            "status": "partial" if body.external else "completed",
            "external": external,
            "duration_ms": round((perf_counter() - start) * 1000),
            "ai": "disabled",
        }

    @app.post("/api/v1/suppliers/import", status_code=201)
    def import_record(body: SupplierInput, db: Session = Depends(get_db)):
        with import_lock:
            return import_supplier(db, body)

    @app.post("/api/v1/compare")
    def compare(body: Selection, db: Session = Depends(get_db)):
        return {
            "items": [serialize(item, body.filters) for item in selected(db, body.ids, body.mode)],
            "notice": "Сравнивайте цены только на одинаковые товары, единицы, фасовку и объём. Готовность отгрузить товар уточняйте у поставщика.",
        }

    @app.patch("/api/v1/suppliers/{supplier_id}")
    def edit_record(supplier_id: str, body: SupplierInput, db: Session = Depends(get_db)):
        with import_lock:
            return edit_supplier(db, supplier_id, body)

    @app.post("/api/v1/export")
    def export(body: ExportRequest, db: Session = Depends(get_db)):
        if body.ids:
            suppliers = selected(db, body.ids, body.filters.mode)
        else:
            result = query_catalog(db, body.filters, page_size=10001)
            if result["total"] > 10000:
                raise HTTPException(422, "В выгрузке максимум 10 000 записей. Уточните фильтры.")
            suppliers = selected(db, [item["id"] for item in result["items"]], body.filters.mode)
        data, media_type = export_file(
            suppliers, body.format, body.notes if body.include_notes else {}, body.include_notes
        )
        prefix = "demo-suppliers" if body.filters.mode == "demo" else "suppliers"
        return Response(
            data,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{prefix}.{body.format}"'},
        )

    @app.get("/api/v1/suppliers/{supplier_id}")
    def detail(supplier_id: str, mode: str = Query("real", pattern="^(real|demo)$"), db: Session = Depends(get_db)):
        return serialize(selected(db, [supplier_id], mode)[0])

    frontend = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    if serve_frontend and (frontend / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=frontend / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str):
            if path.startswith("api/"):
                raise HTTPException(404, "Маршрут не найден")
            return FileResponse(frontend / "index.html")

    return app


app = create_app()
