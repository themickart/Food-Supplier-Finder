from alembic import context

from app import models  # noqa: F401
from app.db import Base

config = context.config


def run(connection):
    context.configure(connection=connection, target_metadata=Base.metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    context.configure(url=config.get_main_option("sqlalchemy.url"), target_metadata=Base.metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
elif config.attributes.get("connection") is not None:
    run(config.attributes["connection"])
else:
    from app.config import settings

    config.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))
    from app.db import make_engine

    with make_engine(settings.database_url).connect() as connection:
        run(connection)
