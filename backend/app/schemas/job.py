"""
Job schemas
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class JobStatus(str, Enum):
    """Job status enumeration"""
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    ERROR = "error"


class JobBase(BaseModel):
    """Base job schema"""
    upload_id: int


class JobCreate(JobBase):
    """Job creation schema"""
    pass


class Job(JobBase):
    """Job response schema"""
    id: int
    status: JobStatus
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error_message: Optional[str] = None
    total_iocs: int
    processed_iocs: int
    successful_iocs: int
    failed_iocs: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class JobSummary(BaseModel):
    """Job summary with progress metrics"""
    job: Job
    progress_percentage: float
    estimated_completion: Optional[datetime] = None
