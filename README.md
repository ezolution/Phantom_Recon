# Threat-Forge

A BlackHat-style threat intelligence enrichment portal for email-sourced IOCs (Indicators of Compromise).

## 🚀 Features

- **Dark BlackHat Theme**: Immersive terminal-style UI with neon accents
- **CSV Upload & Validation**: Drag-and-drop CSV upload with real-time validation
- **Multi-Provider Enrichment**: Integration with VirusTotal, URLScan, CrowdStrike, Flashpoint, Recorded Future, and OSINT
- **Risk Scoring**: Automated risk and attribution scoring based on provider data
- **Search & History**: Advanced filtering and search capabilities
- **Real-time Processing**: Async enrichment pipeline with Celery workers
- **Security**: JWT authentication, rate limiting, audit logging, and input sanitization

## 🏗️ Architecture

### Backend (FastAPI)
- **API**: FastAPI with async endpoints
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Queue**: Redis with Celery for background tasks
- **Authentication**: JWT with role-based access control
- **Providers**: Modular adapter system for threat intelligence APIs

### Frontend (React)
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with custom BlackHat theme
- **State**: React Query for API state management
- **UI**: Headless UI components with Lucide icons

### Infrastructure
- **Containerization**: Docker Compose for all services
- **Proxy**: Nginx reverse proxy with rate limiting
- **Monitoring**: Health checks and structured logging

## 🛠️ Quick Start

### Prerequisites
- Docker and Docker Compose
- Make (optional, for convenience commands)

### 1. Clone and Setup
```bash
git clone <repository-url>
cd phantom-recon
cp env.example .env
```

### 2. Configure Environment
Edit `.env` file with your API keys:
```bash
# Required for full functionality
VIRUSTOTAL_API_KEY=your-virustotal-api-key
URLSCAN_API_KEY=your-urlscan-api-key

# Optional providers
CROWDSTRIKE_CLIENT_ID=your-crowdstrike-client-id
CROWDSTRIKE_CLIENT_SECRET=your-crowdstrike-client-secret
FLASHPOINT_API_KEY=your-flashpoint-api-key
RECORDED_FUTURE_API_KEY=your-recorded-future-api-key
```

### 3. Start Services
```bash
make dev-setup
```

Or manually:
```bash
docker-compose up -d
docker-compose exec api alembic upgrade head
docker-compose exec api python -m app.scripts.seed_data
```

### 4. Access the Application
- **Dashboard**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs
- **Default Credentials**:
  - Admin: `admin` / `admin123`
  - Analyst: `analyst` / `analyst123`

## 📊 Usage

### 1. Upload IOCs
1. Navigate to "Upload & Enrich" page
2. Drag and drop a CSV file or click to select
3. Configure campaign settings
4. Review validation results
5. Click "Start Enrichment"

### 2. CSV Format
Required columns:
- `ioc_value`: The indicator value
- `ioc_type`: Type (url, domain, ipv4, sha256, md5, email, subject_keyword)
- `email_id`: Email identifier
- `source_platform`: Source (EOP, Abnormal, etc.)
- `classification`: Initial classification (malicious, suspicious, benign, unknown)

Optional columns:
- `campaign_id`: Campaign identifier
- `user_reported`: Boolean flag
- `first_seen`: ISO timestamp
- `last_seen`: ISO timestamp
- `notes`: Additional notes

### 3. Search & Analyze
1. Go to "Search & History" page
2. Use filters to narrow down results
3. Click "View" on any IOC for detailed analysis
4. Review provider verdicts and risk scores

## 🔧 Development

### Project Structure
```
phantom-recon/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── core/           # Core configuration
│   │   ├── models/         # Database models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # Business logic
│   │   └── tasks/          # Celery tasks
│   ├── alembic/            # Database migrations
│   └── requirements.txt
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── contexts/       # React contexts
│   │   └── lib/            # Utilities
│   └── package.json
├── sample_data/            # Sample CSV files
├── docker-compose.yml      # Docker services
└── Makefile               # Development commands
```

### Available Commands
```bash
make up          # Start all services
make down        # Stop all services
make logs        # View logs
make seed        # Seed database
make test        # Run tests
make migrate     # Run migrations
make clean       # Clean up
make build       # Build images
```

### API Endpoints
- `POST /api/v1/upload/` - Upload CSV file
- `GET /api/v1/jobs/{job_id}` - Get job status
- `POST /api/v1/jobs/{job_id}/enrich` - Start enrichment
- `GET /api/v1/iocs/` - Search IOCs
- `GET /api/v1/iocs/{id}` - Get IOC details
- `GET /api/v1/stats/overview` - Get statistics
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user

## 🔒 Security Features

- **Authentication**: JWT tokens with role-based access
- **Rate Limiting**: Per-endpoint rate limiting
- **Input Validation**: Pydantic schemas for all inputs
- **CSRF Protection**: CSRF tokens on form submissions
- **CORS**: Restricted to portal origins
- **Audit Logging**: All actions logged with user context
- **Input Sanitization**: CSV parsing with validation
- **Security Headers**: Comprehensive security headers

## 🎯 Scoring Algorithm

Risk Score (0-100):
- Base: 0
- +15 for malicious verdict from any provider
- +5 for suspicious verdict from any provider
- +10 for agreement from ≥3 providers
- +10 if active in last 7 days
- +10 if linked to known actor/tool
- Capped at 100

Risk Bands:
- 0-24: Low
- 25-49: Medium
- 50-74: High
- 75-100: Critical

## 🔌 Provider Integrations

### VirusTotal
- **Coverage**: URLs, domains, IPs, file hashes
- **Data**: Reputation scores, detection ratios, threat classifications
- **Rate Limit**: 4 requests/minute (free tier)

### URLScan.io
- **Coverage**: URLs, domains
- **Data**: Screenshots, HTTP analysis, threat verdicts
- **Rate Limit**: 100 scans/day (free tier)

### CrowdStrike Intel
- **Coverage**: All IOC types
- **Data**: Threat actors, malware families, confidence scores
- **Authentication**: OAuth2 client credentials

### Flashpoint
- **Coverage**: All IOC types
- **Data**: Risk scores, sightings, actor attribution
- **Authentication**: API key

### Recorded Future
- **Coverage**: All IOC types
- **Data**: Risk rules, temporal analysis, entity relationships
- **Authentication**: API key

### OSINT
- **Coverage**: URLs, domains
- **Data**: HTTP status, page titles, favicon hashes
- **Rate Limit**: None (basic HTTP requests)

## 🚀 Deployment

### Production Considerations
1. **Secrets**: Use proper secret management (HashiCorp Vault, AWS Secrets Manager)
2. **SSL**: Configure SSL certificates in nginx
3. **Backup**: Set up PostgreSQL backups
4. **Monitoring**: Add application monitoring (Prometheus, Grafana)
5. **Scaling**: Use multiple Celery workers for high throughput

### Environment Variables
See `env.example` for all available configuration options.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

For issues and questions:
1. Check the documentation
2. Review existing issues
3. Create a new issue with detailed information

---

**Threat-Forge** - *BlackHat Intelligence Portal*
