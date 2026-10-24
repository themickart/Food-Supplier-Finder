from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow():
    return datetime.now(UTC)


class Supplier(Base):
    __tablename__ = "suppliers"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(240))
    normalized_name: Mapped[str] = mapped_column(String(240), index=True)
    search_text: Mapped[str] = mapped_column(Text)
    inn: Mapped[str | None] = mapped_column(String(12), index=True)
    website: Mapped[str | None] = mapped_column(String(2048))
    domain: Mapped[str | None] = mapped_column(String(255), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(120))
    region: Mapped[str | None] = mapped_column(String(120))
    address: Mapped[str | None] = mapped_column(String(500))
    categories: Mapped[list] = mapped_column(JSON, default=list)
    products: Mapped[list] = mapped_column(JSON, default=list)
    delivery_regions: Mapped[list] = mapped_column(JSON, default=list)
    delivery_info: Mapped[str | None] = mapped_column(Text)
    contacts: Mapped[list] = mapped_column(JSON, default=list)
    terms: Mapped[list] = mapped_column(JSON, default=list)
    documents: Mapped[list] = mapped_column(JSON, default=list)
    sources: Mapped[list] = mapped_column(JSON, default=list)
    conflicts: Mapped[list] = mapped_column(JSON, default=list)
    has_contacts: Mapped[bool] = mapped_column(Boolean, default=False)
    has_min_order: Mapped[bool] = mapped_column(Boolean, default=False)
    has_delivery: Mapped[bool] = mapped_column(Boolean, default=False)
    has_documents: Mapped[bool] = mapped_column(Boolean, default=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (Index("ix_supplier_scope_name", "is_demo", "normalized_name"),)
