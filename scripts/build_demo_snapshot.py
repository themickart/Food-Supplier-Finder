"""Create the explicitly fictional Pages fixture without reading any user database."""

import json
import sys
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.catalog import CATEGORIES, REGIONS, serialize
from app.demo import seed_demo
from app.models import Base, Supplier

engine = create_engine("sqlite://")
Base.metadata.create_all(engine)
with Session(engine) as session:
    seed_demo(session)
    items = [
        serialize(s) for s in session.scalars(select(Supplier).order_by(Supplier.id))
    ]
    assert len(items) == 12 and all(s["is_demo"] for s in items)
    target = ROOT / "frontend/src/standalone/demo.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(
            {"categories": CATEGORIES, "regions": REGIONS, "items": items},
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(items)} fictional suppliers to {target.relative_to(ROOT)}")
