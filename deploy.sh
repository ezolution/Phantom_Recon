#!/bin/bash

# Threat-Forge DigitalOcean Deployment Script
# For 1 CPU, 1GB RAM droplet

set -e

echo "🚀 Starting Threat-Forge deployment on DigitalOcean..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}Please don't run this script as root${NC}"
    exit 1
fi

# Update system
echo -e "${YELLOW}📦 Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y

# Install Docker
echo -e "${YELLOW}🐳 Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

# Install Docker Compose
echo -e "${YELLOW}🔧 Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Install additional tools
echo -e "${YELLOW}🛠️ Installing additional tools...${NC}"
sudo apt install -y curl wget git htop

# Create application directory
echo -e "${YELLOW}📁 Setting up application directory...${NC}"
mkdir -p ~/threat-forge
cd ~/threat-forge

# Clone repository
echo -e "${YELLOW}📥 Cloning repository...${NC}"
if [ ! -d "Phantom_Recon" ]; then
    git clone https://github.com/ezolution/Phantom_Recon.git .
else
    cd Phantom_Recon
    git pull origin main
fi

# Set up environment
echo -e "${YELLOW}⚙️ Setting up environment...${NC}"
cp env.example .env

# Generate secrets
echo -e "${YELLOW}🔐 Generating secrets...${NC}"
SECRET_KEY=$(openssl rand -hex 32)
JWT_SECRET_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)

# Update .env file
sed -i "s/your-secret-key-change-in-production/$SECRET_KEY/" .env
sed -i "s/your-jwt-secret-key-change-in-production/$JWT_SECRET_KEY/" .env
sed -i "s/your-postgres-password/$POSTGRES_PASSWORD/" .env

# Set production values
sed -i "s/ENVIRONMENT=development/ENVIRONMENT=production/" .env
sed -i "s/DEBUG=true/DEBUG=false/" .env
sed -i "s/ALLOWED_ORIGINS=.*/ALLOWED_ORIGINS=http:\/\/$(curl -s ifconfig.me),https:\/\/$(curl -s ifconfig.me)/" .env
sed -i "s/ALLOWED_HOSTS=.*/ALLOWED_HOSTS=localhost,127.0.0.1,$(curl -s ifconfig.me)/" .env

# Configure system for low memory
echo -e "${YELLOW}🔧 Configuring system for low memory...${NC}"
sudo sysctl -w vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf

# Set up swap file (1GB)
echo -e "${YELLOW}💾 Setting up swap file...${NC}"
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Build and start services
echo -e "${YELLOW}🏗️ Building and starting services...${NC}"
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 30

# Run database migrations
echo -e "${YELLOW}🗄️ Running database migrations...${NC}"
docker-compose -f docker-compose.prod.yml exec -T api alembic upgrade head

# Seed database
echo -e "${YELLOW}🌱 Seeding database...${NC}"
docker-compose -f docker-compose.prod.yml exec -T api python -m app.scripts.seed_data

# Set up log rotation
echo -e "${YELLOW}📝 Setting up log rotation...${NC}"
sudo tee /etc/logrotate.d/docker > /dev/null <<EOF
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    size=1M
    missingok
    delaycompress
    copytruncate
}
EOF

# Set up monitoring script
echo -e "${YELLOW}📊 Setting up monitoring...${NC}"
cat > ~/monitor.sh << 'EOF'
#!/bin/bash
echo "=== Threat-Forge System Status ==="
echo "Memory Usage:"
free -h
echo ""
echo "Disk Usage:"
df -h
echo ""
echo "Docker Containers:"
docker-compose -f ~/threat-forge/docker-compose.prod.yml ps
echo ""
echo "Container Resource Usage:"
docker stats --no-stream
EOF
chmod +x ~/monitor.sh

# Set up auto-restart on reboot
echo -e "${YELLOW}🔄 Setting up auto-start...${NC}"
(crontab -l 2>/dev/null; echo "@reboot cd ~/threat-forge && docker-compose -f docker-compose.prod.yml up -d") | crontab -

# Get server IP
SERVER_IP=$(curl -s ifconfig.me)

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo -e "${GREEN}🌐 Access your Threat-Forge portal at:${NC}"
echo -e "   http://$SERVER_IP"
echo ""
echo -e "${GREEN}🔧 Management commands:${NC}"
echo -e "   View logs: ${YELLOW}cd ~/threat-forge && docker-compose -f docker-compose.prod.yml logs -f${NC}"
echo -e "   Restart: ${YELLOW}cd ~/threat-forge && docker-compose -f docker-compose.prod.yml restart${NC}"
echo -e "   Monitor: ${YELLOW}~/monitor.sh${NC}"
echo -e "   Stop: ${YELLOW}cd ~/threat-forge && docker-compose -f docker-compose.prod.yml down${NC}"
echo ""
echo -e "${GREEN}🔐 Default credentials:${NC}"
echo -e "   Admin: admin / admin123"
echo -e "   Analyst: analyst / analyst123"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo -e "   - Change default passwords in production"
echo -e "   - Configure SSL certificates for HTTPS"
echo -e "   - Set up regular database backups"
echo -e "   - Monitor resource usage with ~/monitor.sh"
