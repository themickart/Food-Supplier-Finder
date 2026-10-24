from dataclasses import dataclass
from typing import Protocol


@dataclass
class DiscoveryResult:
    status: str
    message: str


class SearchProvider(Protocol):
    """A future adapter must fetch actual data, normalize it and preserve provenance.

    No paid API calls or web scraping are enabled in this prototype.
    """

    def search(self, query: str, region: str) -> DiscoveryResult: ...


class UnconfiguredProvider:
    def search(self, query: str, region: str) -> DiscoveryResult:
        return DiscoveryResult(
            status="not_configured",
            message="Внешний поиск не подключён. Показаны только записи каталога. Платные запросы не выполняются.",
        )
