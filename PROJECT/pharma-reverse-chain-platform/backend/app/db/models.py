"""SQLAlchemy models. There is NO blockchain — audit_events is a normal
PostgreSQL table treated as append-only by the application."""

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)


from app.db.database import Base


class MedicineBatch(Base):
    __tablename__ = "medicine_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String(100), unique=True, nullable=False, index=True)
    medicine_name = Column(String(255), nullable=False)
    manufacturer_name = Column(String(255), nullable=False, default="NovaGen Labs")
    expiry_date = Column(Date, nullable=False)
    quantity = Column(Integer, nullable=False)
    current_status = Column(String(50), nullable=False, default="ACTIVE", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    certificate_hash = Column(String(64), nullable=True)
    certificate_filename = Column(String(255), nullable=True)
    discrepancy_reason = Column(Text, nullable=True)


class AuditEvent(Base):
    """Cryptographic audit ledger (append-only hash chain in PostgreSQL)."""

    __tablename__ = "audit_events"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    batch_id = Column(String(100), nullable=False, index=True)
    event_type = Column(String(100), nullable=False)
    event_data = Column(JSON, nullable=False, default=dict)
    previous_hash = Column(String(64), nullable=False, index=True)
    event_hash = Column(String(64), nullable=False, index=True)
    actor_id = Column(String(100), nullable=False)
    actor_role = Column(String(50), nullable=False)
    digital_signature = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)


class FraudAlert(Base):
    __tablename__ = "fraud_alerts"

    alert_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    batch_number = Column(String(100), nullable=False, index=True)
    pharmacy_name = Column(String(255), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    batch_status = Column(String(50), nullable=False)


class Actor(Base):
    __tablename__ = "actors"

    id = Column(Integer, primary_key=True, index=True)
    # Logical stakeholder id used for signing, e.g. PHARMACY_001
    actor_id = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)
    location = Column(String(255), nullable=False, default="—")
    # Public verification key ONLY. Private keys are never stored here.
    public_key = Column(Text, nullable=True)


class User(Base):
    """Login users for JWT role-based sessions. Linked to an Actor."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)  # Pharmacy | Distributor | Manufacturer | Regulator
    actor_id = Column(String(100), ForeignKey("actors.actor_id"), nullable=False)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
