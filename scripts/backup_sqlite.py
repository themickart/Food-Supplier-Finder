"""Consistent SQLite backup using its online backup API. Never overwrites an existing backup."""

import argparse
import sqlite3
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("destination", type=Path)
parser.add_argument("--source", type=Path, default=Path("data/catalog.db"))
args = parser.parse_args()
if not args.source.is_file():
    parser.error("Исходная БД не найдена")
if args.destination.exists():
    parser.error("Файл назначения уже существует. Укажите новый путь.")
args.destination.parent.mkdir(parents=True, exist_ok=True)
with sqlite3.connect(args.source.resolve().as_uri() + "?mode=ro", uri=True) as source:
    with sqlite3.connect(args.destination) as destination:
        source.backup(destination)
print(f"Резервная копия: {args.destination}")
