from datetime import timedelta

from sqlalchemy import select

from .catalog import update_index
from .models import Supplier, utcnow

# Fictional fixtures only. Reserved .example domains cannot point to actual suppliers.
DEMO = [
    (
        "demo-01",
        "Молочный маршрут",
        "dairy",
        "Екатеринбург",
        ["Молоко 3,2%", "Сливки 33%", "Моцарелла"],
        "молоко 3,2%",
        89,
        "л",
        12000,
        "₽",
        4,
        True,
    ),
    (
        "demo-02",
        "Сырная мастерская",
        "dairy",
        "Екатеринбург",
        ["Моцарелла", "Сыр для пиццы", "Творожный сыр"],
        "моцарелла",
        590,
        "кг",
        10,
        "кг",
        12,
        True,
    ),
    (
        "demo-03",
        "Фермерская линия",
        "dairy",
        "Казань",
        ["Молоко 3,2%", "Сметана", "Творог"],
        "молоко 3,2%",
        95,
        "л",
        5000,
        "₽",
        102,
        False,
    ),
    (
        "demo-04",
        "Белая полка",
        "dairy",
        "Москва",
        ["Моцарелла", "Сливочное масло", "Сливки 33%"],
        "моцарелла",
        1250,
        "уп.",
        15000,
        "₽",
        21,
        True,
    ),
    (
        "demo-05",
        "Ягодный запас",
        "frozen",
        "Екатеринбург",
        ["Клубника замороженная", "Малина", "Черника"],
        "клубника",
        260,
        "кг",
        20,
        "кг",
        6,
        True,
    ),
    (
        "demo-06",
        "Холодный сезон",
        "frozen",
        "Казань",
        ["Клубника замороженная", "Овощные смеси", "Брокколи"],
        "клубника",
        240,
        "кг",
        10000,
        "₽",
        17,
        False,
    ),
    (
        "demo-07",
        "Северная корзина",
        "frozen",
        "Москва",
        ["Малина", "Черника", "Манго замороженное"],
        "малина",
        420,
        "кг",
        30,
        "кг",
        2,
        True,
    ),
    (
        "demo-08",
        "Ледяной склад",
        "frozen",
        "Екатеринбург",
        ["Вишня без косточки", "Клубника замороженная"],
        "клубника",
        None,
        "кг",
        None,
        "₽",
        130,
        False,
    ),
    (
        "demo-09",
        "Форма и объём",
        "packaging",
        "Екатеринбург",
        ["Стаканы бумажные", "Контейнеры", "Крышки"],
        "стакан 250 мл",
        4.5,
        "шт.",
        2000,
        "шт.",
        8,
        True,
    ),
    (
        "demo-10",
        "Бережная упаковка",
        "packaging",
        "Казань",
        ["Стаканы бумажные", "Крафт-пакеты", "Коробки"],
        "крафт-пакет",
        8,
        "шт.",
        3000,
        "₽",
        33,
        True,
    ),
    (
        "demo-11",
        "Пакет решений",
        "packaging",
        "Москва",
        ["Контейнеры", "Одноразовая посуда", "Плёнка"],
        "контейнер 500 мл",
        7.2,
        "шт.",
        500,
        "шт.",
        10,
        False,
    ),
    (
        "demo-12",
        "Чистый формат",
        "packaging",
        "Екатеринбург",
        ["Стаканы бумажные", "Салфетки", "Крафт-пакеты"],
        "салфетки",
        None,
        "уп.",
        None,
        "₽",
        None,
        False,
    ),
]


def seed_demo(db):
    existing_ids = set(db.scalars(select(Supplier.id).where(Supplier.is_demo.is_(True))).all())
    for sid, name, category, city, products, product, price, unit, minimum, minimum_unit, age, documents in DEMO:
        if sid in existing_ids:
            continue
        url = f"https://{sid}.example/"
        checked = (utcnow() - timedelta(days=age)).isoformat() if age is not None else None
        sources = [
            {
                "name": "Демонстрационный набор",
                "url": url,
                "type": "demo",
                "retrieved_at": utcnow().isoformat(),
                "checked_at": checked,
                "status": "demo",
                "claims": {"name": name, "products": products, "city": city},
            }
        ]
        supplier = Supplier(
            id=sid,
            name=name,
            description={
                "dairy": "Поставки молочной продукции для кофеен, пекарен и ресторанов. Ассортимент для профессиональной кухни.",
                "frozen": "Замороженные ягоды, фрукты и овощи для заведений и пищевых производств. Оптовые партии.",
                "packaging": "Упаковка и расходные материалы для доставки еды, кофеен и розничных магазинов.",
            }[category],
            website=url if sid != "demo-12" else None,
            city=city,
            region=city,
            address=f"{city}, демонстрационный адрес",
            categories=[category],
            products=products,
            contacts=[{"kind": "email", "value": f"sales@{sid}.example", "source_url": url, "verification": "demo"}]
            if sid not in {"demo-08", "demo-12"}
            else [],
            delivery_info="Доставка по городу и области. Условия зависят от объёма партии."
            if sid != "demo-12"
            else None,
            delivery_regions=[city, "Екатеринбург"]
            if city != "Екатеринбург" and category == "dairy"
            else [city]
            if sid != "demo-12"
            else [],
            terms=[
                {
                    "product": product,
                    "price": price,
                    "currency": "RUB",
                    "unit": unit,
                    "packaging": "2 кг" if sid == "demo-04" else None,
                    "volume": "Оптовая партия",
                    "min_order": minimum,
                    "min_order_unit": minimum_unit,
                    "source_url": url,
                    "checked_at": checked,
                }
            ]
            if price is not None or minimum is not None
            else [],
            documents=[
                {
                    "name": "Пример декларации соответствия",
                    "url": url + "documents",
                    "source_url": url,
                    "status": "demo",
                }
            ]
            if documents
            else [],
            sources=sources,
            conflicts=["В демонстрационных источниках различаются условия доставки"] if sid == "demo-06" else [],
            is_demo=True,
        )
        update_index(supplier)
        db.add(supplier)
    db.commit()
