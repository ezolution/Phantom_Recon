#!/bin/bash

# Simplified Deployment Script for Digital Ocean Droplet
# This script deploys the simplified version without Redis and email validation

set -e

echo "🚀 Starting simplified deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "docker-compose.simple.yml" ]; then
    print_error "docker-compose.simple.yml not found. Please run this script from the project root."
    exit 1
fi

print_status "Creating data directory for SQLite files..."
mkdir -p data

print_status "Setting up environment file..."
if [ ! -f ".env" ]; then
    cp env.simple .env
    print_warning "Created .env file from template. Please review and update the secret keys!"
else
    print_status ".env file already exists, keeping existing configuration."
fi

print_status "Stopping any existing containers..."
docker-compose -f docker-compose.simple.yml down || true

print_status "Building and starting services..."
docker-compose -f docker-compose.simple.yml up -d --build

print_status "Waiting for services to start..."
sleep 10

print_status "Checking service status..."
docker-compose -f docker-compose.simple.yml ps

print_status "Checking service logs..."
echo "=== API Logs ==="
docker-compose -f docker-compose.simple.yml logs api | tail -20

echo "=== Frontend Logs ==="
docker-compose -f docker-compose.simple.yml logs frontend | tail -10

echo "=== Nginx Logs ==="
docker-compose -f docker-compose.simple.yml logs nginx | tail -10

print_status "Testing API health..."
if curl -f http://localhost:8000/healthz > /dev/null 2>&1; then
    print_status "✅ API is healthy!"
else
    print_warning "⚠️  API health check failed. Check logs above."
fi

print_status "Testing frontend..."
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    print_status "✅ Frontend is accessible!"
else
    print_warning "⚠️  Frontend check failed. Check logs above."
fi

print_status "Testing nginx proxy..."
if curl -f http://localhost > /dev/null 2>&1; then
    print_status "✅ Nginx proxy is working!"
else
    print_warning "⚠️  Nginx proxy check failed. Check logs above."
fi

echo ""
print_status "🎉 Deployment completed!"
echo ""
print_status "Your application should be accessible at:"
echo "  - Main application: http://$(curl -s ifconfig.me)"
echo "  - API directly: http://$(curl -s ifconfig.me):8000"
echo "  - Frontend directly: http://$(curl -s ifconfig.me):3000"
echo ""
print_status "To check logs: docker-compose -f docker-compose.simple.yml logs -f"
print_status "To stop services: docker-compose -f docker-compose.simple.yml down"
print_status "To restart services: docker-compose -f docker-compose.simple.yml restart"
