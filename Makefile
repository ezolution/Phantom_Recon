# Threat-Forge Makefile

.PHONY: help up down logs seed test migrate clean build

# Default target
help:
	@echo "Threat-Forge Development Commands:"
	@echo ""
	@echo "  make up          - Start all services"
	@echo "  make down        - Stop all services"
	@echo "  make logs        - View logs from all services"
	@echo "  make seed        - Seed database with sample data"
	@echo "  make test        - Run tests"
	@echo "  make migrate     - Run database migrations"
	@echo "  make clean       - Clean up containers and volumes"
	@echo "  make build       - Build all Docker images"
	@echo ""

# Start all services
up:
	docker-compose up -d
	@echo "🚀 Threat-Forge is starting up..."
	@echo "📊 Dashboard: http://localhost:3000"
	@echo "🔧 API Docs: http://localhost:8000/docs"
	@echo "🗄️  Database: localhost:5432"
	@echo "📦 Redis: localhost:6379"

# Stop all services
down:
	docker-compose down
	@echo "🛑 Threat-Forge stopped"

# View logs
logs:
	docker-compose logs -f

# Seed database
seed:
	docker-compose exec api python -m app.scripts.seed_data
	@echo "🌱 Database seeded with sample data"

# Run tests
test:
	docker-compose exec api pytest
	@echo "✅ Tests completed"

# Run migrations
migrate:
	docker-compose exec api alembic upgrade head
	@echo "🗄️  Database migrations completed"

# Clean up
clean:
	docker-compose down -v --remove-orphans
	docker system prune -f
	@echo "🧹 Cleanup completed"

# Build images
build:
	docker-compose build
	@echo "🔨 Docker images built"

# Development setup
dev-setup: build up migrate seed
	@echo "🎯 Development environment ready!"
	@echo "📊 Dashboard: http://localhost:3000"
	@echo "🔧 API Docs: http://localhost:8000/docs"
	@echo ""
	@echo "Default credentials:"
	@echo "  Admin: admin / admin123"
	@echo "  Analyst: analyst / analyst123"

# Production setup
prod-setup: build up migrate
	@echo "🚀 Production environment ready!"
	@echo "⚠️  Remember to:"
	@echo "  1. Update .env with production secrets"
	@echo "  2. Configure SSL certificates"
	@echo "  3. Set up proper backup strategy"
