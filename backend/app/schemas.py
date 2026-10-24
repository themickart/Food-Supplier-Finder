import ipaddress
import re
from typing import Literal
from urllib.parse import urlsplit, urlunsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def public_url(value: str) -> str:
    try:
        parsed = urlsplit(value.strip())
        host = (parsed.hostname or "").lower().rstrip(".")
        if parsed.scheme not in {"https", "http"} or not host or parsed.username or parsed.password:
            raise ValueError("Нужен публичный HTTP(S) URL без логина и пароля")
        if parsed.port not in {None, 80, 443}:
            raise ValueError("Допускаются только стандартные HTTP(S) порты")
        if "." not in host or host.endswith((".local", ".localhost", ".internal", ".example", ".invalid")):
            raise ValueError("Укажите публичный адрес источника")
        try:
            address = ipaddress.ip_address(host)
        except ValueError:
            address = None
        if address is not None:
            raise ValueError("Используйте доменное имя, а не IP-адрес")
        if not all(re.fullmatch(r"[a-z0-9\-]+", part) for part in host.encode("idna").decode().split(".")):
            raise ValueError("Некорректное доменное имя")
        return urlunsplit((parsed.scheme, host.encode("idna").decode(), parsed.path or "/", parsed.query, ""))
    except (ValueError, UnicodeError) as exc:
        raise ValueError(str(exc)) from exc


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class TermInput(StrictModel):
    product: str = Field(min_length=1, max_length=160)
    price: float | None = Field(default=None, ge=0, le=1e12, allow_inf_nan=False)
    currency: Literal["RUB", "USD", "EUR"] = "RUB"
    unit: str = Field(min_length=1, max_length=40)
    packaging: str | None = Field(default=None, max_length=160)
    volume: str | None = Field(default=None, max_length=160)
    min_order: float | None = Field(default=None, ge=0, le=1e12, allow_inf_nan=False)
    min_order_unit: str = Field(default="₽", min_length=1, max_length=40)


class DocumentInput(StrictModel):
    name: str = Field(min_length=1, max_length=240)
    url: str = Field(min_length=8, max_length=2048)

    @field_validator("url")
    @classmethod
    def validate_document_url(cls, value):
        return public_url(value)


class SupplierInput(StrictModel):
    name: str = Field(min_length=2, max_length=240)
    source_url: str = Field(min_length=8, max_length=2048)
    website: str | None = Field(default=None, max_length=2048)
    inn: str | None = None
    description: str | None = Field(default=None, max_length=4000)
    city: str | None = Field(default=None, max_length=120)
    region: str | None = Field(default=None, max_length=120)
    address: str | None = Field(default=None, max_length=500)
    category: Literal["dairy", "frozen", "packaging"]
    products: list[str] = Field(default_factory=list, max_length=40)
    phone: str | None = Field(default=None, max_length=100)
    email: str | None = Field(default=None, max_length=254)
    delivery_info: str | None = Field(default=None, max_length=2000)
    delivery_regions: list[str] = Field(default_factory=list, max_length=20)
    terms: list[TermInput] = Field(default_factory=list, max_length=20)
    documents: list[DocumentInput] = Field(default_factory=list, max_length=20)

    @field_validator("delivery_regions")
    @classmethod
    def validate_regions(cls, values):
        if any(not value.strip() or len(value) > 120 for value in values):
            raise ValueError("Регион доставки должен содержать от 1 до 120 символов")
        return list(dict.fromkeys(value.strip() for value in values))

    @field_validator("source_url", "website")
    @classmethod
    def validate_url(cls, value):
        return public_url(value) if value else None

    @field_validator("inn")
    @classmethod
    def validate_inn(cls, value):
        if not value:
            return None
        if not re.fullmatch(r"\d{10}|\d{12}", value, flags=re.ASCII):
            raise ValueError("ИНН должен содержать 10 или 12 цифр")
        digits = [int(digit) for digit in value]

        def checksum(weights):
            return sum(a * b for a, b in zip(digits, weights, strict=False)) % 11 % 10

        valid = (
            (checksum([2, 4, 10, 3, 5, 9, 4, 6, 8]) == digits[9])
            if len(value) == 10
            else (
                checksum([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) == digits[10]
                and checksum([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) == digits[11]
            )
        )
        if not valid:
            raise ValueError("Не сходится контрольная сумма ИНН")
        return value

    @field_validator("products")
    @classmethod
    def validate_products(cls, values):
        if any(not v.strip() or len(v) > 160 for v in values):
            raise ValueError("Название товара должно содержать от 1 до 160 символов")
        return list(dict.fromkeys(v.strip() for v in values))

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        if value and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Некорректный email")
        return value


class Filters(StrictModel):
    q: str = Field(default="", max_length=400)
    category: str = Field(default="", max_length=80)
    region: str = Field(default="", max_length=120)
    delivery_region: str = Field(default="", max_length=120)
    website: bool = False
    contacts: bool = False
    verified_contacts: bool = False
    min_order: bool = False
    delivery: bool = False
    documents: bool = False
    commercial: bool = False
    mode: Literal["real", "demo"] = "real"
    sort: Literal["relevance", "name", "completeness", "region", "rating", "updated"] = "relevance"
    status: Literal["", "needs_review", "unverified", "source_checked"] = ""
    min_rating: int = Field(default=0, ge=0, le=100)
    price_product: str = Field(default="", max_length=160)
    price_unit: str = Field(default="", max_length=40)
    price_currency: Literal["RUB", "USD", "EUR"] = "RUB"
    price_from: float | None = Field(default=None, ge=0, le=1e12, allow_inf_nan=False)
    price_to: float | None = Field(default=None, ge=0, le=1e12, allow_inf_nan=False)
    order_unit: str = Field(default="", max_length=40)
    order_from: float | None = Field(default=None, ge=0, le=1e12, allow_inf_nan=False)
    order_to: float | None = Field(default=None, ge=0, le=1e12, allow_inf_nan=False)

    @model_validator(mode="after")
    def validate_ranges(self):
        if self.price_from is not None or self.price_to is not None:
            if not self.price_product or not self.price_unit:
                raise ValueError("Для диапазона цены укажите товар и единицу измерения")
        if (self.order_from is not None or self.order_to is not None) and not self.order_unit:
            raise ValueError("Для диапазона минимального заказа укажите единицу")
        for lower, upper in [(self.price_from, self.price_to), (self.order_from, self.order_to)]:
            if lower is not None and upper is not None and lower > upper:
                raise ValueError("Нижняя граница диапазона больше верхней")
        return self


class SearchRequest(StrictModel):
    filters: Filters
    external: bool = False


class Selection(StrictModel):
    ids: list[str] = Field(min_length=1, max_length=5)
    mode: Literal["real", "demo"] = "real"
    filters: Filters | None = None

    @model_validator(mode="after")
    def validate_scope(self):
        if self.filters and self.filters.mode != self.mode:
            raise ValueError("Режим фильтров должен совпадать с режимом сравнения")
        return self


class ExportRequest(StrictModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    format: Literal["csv", "xlsx"]
    filters: Filters = Field(default_factory=Filters)
    ids: list[str] = Field(default_factory=list, max_length=1000)
    include_notes: bool = False
    notes: dict[str, str] = Field(default_factory=dict, max_length=1000)

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, values):
        if any(len(key) > 36 or len(value) > 5000 for key, value in values.items()):
            raise ValueError("Слишком длинная заметка")
        return values


class Collection(StrictModel):
    ids: list[str] = Field(default_factory=list, max_length=500)
    filters: Filters
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=12, ge=1, le=100)
