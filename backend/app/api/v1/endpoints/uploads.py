"""
Upload endpoints
"""

import csv
import io
from typing import Any, List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Removed authentication dependencies
from app.core.config import settings
from app.core.database import get_db
from app.models.upload import Upload
from app.models.job import Job, JobStatus
from app.models.ioc import IOC, IOCType, Classification
from app.schemas.upload import UploadResponse
from app.schemas.job import JobCreate

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


def _norm(s: str) -> str:
    return (s or '').strip().lower().replace(' ', '').replace('_', '')


def _map_row(raw: dict) -> dict:
    """Map various header aliases to canonical keys expected by the DB."""
    m = { _norm(k): v.strip() if isinstance(v, str) else v for k, v in raw.items() }

    def pick(*keys: str) -> str:
        for k in keys:
            v = m.get(_norm(k))
            if v not in (None, ''):
                return v
        return ''

    row = {
        'ioc_value': pick('ioc_value','ioc value','ioc','value','iocvalue','IOC_Value'),
        'ioc_type': pick('ioc_type','type','IOC_Type'),
        'source_platform': pick('source_platform','source','Source'),
        'classification': pick('classification','class') or 'unknown',
        'email_id': pick('email_id','email'),
        'campaign_id': pick('campaign_id','campaign','CampaignKey'),
        'first_seen': pick('first_seen','firstseen','FirstSeen'),
        'last_seen': pick('last_seen','lastseen','LastSeen'),
        'notes': pick('notes','Hits') and f"hits:{pick('notes','Hits')}" or '',
    }

    # Normalize type tokens
    t = row['ioc_type'].lower()
    if t in ('ip','ip4'): row['ioc_type'] = 'ipv4'
    elif t in ('urldomain','domain'): row['ioc_type'] = 'domain'
    elif t in ('sha-256','sha256'): row['ioc_type'] = 'sha256'
    elif t in ('link',): row['ioc_type'] = 'url'

    return row


def validate_csv_row(row: dict, row_num: int) -> tuple[bool, str]:
    """Validate a CSV row (relaxed)."""
    required_fields = ["ioc_value", "ioc_type", "source_platform"]
    
    for field in required_fields:
        if not row.get(field):
            return False, f"Missing required field: {field}"
    
    # Validate IOC type
    try:
        IOCType(row["ioc_type"])
    except ValueError:
        return False, f"Invalid IOC type: {row['ioc_type']}"
    
    # classification optional; defaulted to 'unknown'
    if row.get("classification"):
        try:
            Classification(row["classification"])
        except ValueError:
            return False, f"Invalid classification: {row['classification']}"
    
    return True, ""


@router.post("/", response_model=UploadResponse)
@limiter.limit("5/minute")
async def upload_csv(
    request: Request,
    file: UploadFile = File(...),
    campaign_id: str = Form(None),
    default_classification: str = Form('unknown'),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Upload and validate CSV file"""
    
    # Validate file
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV"
        )
    
    # Read and parse CSV
    content = await file.read()
    content_len = len(content)
    if content_len > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size: {settings.MAX_UPLOAD_SIZE} bytes"
        )
    csv_content = content.decode('utf-8')
    csv_reader = csv.DictReader(io.StringIO(csv_content))
    
    raw_rows = list(csv_reader)
    if len(raw_rows) > settings.MAX_CSV_ROWS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many rows. Maximum: {settings.MAX_CSV_ROWS}"
        )
    
    # Map and validate rows
    rows_ok = 0
    rows_failed = 0
    valid_iocs = []
    
    for i, raw in enumerate(raw_rows, 1):
        row = _map_row(raw)
        is_valid, error = validate_csv_row(row, i)
        if is_valid:
            rows_ok += 1
            valid_iocs.append(row)
        else:
            rows_failed += 1
    
    # Create upload record
    upload = Upload(
        filename=file.filename,
        uploaded_by=1,  # Default system user
        rows_ok=rows_ok,
        rows_failed=rows_failed,
        total_rows=len(raw_rows),
        file_size=content_len,
        mime_type=file.content_type or "text/csv"
    )
    
    db.add(upload)
    await db.commit()
    await db.refresh(upload)
    
    # Create IOCs
    for row in valid_iocs:
        cls = row.get("classification") or default_classification or 'unknown'
        ioc = IOC(
            value=row["ioc_value"],
            type=IOCType(row["ioc_type"]),
            classification=Classification(cls),
            source_platform=row["source_platform"],
            email_id=row.get("email_id") or None,
            campaign_id=campaign_id or row.get("campaign_id") or None,
            user_reported=(row.get("user_reported","" ).lower() == "true"),
            notes=row.get("notes") or None
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
