"""Explainable information index. Never an assessment of commercial reliability."""

from datetime import datetime

from .config import settings
from .models import Supplier, utcnow

SCORING_VERSION = "data-v1"


def latest_check(supplier: Supplier) -> str | None:
    checks = [s.get("checked_at") for s in supplier.sources if s.get("checked_at")]
    return max(checks) if checks else None


def review_status(supplier: Supplier) -> str:
    checked = latest_check(supplier)
    if supplier.conflicts or (checked and (utcnow() - datetime.fromisoformat(checked)).days >= settings.stale_days):
        return "needs_review"
    return "source_checked" if checked else "unverified"


def information_score(supplier: Supplier) -> dict:
    checked = latest_check(supplier)
    age = max(0, (utcnow() - datetime.fromisoformat(checked)).days) if checked else None
    sources = 20 if any(s.get("url") and s.get("retrieved_at") for s in supplier.sources) else 0
    contacts = 15 if any(c.get("value") and c.get("source_url") for c in supplier.contacts) else 0
    assortment = 15 if supplier.products else 0
    # All four commercial components must describe the same identifiable product.
    commercial = max(
        (
            sum(
                [
                    5 if t.get("price") is not None and t.get("unit") and t.get("currency") else 0,
                    5 if t.get("min_order") is not None and t.get("min_order_unit") else 0,
                    5 if t.get("packaging") else 0,
                    5 if t.get("volume") else 0,
                ]
            )
            for t in supplier.terms
            if t.get("product") and t.get("source_url")
        ),
        default=0,
    )
    delivery = (5 if supplier.delivery_info else 0) + (5 if supplier.delivery_regions else 0)
    documents = 5 if any(d.get("name") and d.get("url") for d in supplier.documents) else 0
    freshness = (
        15
        if age is not None and age < min(30, settings.stale_days)
        else 10
        if age is not None and age < settings.stale_days
        else 0
    )
    criteria = [
        {
            "id": "sources",
            "name": "Происхождение сведений",
            "points": sources,
            "max": 20,
            "explanation": "Есть URL источника и дата получения. Это происхождение, а не подтверждение факта.",
        },
        {
            "id": "contacts",
            "name": "Контакты с источником",
            "points": contacts,
            "max": 15,
            "explanation": "Указан контакт и его источник. Проверка звонком не подразумевается.",
        },
        {
            "id": "assortment",
            "name": "Ассортимент",
            "points": assortment,
            "max": 15,
            "explanation": "В карточке перечислены конкретные товары.",
        },
        {
            "id": "terms",
            "name": "Условия закупки",
            "points": commercial,
            "max": 20,
            "explanation": "По 5 баллов: цена с единицей и валютой, минимальный заказ с единицей, фасовка, объём. Для одного товара с источником.",
        },
        {
            "id": "delivery",
            "name": "Доставка",
            "points": delivery,
            "max": 10,
            "explanation": "5 баллов за условия и 5 за указанную географию доставки.",
        },
        {
            "id": "documents",
            "name": "Сведения о документах",
            "points": documents,
            "max": 5,
            "explanation": "Есть название документа и ссылка. Юридическая действительность автоматически не проверяется.",
        },
        {
            "id": "freshness",
            "name": "Актуальность проверки",
            "points": freshness,
            "max": 15,
            "explanation": f"До 30 дней — 15 баллов, до {settings.stale_days} дней — 10. Если проверки нет или она устарела — 0.",
        },
    ]
    penalty = 20 if supplier.conflicts else 0
    score = max(0, sum(c["points"] for c in criteria) - penalty)
    return {
        "value": score,
        "max": 100,
        "version": SCORING_VERSION,
        "label": "Много сведений" if score >= 75 else "Есть пробелы" if score >= 45 else "Мало сведений",
        "criteria": criteria,
        "conflict_penalty": penalty,
        "disclaimer": "Индекс оценивает доступность и актуальность сведений, а не надёжность компании, качество продукции или готовность к поставке.",
    }
