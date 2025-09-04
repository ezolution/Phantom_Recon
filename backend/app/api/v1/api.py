"""
API v1 router
"""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, uploads, jobs, iocs, stats

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(uploads.router, prefix="/upload", tags=["uploads"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(iocs.router, prefix="/iocs", tags=["iocs"])
api_router.include_router(stats.router, prefix="/stats", tags=["statistics"])
