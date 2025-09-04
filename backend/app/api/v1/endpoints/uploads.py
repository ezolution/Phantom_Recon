"""
Upload endpoints
"""

import csv
import io
from typing import Any, List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.auth import get_current_active_user
from app.models.user import User
from app.core.config import settings
from app.core.database import get_db
from app.models.upload import Upload
from app.models.job import Job, JobStatus
from app.models.ioc import IOC, IOCType, Classification
from app.schemas.upload import UploadResponse
from app.schemas.job import JobCreate

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


def validate_csv_row(row: dict, row_num: int) -> tuple[bool, str]:
    """Validate a CSV row"""
    required_fields = ["ioc_value", "ioc_type", "email_id", "source_platform", "classification"]
    
    # Check required fields
    for field in required_fields:
        if not row.get(field):
            return False, f"Missing required field: {field}"
    
    # Validate IOC type
    try:
        IOCType(row["ioc_type"])
    except ValueError:
        return False, f"Invalid IOC type: {row['ioc_type']}"
    
    # Validate classification
    try:
        Classification(row["classification"])
    except ValueError:
        return False, f"Invalid classification: {row['classification']}"
    
    return True, ""


@router.post("/", response_model=UploadResponse)
@limiter.limit("5/minute")
async def upload_csv(
    request,
    file: UploadFile = File(...),
    campaign_id: str = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Upload and validate CSV file"""
    
    # Validate file
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV"
        )
    
    if file.size > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size: {settings.MAX_UPLOAD_SIZE} bytes"
        )
    
    # Read and parse CSV
    content = await file.read()
    csv_content = content.decode('utf-8')
    csv_reader = csv.DictReader(io.StringIO(csv_content))
    
    rows = list(csv_reader)
    if len(rows) > settings.MAX_CSV_ROWS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many rows. Maximum: {settings.MAX_CSV_ROWS}"
        )
    
    # Validate rows
    rows_ok = 0
    rows_failed = 0
    valid_iocs = []
    
    for i, row in enumerate(rows, 1):
        is_valid, error = validate_csv_row(row, i)
        if is_valid:
            rows_ok += 1
            valid_iocs.append(row)
        else:
            rows_failed += 1
    
    # Create upload record
    upload = Upload(
        filename=file.filename,
        uploaded_by=current_user.id,
        rows_ok=rows_ok,
        rows_failed=rows_failed,
        total_rows=len(rows),
        file_size=file.size,
        mime_type=file.content_type or "text/csv"
    )
    
    db.add(upload)
    await db.commit()
    await db.refresh(upload)
    
    # Create IOCs
    for row in valid_iocs:
        ioc = IOC(
            value=row["ioc_value"],
            type=IOCType(row["ioc_type"]),
            classification=Classification(row["classification"]),
            source_platform=row["source_platform"],
            email_id=row.get("email_id"),
            campaign_id=campaign_id or row.get("campaign_id"),
            user_reported=row.get("user_reported", "").lower() == "true",
            notes=row.get("notes")
        )
        db.add(ioc)
    
    await db.commit()
    
    # Create job
    job = Job(
        upload_id=upload.id,
        status=JobStatus.QUEUED,
        total_iocs=rows_ok
    )
    
    db.add(job)
    await db.commit()
    await db.refresh(job)
    
    return UploadResponse(
        upload=upload,
        job_id=job.id,
        message=f"Upload successful. {rows_ok} valid rows, {rows_failed} failed rows."
    )
