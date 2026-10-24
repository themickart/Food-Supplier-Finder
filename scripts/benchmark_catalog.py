"""Isolated SQLite catalog benchmark. Never writes to the application database."""
import json
import statistics
import sys
import tempfile
from pathlib import Path
from time import perf_counter

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from sqlalchemy.orm import Session

from app.catalog import normalize, query_catalog
from app.db import make_engine
from app.main import migrate
from app.models import Supplier
from app.schemas import Filters

with tempfile.TemporaryDirectory(prefix="supplier-benchmark-") as directory:
    engine = make_engine(f"sqlite:///{Path(directory) / 'benchmark.db'}")
    migrate(engine)
    with Session(engine) as db:
        db.bulk_insert_mappings(Supplier, [
            {"id": f"bench-{i}", "name": f"Тестовый поставщик {i}", "normalized_name": f"тестовый поставщик {i}",
             "search_text": normalize(f"Тестовый поставщик {i} Моцарелла Екатеринбург"),
             "categories": ["dairy"], "products": ["Моцарелла"], "city": "Екатеринбург", "is_demo": False}
            for i in range(10000)
        ])
        db.commit()
        times = []
        for _ in range(10):
            start = perf_counter()
            result = query_catalog(db, Filters(q="Моцарелла", region="Екатеринбург", category="dairy"))
            times.append(round((perf_counter() - start) * 1000, 2))
            assert result["total"] == 10000 and len(result["items"]) == 12
        print(json.dumps({"records": 10000, "runs": 10, "median_ms": statistics.median(times), "max_ms": max(times), "all_ms": times}))
    engine.dispose()
