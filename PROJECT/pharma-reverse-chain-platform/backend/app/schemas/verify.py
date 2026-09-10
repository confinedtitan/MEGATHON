from typing import Optional

from pydantic import BaseModel


class VerifyRequest(BaseModel):
    batch_id: str
    pharmacy_id: Optional[str] = None
    pharmacy_name: Optional[str] = None
