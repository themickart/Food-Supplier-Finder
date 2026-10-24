import re
from urllib.parse import urlsplit

from fastapi import HTTPException
from sqlalchemy import Text, case, func, select
from sqlalchemy.orm import Session

from .models import Supplier, utcnow
from .schemas import Filters, SupplierInput
from .scoring import information_score, latest_check, review_status

CATEGORIES = [
    {"id": "dairy", "name": "Молочная продукция", "description": "Молоко, сыр и ингредиенты"},
    {"id": "frozen", "name": "Замороженные продукты", "description": "Ягоды, овощи и полуфабрикаты"},
    {"id": "packaging", "name": "Упаковка и расходники", "description": "Стаканы, контейнеры и пакеты"},
]
REGIONS = ["Екатеринбург", "Казань", "Москва"]


def normalize(value: str | None) -> str:
    return re.sub(r"[^\w]+", " ", (value or "").casefold().replace("ё", "е")).strip()


def domain_of(url: str | None) -> str | None:
    return (urlsplit(url).hostname or "").removeprefix("www.").lower() or None if url else None


def update_index(supplier: Supplier):
    supplier.normalized_name = normalize(supplier.name)
    supplier.domain = domain_of(supplier.website)
    supplier.search_text = normalize(
        " ".join(
            [
                supplier.name,
                supplier.description or "",
                supplier.city or "",
                supplier.region or "",
                *supplier.products,
                *supplier.delivery_regions,
                *supplier.categories,
                *[c["name"] for c in CATEGORIES if c["id"] in supplier.categories],
            ]
        )
    )
    supplier.has_contacts = bool(supplier.contacts)
    supplier.has_min_order = any(t.get("min_order") is not None for t in supplier.terms)
    supplier.has_delivery = bool(supplier.delivery_info or supplier.delivery_regions)
    supplier.has_documents = bool(supplier.documents)


def conditions(filters: Filters):
    clauses = [Supplier.is_demo == (filters.mode == "demo")]
    for token in normalize(filters.q).split():
        clauses.append(Supplier.search_text.contains(token, autoescape=True))
    if filters.category:
        clauses.append(Supplier.categories.cast(Text).contains('"' + filters.category + '"', autoescape=True))
    if filters.region:
        # search_text has normalized Russian text, independent of SQLite lower().
        clauses.append((Supplier.city == filters.region) | (Supplier.region == filters.region))
    if filters.delivery_region:
        clauses.append(Supplier.delivery_regions.cast(Text).contains(filters.delivery_region, autoescape=True))
    for key, column in [
        ("website", Supplier.website.is_not(None)),
        ("contacts", Supplier.has_contacts),
        ("min_order", Supplier.has_min_order),
        ("delivery", Supplier.has_delivery),
        ("documents", Supplier.has_documents),
    ]:
        if getattr(filters, key):
            clauses.append(column)
    return clauses


def completeness(supplier: Supplier) -> int:
    return round(
        sum(
            bool(value)
            for value in [
                supplier.description,
                supplier.city,
                supplier.website,
                supplier.products,
                supplier.contacts,
                supplier.terms,
                supplier.has_delivery,
                supplier.documents,
            ]
        )
        / 8
        * 100
    )


def match_details(supplier: Supplier, filters: Filters | None):
    if not filters or not any([filters.q, filters.category, filters.region, filters.delivery_region]):
        return None
    points, maximum, reasons = 0, 0, []
    if filters.q:
        maximum += 60
        tokens = normalize(filters.q).split()
        direct = normalize(" ".join([supplier.name, *supplier.products]))
        hit = all(token in direct for token in tokens)
        points += 60 if hit else 30
        reasons.append(
            "Запрос найден в названии или ассортименте"
            if hit
            else "Запрос найден в описании или категории; ассортимент уточните"
        )
    for value, valid, label in [
        (filters.category, filters.category in supplier.categories, "Совпадает категория"),
        (filters.region, filters.region in [supplier.city, supplier.region], "Совпадает расположение"),
        (
            filters.delivery_region,
            filters.delivery_region in supplier.delivery_regions,
            "Указана доставка в выбранный регион",
        ),
    ]:
        if value:
            maximum += 20
            if valid:
                points += 20
                reasons.append(label)
    return {"value": round(points / maximum * 100), "reasons": reasons, "label": "Соответствие условиям поиска"}


def serialize(supplier: Supplier, filters: Filters | None = None):
    checked_at = latest_check(supplier)
    return {
        "id": supplier.id,
        "name": supplier.name,
        "description": supplier.description,
        "inn": supplier.inn,
        "website": supplier.website,
        "city": supplier.city,
        "region": supplier.region,
        "address": supplier.address,
        "categories": supplier.categories,
        "products": supplier.products,
        "delivery_regions": supplier.delivery_regions,
        "delivery_info": supplier.delivery_info,
        "contacts": supplier.contacts,
        "terms": supplier.terms,
        "documents": supplier.documents,
        "sources": supplier.sources,
        "conflicts": supplier.conflicts,
        "is_demo": supplier.is_demo,
        "completeness": completeness(supplier),
        "checked_at": checked_at,
        "status": review_status(supplier),
        "rating": information_score(supplier),
        "match": match_details(supplier, filters),
        "matched_term_index": matching_term_index(supplier, filters) if filters else None,
        "created_at": supplier.created_at.isoformat(),
        "updated_at": supplier.updated_at.isoformat(),
    }


def query_catalog(db: Session, filters: Filters, page: int = 1, page_size: int = 12, ids: list[str] | None = None):
    clauses = conditions(filters)
    if ids is not None:
        clauses.append(Supplier.id.in_(ids))
    derived = (
        filters.q
        or filters.price_unit
        or filters.order_unit
        or filters.commercial
        or filters.status
        or filters.min_rating
        or filters.verified_contacts
        or filters.sort in {"rating", "updated"}
        or any(
            value is not None for value in [filters.price_from, filters.price_to, filters.order_from, filters.order_to]
        )
        or filters.price_product
    )
    if derived:
        candidates = db.scalars(select(Supplier).where(*clauses).order_by(Supplier.normalized_name, Supplier.id)).all()
        items = [supplier for supplier in candidates if extra_matches(supplier, filters)]
        if filters.sort == "rating":
            items.sort(key=lambda supplier: -information_score(supplier)["value"])
        elif filters.sort == "updated":
            items.sort(key=lambda supplier: supplier.updated_at, reverse=True)
        elif filters.sort == "completeness":
            items.sort(key=lambda supplier: -completeness(supplier))
        elif filters.sort == "region":
            items.sort(key=lambda supplier: supplier.city or "\uffff")
        elif filters.sort == "relevance":
            items.sort(key=lambda supplier: -(match_details(supplier, filters) or {"value": 0})["value"])
        total = len(items)
        items = items[(page - 1) * page_size : page * page_size]
        return {
            "items": [serialize(item, filters) for item in items],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    total = db.scalar(select(func.count()).select_from(Supplier).where(*clauses))
    if filters.sort == "completeness":
        fields = [
            Supplier.has_contacts,
            Supplier.has_delivery,
            Supplier.has_documents,
            Supplier.website.is_not(None),
            Supplier.description.is_not(None),
            Supplier.city.is_not(None),
            Supplier.products.cast(Text) != "[]",
            Supplier.terms.cast(Text) != "[]",
        ]
        score = sum(case((column, 1), else_=0) for column in fields)
        order = [score.desc(), Supplier.normalized_name, Supplier.id]
    elif filters.sort == "region":
        order = [Supplier.city.asc().nullslast(), Supplier.normalized_name, Supplier.id]
    elif filters.sort == "relevance" and normalize(filters.q):
        score = sum(
            case((Supplier.normalized_name.contains(token, autoescape=True), 2), else_=0)
            for token in normalize(filters.q).split()
        )
        order = [score.desc(), Supplier.normalized_name, Supplier.id]
    else:
        order = [Supplier.normalized_name, Supplier.id]
    items = db.scalars(
        select(Supplier).where(*clauses).order_by(*order).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return {"items": [serialize(item, filters) for item in items], "total": total, "page": page, "page_size": page_size}


def extra_matches(supplier: Supplier, filters: Filters):
    if filters.verified_contacts and not any(
        contact.get("verification") in {"official_site", "source_checked", "phone_verified"}
        and contact.get("source_url")
        for contact in supplier.contacts
    ):
        return False
    if filters.commercial and not any(
        term.get("price") is not None or term.get("min_order") is not None for term in supplier.terms
    ):
        return False
    if filters.status and review_status(supplier) != filters.status:
        return False
    if filters.min_rating and information_score(supplier)["value"] < filters.min_rating:
        return False
    price_filter = bool(filters.price_unit) or filters.price_from is not None or filters.price_to is not None
    order_filter = bool(filters.order_unit) or filters.order_from is not None or filters.order_to is not None
    if not (price_filter or order_filter or filters.price_product):
        return True
    return matching_term_index(supplier, filters) is not None


def matching_term_index(supplier: Supplier, filters: Filters):
    price_filter = bool(filters.price_unit) or filters.price_from is not None or filters.price_to is not None
    order_filter = bool(filters.order_unit) or filters.order_from is not None or filters.order_to is not None
    if not (price_filter or order_filter or filters.price_product):
        if filters.q:
            tokens = normalize(filters.q).split()
            return next(
                (
                    index
                    for index, term in enumerate(supplier.terms)
                    if tokens and all(token in normalize(term.get("product")) for token in tokens)
                ),
                None,
            )
        return None
    for index, term in enumerate(supplier.terms):
        if filters.price_product and normalize(filters.price_product) not in normalize(term.get("product")):
            continue
        if price_filter:
            value = term.get("price")
            if (
                value is None
                or unit_key(term.get("unit")) != unit_key(filters.price_unit)
                or term.get("currency") != filters.price_currency
            ):
                continue
            if filters.price_from is not None and value < filters.price_from:
                continue
            if filters.price_to is not None and value > filters.price_to:
                continue
        if order_filter:
            value = term.get("min_order")
            if value is None or unit_key(term.get("min_order_unit")) != unit_key(filters.order_unit):
                continue
            if filters.order_from is not None and value < filters.order_from:
                continue
            if filters.order_to is not None and value > filters.order_to:
                continue
        return index
    return None


def unit_key(value: str | None):
    raw = (value or "").strip().casefold().rstrip(".")
    return {"₽": "rub", "руб": "rub", "$": "usd", "€": "eur"}.get(raw, raw)


def terms_payload(data: SupplierInput):
    return [{**term.model_dump(), "source_url": data.source_url, "checked_at": None} for term in data.terms]


def documents_payload(data: SupplierInput):
    return [
        {**document.model_dump(), "source_url": data.source_url, "status": "user_supplied"}
        for document in data.documents
    ]


def selected(db: Session, ids: list[str], mode: str):
    unique = list(dict.fromkeys(ids))
    items = db.scalars(select(Supplier).where(Supplier.id.in_(unique), Supplier.is_demo == (mode == "demo"))).all()
    by_id = {item.id: item for item in items}
    if len(items) != len(unique):
        raise HTTPException(404, "Некоторые поставщики недоступны в выбранном режиме")
    return [by_id[item_id] for item_id in unique]


def import_supplier(db: Session, data: SupplierInput):
    payload = data.model_dump()
    now = utcnow().isoformat()
    website = data.website
    domain = domain_of(website)
    existing = None
    reason = None
    ambiguous = False
    # Each tier only considers real entries. Never merge two conflicting legal entities.
    for predicate, label in [
        (Supplier.inn == data.inn if data.inn else None, "inn"),
        (Supplier.domain == domain if domain else None, "domain"),
        (
            (Supplier.normalized_name == normalize(data.name)) & (Supplier.address == data.address)
            if data.address
            else None,
            "name_address",
        ),
    ]:
        if predicate is None:
            continue
        matches = db.scalars(select(Supplier).where(Supplier.is_demo.is_(False), predicate)).all()
        if not matches:
            continue
        if len(matches) == 1 and not (data.inn and matches[0].inn and data.inn != matches[0].inn):
            existing, reason = matches[0], label
        else:
            ambiguous = True
        break
    source = {
        "url": data.source_url,
        "name": "Добавлено пользователем",
        "type": "manual",
        "retrieved_at": now,
        "checked_at": None,
        "status": "unverified",
        "claims": {key: value for key, value in payload.items() if value},
    }
    if existing:
        # Keep earlier sources and conflicting facts; a repeated URL with identical claims adds no copy.
        if not any(s["url"] == source["url"] and s.get("claims") == source["claims"] for s in existing.sources):
            existing.sources = [*existing.sources, source]
        conflicts = list(existing.conflicts)
        for key in ["name", "description", "city", "region", "address", "website", "inn", "delivery_info"]:
            incoming, old = getattr(data, key), getattr(existing, key)
            if incoming and old and incoming != old:
                conflict = f"Различаются сведения: {key}. См. значения в источниках."
                if conflict not in conflicts:
                    conflicts.append(conflict)
            elif incoming and not old:
                setattr(existing, key, incoming)
        existing.conflicts = conflicts
        existing.products = list(
            dict.fromkeys([*existing.products, *data.products, *[term.product for term in data.terms]])
        )
        existing.categories = list(dict.fromkeys([*existing.categories, data.category]))
        existing.delivery_regions = list(dict.fromkeys([*existing.delivery_regions, *data.delivery_regions]))
        existing.terms = [*existing.terms, *[term for term in terms_payload(data) if term not in existing.terms]]
        existing.documents = [
            *existing.documents,
            *[document for document in documents_payload(data) if document not in existing.documents],
        ]
        supplier = existing
    else:
        supplier = Supplier(
            name=data.name,
            inn=data.inn,
            website=website,
            description=data.description,
            city=data.city,
            region=data.region,
            address=data.address,
            delivery_info=data.delivery_info,
            delivery_regions=data.delivery_regions,
            categories=[data.category],
            products=list(dict.fromkeys([*data.products, *[term.product for term in data.terms]])),
            contacts=[],
            terms=terms_payload(data),
            documents=documents_payload(data),
            sources=[source],
            conflicts=["Возможный дубликат: требуется проверка оператором"] if ambiguous else [],
            is_demo=False,
        )
        db.add(supplier)
    contacts = list(supplier.contacts)
    for kind in ["phone", "email"]:
        value = getattr(data, kind)
        if value and not any(c["kind"] == kind and c["value"] == value for c in contacts):
            contacts.append(
                {"kind": kind, "value": value, "source_url": data.source_url, "verification": "user_supplied"}
            )
    supplier.contacts = contacts
    supplier.updated_at = utcnow()
    update_index(supplier)
    db.commit()
    db.refresh(supplier)
    return {"supplier": serialize(supplier), "created": existing is None, "matched_by": reason}


def edit_supplier(db: Session, supplier_id: str, data: SupplierInput):
    supplier = db.get(Supplier, supplier_id)
    if supplier is None or supplier.is_demo:
        raise HTTPException(404, "Реальная запись не найдена; демоданные не редактируются")
    for predicate in [
        Supplier.inn == data.inn if data.inn else None,
        Supplier.domain == domain_of(data.website) if data.website else None,
    ]:
        if predicate is not None and db.scalar(
            select(Supplier.id).where(Supplier.id != supplier_id, Supplier.is_demo.is_(False), predicate)
        ):
            raise HTTPException(
                409, "Другой поставщик уже использует этот ИНН или домен. Проверьте дубликат перед изменением."
            )
    now = utcnow().isoformat()
    supplier.sources = [
        *supplier.sources,
        {
            "url": data.source_url,
            "name": "Изменение пользователем",
            "type": "manual_edit",
            "retrieved_at": now,
            "checked_at": None,
            "status": "unverified",
            "claims": data.model_dump(),
            "previous": {
                key: getattr(supplier, key)
                for key in [
                    "name",
                    "description",
                    "city",
                    "region",
                    "address",
                    "website",
                    "inn",
                    "products",
                    "terms",
                    "documents",
                    "delivery_info",
                    "delivery_regions",
                    "contacts",
                ]
            },
        },
    ]
    for key in [
        "name",
        "description",
        "city",
        "region",
        "address",
        "website",
        "inn",
        "delivery_info",
        "products",
        "delivery_regions",
    ]:
        setattr(supplier, key, getattr(data, key))
    supplier.categories = [data.category]
    supplier.products = list(dict.fromkeys([*data.products, *[term.product for term in data.terms]]))
    supplier.terms, supplier.documents = terms_payload(data), documents_payload(data)
    supplier.contacts = [
        {"kind": kind, "value": getattr(data, kind), "source_url": data.source_url, "verification": "user_supplied"}
        for kind in ["phone", "email"]
        if getattr(data, kind)
    ]
    supplier.updated_at = utcnow()
    update_index(supplier)
    db.commit()
    db.refresh(supplier)
    return {"supplier": serialize(supplier), "created": False, "matched_by": None}
