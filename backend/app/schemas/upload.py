"""
Upload schemas
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UploadBase(BaseModel):
    """Base upload schema"""
    filename: str
    file_size: int
    mime_type: str


class UploadCreate(UploadBase):
    """Upload creation schema"""
    pass


class Upload(UploadBase):
    """Upload response schema"""
    id: int
    uploaded_by: int
    rows_ok: int
    rows_failed: int
    total_rows: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class UploadResponse(BaseModel):
    """Upload response with job info"""
    upload: Upload
    job_id: int
    message: str
