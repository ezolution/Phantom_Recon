#!/bin/bash

# Quick DigitalOcean Droplet Setup Script
# Run this on a fresh Ubuntu 22.04 droplet

set -e

echo "🚀 Setting up DigitalOcean droplet for Threat-Forge..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}Please don't run this script as root${NC}"
    echo "Run: adduser threatforge && usermod -aG sudo threatforge && su - threatforge"
    exit 1
fi

# Update system
echo -e "${YELLOW}📦 Updating system...${NC}"
sudo apt update && sudo apt upgrade -y

# Install essential packages
echo -e "${YELLOW}🛠️ Installing essential packages...${NC}"
sudo apt install -y curl wget git htop nano ufw fail2ban

# Install Docker
echo -e "${YELLOW}🐳 Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo -e "${GREEN}✅ Docker installed. Please log out and back in for group changes to take effect.${NC}"
fi

# Install Docker Compose
echo -e "${YELLOW}🔧 Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Configure firewall
echo -e "${YELLOW}🔥 Configuring firewall...${NC}"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# Configure fail2ban
echo -e "${YELLOW}🛡️ Configuring fail2ban...${NC}"
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Optimize for low memory
echo -e "${YELLOW}⚡ Optimizing for low memory...${NC}"
sudo sysctl -w vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf

# Set up swap
echo -e "${YELLOW}💾 Setting up swap...${NC}"
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Create application directory
echo -e "${YELLOW}📁 Creating application directory...${NC}"
mkdir -p ~/threat-forge
cd ~/threat-forge

# Clone repository
echo -e "${YELLOW}📥 Cloning repository...${NC}"
git clone https://github.com/ezolution/Phantom_Recon.git .

# Set up environment
echo -e "${YELLOW}⚙️ Setting up environment...${NC}"
if [ ! -f .env ]; then
    cp env.prod.example .env
    
    # Generate secrets
    SECRET_KEY=$(openssl rand -hex 32)
    JWT_SECRET_KEY=$(openssl rand -hex 32)
    POSTGRES_PASSWORD=$(openssl rand -hex 16)
    
    # Update .env file
    sed -i "s/your-secret-key-change-in-production/$SECRET_KEY/" .env
    sed -i "s/your-jwt-secret-key-change-in-production/$JWT_SECRET_KEY/" .env
    sed -i "s/your-postgres-password/$POSTGRES_PASSWORD/" .env
    
    # Get server IP
    SERVER_IP=$(curl -s ifconfig.me)
    sed -i "s/ALLOWED_ORIGINS=.*/ALLOWED_ORIGINS=http:\/\/$SERVER_IP,https:\/\/$SERVER_IP/" .env
    sed -i "s/ALLOWED_HOSTS=.*/ALLOWED_HOSTS=localhost,127.0.0.1,$SERVER_IP/" .env
    
    echo -e "${GREEN}✅ Environment configured${NC}"
else
    echo -e "${YELLOW}⚠️ .env file already exists, skipping configuration${NC}"
fi

# Make scripts executable
echo -e "${YELLOW}🔧 Making scripts executable...${NC}"
chmod +x deploy.sh
chmod +x ~/monitor.sh 2>/dev/null || true

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

echo -e "${GREEN}✅ Droplet setup completed!${NC}"
echo ""
echo -e "${GREEN}🌐 Your server IP: $SERVER_IP${NC}"
echo ""
echo -e "${GREEN}📋 Next steps:${NC}"
echo -e "1. ${YELLOW}cd ~/threat-forge${NC}"
echo -e "2. ${YELLOW}Edit .env file with your API keys:${NC}"
echo -e "   ${YELLOW}nano .env${NC}"
echo -e "3. ${YELLOW}Deploy the application:${NC}"
echo -e "   ${YELLOW}./deploy.sh${NC}"
echo -e "4. ${YELLOW}Access your portal at: http://$SERVER_IP${NC}"
echo ""
echo -e "${GREEN}🔧 Management commands:${NC}"
echo -e "   Monitor: ${YELLOW}~/monitor.sh${NC}"
echo -e "   Logs: ${YELLOW}cd ~/threat-forge && make -f Makefile.prod logs${NC}"
echo -e "   Restart: ${YELLOW}cd ~/threat-forge && make -f Makefile.prod restart${NC}"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo -e "   - Change default passwords after deployment"
echo -e "   - Configure SSL certificate for HTTPS"
echo -e "   - Set up regular backups"
echo -e "   - Monitor resource usage"
