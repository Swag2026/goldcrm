from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

import config

_is_sqlite = config.DATABASE_URL.startswith("sqlite")
engine = create_engine(
    config.DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(16), default="collector")  # admin | collector
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=config.now)


class Customer(Base):
    """GERP customer + latest balance snapshot. id = GERP customer id."""
    __tablename__ = "customers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    code: Mapped[str] = mapped_column(String(64), index=True, default="")
    name: Mapped[str] = mapped_column(String(255), default="")
    name_ar: Mapped[str] = mapped_column(String(255), default="")
    account_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    cash_debit: Mapped[float] = mapped_column(Float, default=0)
    cash_credit: Mapped[float] = mapped_column(Float, default=0)
    cash_balance: Mapped[float] = mapped_column(Float, default=0)
    gold_debit: Mapped[float] = mapped_column(Float, default=0)
    gold_credit: Mapped[float] = mapped_column(Float, default=0)
    gold_balance: Mapped[float] = mapped_column(Float, default=0)
    silver_debit: Mapped[float] = mapped_column(Float, default=0)
    silver_credit: Mapped[float] = mapped_column(Float, default=0)
    silver_balance: Mapped[float] = mapped_column(Float, default=0)
    synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # collections workflow (yeh sync se overwrite nahi hota)
    assigned_to: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | hold | legal
    notes: Mapped[str] = mapped_column(Text, default="")

    assignee: Mapped[Optional[User]] = relationship(foreign_keys=[assigned_to])


class Followup(Base):
    __tablename__ = "followups"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(16), default="call")      # call|whatsapp|visit|note|other
    outcome: Mapped[str] = mapped_column(String(16), default="other")  # reached|no_answer|promised|refused|paid|other
    note: Mapped[str] = mapped_column(Text, default="")
    next_followup_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    promise_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    promise_gold: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    promise_cash: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    promise_silver: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    promise_status: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # pending|kept|broken
    created_at: Mapped[datetime] = mapped_column(DateTime, default=config.now, index=True)

    user: Mapped[User] = relationship()


class CustomerSnapshot(Base):
    """Har customer ka roz ka (aakhri sync ka) balance: history, kal se change, paid-down yahin se nikalte hain.
    Sync balance overwrite karta hai, par purani values yahan safe rehti hain."""
    __tablename__ = "customer_snapshots"
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    cash_balance: Mapped[float] = mapped_column(Float, default=0)
    gold_balance: Mapped[float] = mapped_column(Float, default=0)
    silver_balance: Mapped[float] = mapped_column(Float, default=0)


class Snapshot(Base):
    """Roz ka total (trend chart ke liye)."""
    __tablename__ = "snapshots"
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    gold_receivable: Mapped[float] = mapped_column(Float, default=0)
    gold_payable: Mapped[float] = mapped_column(Float, default=0)
    cash_receivable: Mapped[float] = mapped_column(Float, default=0)
    cash_payable: Mapped[float] = mapped_column(Float, default=0)
    silver_receivable: Mapped[float] = mapped_column(Float, default=0)
    silver_payable: Mapped[float] = mapped_column(Float, default=0)
    debtors: Mapped[int] = mapped_column(Integer, default=0)


class Meta(Base):
    __tablename__ = "meta"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")


def init_db():
    Base.metadata.create_all(engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
