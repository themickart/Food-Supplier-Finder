"""Include delivery geography in existing catalogue search indexes."""

import re

import sqlalchemy as sa
from alembic import op

revision = "002_delivery_search"
down_revision = "001_catalog"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    suppliers = sa.table(
        "suppliers",
        sa.column("id", sa.String()),
        sa.column("search_text", sa.Text()),
        sa.column("delivery_regions", sa.JSON()),
    )
    for row in connection.execute(sa.select(suppliers)).mappings():
        text = re.sub(
            r"[^\w]+", " ", " ".join([row["search_text"], *row["delivery_regions"]]).casefold().replace("ё", "е")
        ).strip()
        connection.execute(suppliers.update().where(suppliers.c.id == row["id"]).values(search_text=text))


def downgrade():
    # An additive search index change preserves all underlying supplier facts.
    pass
