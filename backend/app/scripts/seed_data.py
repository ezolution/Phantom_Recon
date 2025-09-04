"""
Seed data script for initial setup
"""

import asyncio
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from app.models.ioc import IOC, IOCType, Classification
from app.models.tag import Tag, TagKind
from app.models.ioc import IOC_Tag


async def create_default_users(db: AsyncSession):
    """Create default users"""
    
    # Create admin user
    admin_user = User(
        username="admin",
        email="admin@threatforge.local",
        hashed_password=get_password_hash("admin123"),
        full_name="System Administrator",
        role="admin",
        is_active=True
    )
    
    # Create analyst user
    analyst_user = User(
        username="analyst",
        email="analyst@threatforge.local",
        hashed_password=get_password_hash("analyst123"),
        full_name="Threat Analyst",
        role="analyst",
        is_active=True
    )
    
    db.add(admin_user)
    db.add(analyst_user)
    await db.commit()
    
    print("✓ Created default users")
    return admin_user, analyst_user


async def create_sample_tags(db: AsyncSession):
    """Create sample tags"""
    
    tags = [
        # Actor tags
        Tag(name="APT29", kind=TagKind.ACTOR, description="Cozy Bear"),
        Tag(name="APT28", kind=TagKind.ACTOR, description="Fancy Bear"),
        Tag(name="Lazarus", kind=TagKind.ACTOR, description="North Korean APT"),
        
        # Family tags
        Tag(name="Cobalt Strike", kind=TagKind.FAMILY, description="Commercial C2 framework"),
        Tag(name="Mimikatz", kind=TagKind.FAMILY, description="Credential dumping tool"),
        Tag(name="Emotet", kind=TagKind.FAMILY, description="Banking trojan"),
        
        # TTP tags
        Tag(name="T1055", kind=TagKind.TTP, description="Process Injection"),
        Tag(name="T1083", kind=TagKind.TTP, description="File and Directory Discovery"),
        Tag(name="T1071", kind=TagKind.TTP, description="Application Layer Protocol"),
        
        # Campaign tags
        Tag(name="SolarWinds", kind=TagKind.CAMPAIGN, description="Supply chain attack"),
        Tag(name="NotPetya", kind=TagKind.CAMPAIGN, description="Destructive malware"),
        
        # Label tags
        Tag(name="High Value Target", kind=TagKind.LABEL, description="Targeted attack"),
        Tag(name="Financial", kind=TagKind.LABEL, description="Financial sector focus"),
    ]
    
    for tag in tags:
        db.add(tag)
    
    await db.commit()
    print("✓ Created sample tags")
    return tags


async def create_sample_iocs(db: AsyncSession):
    """Create sample IOCs"""
    
    iocs = [
        # URLs
        IOC(
            value="https://malicious-site.com/payload.exe",
            type=IOCType.URL,
            classification=Classification.MALICIOUS,
            source_platform="EOP",
            email_id="phish-001",
            campaign_id="campaign-001",
            user_reported=True,
            notes="Phishing email attachment"
        ),
        IOC(
            value="https://suspicious-domain.net/login",
            type=IOCType.URL,
            classification=Classification.SUSPICIOUS,
            source_platform="Abnormal",
            email_id="susp-002",
            campaign_id="campaign-002",
            user_reported=False,
            notes="Suspicious login page"
        ),
        
        # Domains
        IOC(
            value="evil-domain.com",
            type=IOCType.DOMAIN,
            classification=Classification.MALICIOUS,
            source_platform="EOP",
            email_id="phish-003",
            campaign_id="campaign-001",
            user_reported=True,
            notes="C2 domain"
        ),
        IOC(
            value="legitimate-site.org",
            type=IOCType.DOMAIN,
            classification=Classification.BENIGN,
            source_platform="Abnormal",
            email_id="benign-001",
            campaign_id="campaign-003",
            user_reported=False,
            notes="Legitimate website"
        ),
        
        # IPs
        IOC(
            value="192.168.1.100",
            type=IOCType.IPV4,
            classification=Classification.SUSPICIOUS,
            source_platform="EOP",
            email_id="susp-004",
            campaign_id="campaign-002",
            user_reported=False,
            notes="Suspicious IP"
        ),
        
        # Hashes
        IOC(
            value="a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
            type=IOCType.SHA256,
            classification=Classification.MALICIOUS,
            source_platform="EOP",
            email_id="mal-001",
            campaign_id="campaign-001",
            user_reported=True,
            notes="Malicious executable"
        ),
        IOC(
            value="1234567890abcdef1234567890abcdef",
            type=IOCType.MD5,
            classification=Classification.SUSPICIOUS,
            source_platform="Abnormal",
            email_id="susp-005",
            campaign_id="campaign-002",
            user_reported=False,
            notes="Suspicious file"
        ),
        
        # Emails
        IOC(
            value="attacker@evil-domain.com",
            type=IOCType.EMAIL,
            classification=Classification.MALICIOUS,
            source_platform="EOP",
            email_id="phish-006",
            campaign_id="campaign-001",
            user_reported=True,
            notes="Phishing sender"
        ),
        
        # Subject keywords
        IOC(
            value="urgent payment required",
            type=IOCType.SUBJECT_KEYWORD,
            classification=Classification.SUSPICIOUS,
            source_platform="EOP",
            email_id="phish-007",
            campaign_id="campaign-001",
            user_reported=True,
            notes="Phishing subject line"
        ),
    ]
    
    for ioc in iocs:
        db.add(ioc)
    
    await db.commit()
    print("✓ Created sample IOCs")
    return iocs


async def main():
    """Main seed function"""
    print("🌱 Seeding Threat-Forge database...")
    
    async with AsyncSessionLocal() as db:
        # Create users
        admin_user, analyst_user = await create_default_users(db)
        
        # Create tags
        tags = await create_sample_tags(db)
        
        # Create IOCs
        iocs = await create_sample_iocs(db)
        
        print("✅ Database seeded successfully!")
        print("\nDefault users created:")
        print("  Admin: admin / admin123")
        print("  Analyst: analyst / analyst123")


if __name__ == "__main__":
    asyncio.run(main())
