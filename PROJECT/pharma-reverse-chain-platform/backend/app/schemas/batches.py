from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class BatchCreate(BaseModel):
    batch_number: str
    medicine_name: str
    manufacturer_name: str = "NovaGen Labs"
    expiry_date: date
    quantity: int = Field(gt=0)


class TransitionRequest(BaseModel):
    remarks: Optional[str] = None
    reason: Optional[str] = None
    resolution: Optional[str] = None
    received_quantity: Optional[int] = None


class BatchOut(BaseModel):
    id: int
    batch_number: str
    medicine_name: str
    manufacturer_name: str
    expiry_date: date
    quantity: int
    current_status: str
    created_at: datetime
    updated_at: datetime
    certificate_hash: Optional[str] = None
    certificate_filename: Optional[str] = None
    discrepancy_reason: Optional[str] = None

    class Config:
        from_attributes = True


class AuditEventOut(BaseModel):
    id: int
    batch_id: str
    event_type: str
    event_data: dict[str, Any]
    previous_hash: str
    event_hash: str
    actor_id: str
    actor_role: str
    actor_name: Optional[str] = None
    digital_signature: str
    timestamp: datetime
    hash_valid: bool = True
    signature_valid: bool = True

    class Config:
        from_attributes = True
