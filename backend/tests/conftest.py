import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.db import get_db, make_engine
from app.demo import seed_demo
from app.main import create_app, migrate


@pytest.fixture
def client(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path / 'test.db'}")
    migrate(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as session:
        seed_demo(session)
    app = create_app(initialize=False, serve_frontend=False)

    def get_test_db():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db] = get_test_db
    with TestClient(app) as test_client:
        yield test_client
    engine.dispose()


@pytest.fixture
def real_supplier():
    # Only test fixtures, not real companies. Never seeded in the application database.
    return {
        "name": "Тестовая компания для API",
        "source_url": "https://supplier-test.ru/contacts",
        "website": "https://www.supplier-test.ru",
        "city": "Екатеринбург",
        "category": "dairy",
        "products": ["Моцарелла", "Молоко"],
        "email": "sales@supplier-test.ru",
    }
