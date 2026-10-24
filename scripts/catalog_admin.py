"""Operator tools: list records and amend a supplied fact with a new source. No web requests."""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from sqlalchemy import select

from app.catalog import import_supplier
from app.catalog import update_index
from app.db import SessionLocal
from app.models import Supplier, utcnow
from app.schemas import SupplierInput, public_url

parser = argparse.ArgumentParser(description=__doc__)
sub = parser.add_subparsers(dest="command", required=True)
sub.add_parser("list")
update = sub.add_parser(
    "import", help="Добавить JSON, сохранить историю и пометить противоречия"
)
update.add_argument("json_file", type=Path)
correct = sub.add_parser(
    "correct", help="Исправить выбранное значение с сохранением старого и источника"
)
correct.add_argument("id")
correct.add_argument(
    "field",
    choices=[
        "name",
        "description",
        "city",
        "region",
        "address",
        "delivery_info",
        "website",
    ],
)
correct.add_argument("value")
correct.add_argument("--source-url", required=True)
args = parser.parse_args()
with SessionLocal() as db:
    if args.command == "list":
        for supplier in db.scalars(
            select(Supplier).where(Supplier.is_demo.is_(False))
        ).all():
            print(
                f"{supplier.id} | {supplier.name} | {supplier.city or 'Не указано'} | источников: {len(supplier.sources)}"
            )
    elif args.command == "import":
        data = SupplierInput.model_validate_json(
            args.json_file.read_text(encoding="utf-8-sig")
        )
        result = import_supplier(db, data)
        print(
            f"{result['supplier']['id']} | создана: {result['created']} | совпадение: {result['matched_by']}"
        )
    else:
        supplier = db.get(Supplier, args.id)
        if supplier is None or supplier.is_demo:
            parser.error("Реальная запись не найдена")
        url = public_url(args.source_url)
        limit = {
            "name": 240,
            "description": 4000,
            "city": 120,
            "region": 120,
            "address": 500,
            "delivery_info": 2000,
            "website": 2048,
        }[args.field]
        value = args.value.strip()
        if not value or len(value) > limit:
            parser.error(f"Новое значение должно содержать от 1 до {limit} символов")
        if args.field == "website":
            value = public_url(value)
        previous = getattr(supplier, args.field)
        now = utcnow().isoformat()
        supplier.sources = [
            *supplier.sources,
            {
                "name": "Исправление оператором",
                "url": url,
                "type": "operator",
                "retrieved_at": now,
                "checked_at": None,
                "status": "unverified",
                "claims": {args.field: value, "previous_value": previous},
            },
        ]
        setattr(supplier, args.field, value)
        supplier.conflicts = [
            conflict
            for conflict in supplier.conflicts
            if conflict
            != f"Различаются сведения: {args.field}. См. значения в источниках."
        ]
        supplier.updated_at = utcnow()
        update_index(supplier)
        db.commit()
        print(
            f"Исправлено: {supplier.id} | поле: {args.field} | история сохранена; требуется проверка источника"
        )
