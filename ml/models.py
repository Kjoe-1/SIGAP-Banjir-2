#!/usr/bin/env python3
"""
models.py - Model ORM SQLAlchemy 2.0 untuk bot SIGAP Banjir.

Dua tabel, disimpan di database bot terpisah (lihat BOT_DB_URL di .env):
  - User       : data pengguna Telegram.
  - Preference : preferensi notifikasi per horizon (1/3/6/12/24 jam).

Tabel ini TIDAK ada hubungannya dengan database sensor (dbpvwemon dsb.)
yang hanya dibaca lewat prediksi.py.
"""
from sqlalchemy import BigInteger, Boolean, ForeignKey, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    chat_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)

    preference: Mapped["Preference"] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )


class Preference(Base):
    __tablename__ = "preferences"

    chat_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.chat_id", ondelete="CASCADE"), primary_key=True
    )
    notif_1h: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    notif_3h: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    notif_6h: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    notif_12h: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    notif_24h: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")

    user: Mapped["User"] = relationship(back_populates="preference")
