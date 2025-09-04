"""
Simplified task processing (no Celery for now)
"""

# For now, we'll process tasks synchronously
# This can be enhanced later with Celery if needed

def process_enrichment_task(job_id: int):
    """Process enrichment task synchronously"""
    # This will be implemented in the upload endpoint
    pass
