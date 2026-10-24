from pathlib import Path

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import Base, make_engine
from app.demo import seed_demo
from app.main import migrate
from app.models import Supplier


def test_initial_migration_matches_model_and_is_repeatable(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path / 'migrations.db'}")
    migrate(engine)
    migrate(engine)
    with engine.connect() as connection:
        context = MigrationContext.configure(connection)
        assert context.get_current_revision() == "002_delivery_search"
        assert compare_metadata(context, Base.metadata) == []
    engine.dispose()


def test_delivery_search_migration_backfills_existing_records_without_changing_facts(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path / 'old.db'}")
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "001_catalog")
    with Session(engine) as session:
        seed_demo(session)
        supplier = session.get(Supplier, "demo-03")
        supplier.search_text = "фермерская линия казань молоко"
        original_sources = supplier.sources.copy()
        session.commit()
    migrate(engine)
    with Session(engine) as session:
        supplier = session.scalar(select(Supplier).where(Supplier.id == "demo-03"))
        assert "екатеринбург" in supplier.search_text
        assert supplier.city == "Казань"
        assert supplier.sources == original_sources
    engine.dispose()
