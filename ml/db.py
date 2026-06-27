#!/usr/bin/env python3
"""
db.py - Lapisan database async untuk bot SIGAP Banjir (SQLAlchemy 2.0).

Engine & session async dibuat dari BOT_DB_URL di .env. Default-nya SQLite lokal
(aman, tidak menyentuh server MySQL departemen lain). Untuk pindah ke MySQL,
cukup ganti BOT_DB_URL di .env menjadi:
    mysql+aiomysql://user:pass@host:port/sigap_bot

pool_recycle=3600 mencegah error "MySQL server has gone away" pada koneksi idle.
"""
import os

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from models import Base

BASE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE, ".env"))

# Default aman: SQLite lokal di folder ml/.
DEFAULT_URL = "sqlite+aiosqlite:///" + os.path.join(BASE, "sigap_bot.db")
BOT_DB_URL = os.environ.get("BOT_DB_URL", DEFAULT_URL)

# pool_recycle hanya relevan untuk koneksi jaringan (MySQL). SQLite mengabaikannya
# dengan aman, tapi kita set hanya saat bukan SQLite agar bersih.
_engine_kwargs = {"echo": False, "pool_pre_ping": True}
if not BOT_DB_URL.startswith("sqlite"):
    _engine_kwargs["pool_recycle"] = 3600

engine = create_async_engine(BOT_DB_URL, **_engine_kwargs)
Session = async_sessionmaker(engine, expire_on_commit=False)


async def init_db():
    """Buat tabel bila belum ada. Tidak pernah menghapus/mengubah tabel existing."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


if __name__ == "__main__":
    import asyncio

    async def _main():
        print("BOT_DB_URL =", BOT_DB_URL)
        await init_db()
        print("init_db() selesai - tabel 'users' & 'preferences' siap.")
        await engine.dispose()

    asyncio.run(_main())
