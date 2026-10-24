"""Initial supplier catalogue. Personal data stays in the browser."""

import sqlalchemy as sa
from alembic import op

revision = "001_catalog"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "suppliers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(240), nullable=False),
        sa.Column("normalized_name", sa.String(240), nullable=False),
        sa.Column("search_text", sa.Text(), nullable=False),
        sa.Column("inn", sa.String(12)),
        sa.Column("website", sa.String(2048)),
        sa.Column("domain", sa.String(255)),
        sa.Column("description", sa.Text()),
        sa.Column("city", sa.String(120)),
        sa.Column("region", sa.String(120)),
        sa.Column("address", sa.String(500)),
        *[
            sa.Column(name, sa.JSON(), nullable=False)
            for name in [
                "categories",
                "products",
                "delivery_regions",
                "contacts",
                "terms",
                "documents",
                "sources",
                "conflicts",
            ]
        ],
        sa.Column("delivery_info", sa.Text()),
        *[
            sa.Column(name, sa.Boolean(), nullable=False)
            for name in ["has_contacts", "has_min_order", "has_delivery", "has_documents", "is_demo"]
        ],
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    for column in ["normalized_name", "inn", "domain", "is_demo"]:
        op.create_index(f"ix_suppliers_{column}", "suppliers", [column])
    op.create_index("ix_supplier_scope_name", "suppliers", ["is_demo", "normalized_name"])


def downgrade():
    op.drop_table("suppliers")
