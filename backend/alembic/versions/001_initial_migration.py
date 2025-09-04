"""Initial migration

Revision ID: 0001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=100), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=100), nullable=True),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # Create uploads table
    op.create_table('uploads',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('uploaded_by', sa.Integer(), nullable=False),
        sa.Column('rows_ok', sa.Integer(), nullable=False),
        sa.Column('rows_failed', sa.Integer(), nullable=False),
        sa.Column('total_rows', sa.Integer(), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_uploads_id'), 'uploads', ['id'], unique=False)

    # Create jobs table
    op.create_table('jobs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('upload_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('total_iocs', sa.Integer(), nullable=False),
        sa.Column('processed_iocs', sa.Integer(), nullable=False),
        sa.Column('successful_iocs', sa.Integer(), nullable=False),
        sa.Column('failed_iocs', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['upload_id'], ['uploads.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_jobs_id'), 'jobs', ['id'], unique=False)

    # Create iocs table
    op.create_table('iocs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('value', sa.String(length=500), nullable=False),
        sa.Column('type', sa.String(length=20), nullable=False),
        sa.Column('classification', sa.String(length=20), nullable=False),
        sa.Column('source_platform', sa.String(length=50), nullable=False),
        sa.Column('email_id', sa.String(length=100), nullable=True),
        sa.Column('campaign_id', sa.String(length=100), nullable=True),
        sa.Column('user_reported', sa.Boolean(), nullable=False),
        sa.Column('first_seen', sa.DateTime(), nullable=True),
        sa.Column('last_seen', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_iocs_id'), 'iocs', ['id'], unique=False)
    op.create_index(op.f('ix_iocs_value'), 'iocs', ['value'], unique=False)
    op.create_index(op.f('ix_iocs_type'), 'iocs', ['type'], unique=False)

    # Create tags table
    op.create_table('tags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('kind', sa.String(length=20), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tags_id'), 'tags', ['id'], unique=False)
    op.create_index(op.f('ix_tags_name'), 'tags', ['name'], unique=False)
    op.create_index(op.f('ix_tags_kind'), 'tags', ['kind'], unique=False)

    # Create ioc_tags association table
    op.create_table('ioc_tags',
        sa.Column('ioc_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['ioc_id'], ['iocs.id'], ),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ),
        sa.PrimaryKeyConstraint('ioc_id', 'tag_id')
    )

    # Create ioc_scores table
    op.create_table('ioc_scores',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ioc_id', sa.Integer(), nullable=False),
        sa.Column('risk_score', sa.Integer(), nullable=False),
        sa.Column('attribution_score', sa.Integer(), nullable=False),
        sa.Column('risk_band', sa.String(length=20), nullable=False),
        sa.Column('computed_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['ioc_id'], ['iocs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ioc_scores_id'), 'ioc_scores', ['id'], unique=False)
    op.create_index(op.f('ix_ioc_scores_risk_score'), 'ioc_scores', ['risk_score'], unique=False)
    op.create_index(op.f('ix_ioc_scores_risk_band'), 'ioc_scores', ['risk_band'], unique=False)

    # Create enrichment_results table
    op.create_table('enrichment_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ioc_id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('raw_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('verdict', sa.String(length=20), nullable=False),
        sa.Column('first_seen', sa.DateTime(), nullable=True),
        sa.Column('last_seen', sa.DateTime(), nullable=True),
        sa.Column('actor', sa.String(length=200), nullable=True),
        sa.Column('family', sa.String(length=200), nullable=True),
        sa.Column('confidence', sa.Integer(), nullable=True),
        sa.Column('evidence', sa.Text(), nullable=True),
        sa.Column('http_status', sa.Integer(), nullable=True),
        sa.Column('queried_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['ioc_id'], ['iocs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_enrichment_results_id'), 'enrichment_results', ['id'], unique=False)
    op.create_index(op.f('ix_enrichment_results_provider'), 'enrichment_results', ['provider'], unique=False)

    # Create audit_logs table
    op.create_table('audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('actor_user', sa.Integer(), nullable=False),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('target_type', sa.String(length=50), nullable=True),
        sa.Column('target_id', sa.Integer(), nullable=True),
        sa.Column('meta_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['actor_user'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_id'), 'audit_logs', ['id'], unique=False)
    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_target_type'), 'audit_logs', ['target_type'], unique=False)


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('enrichment_results')
    op.drop_table('ioc_scores')
    op.drop_table('ioc_tags')
    op.drop_table('tags')
    op.drop_table('iocs')
    op.drop_table('jobs')
    op.drop_table('uploads')
    op.drop_table('users')
