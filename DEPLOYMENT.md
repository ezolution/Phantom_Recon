# 🚀 DigitalOcean Deployment Guide

This guide will help you deploy Threat-Forge on a DigitalOcean droplet with 1 CPU and 1GB RAM.

## 📋 Prerequisites

- DigitalOcean account
- Domain name (optional, but recommended)
- API keys for threat intelligence providers (optional)

## 🖥️ Droplet Setup

### 1. Create Droplet

1. **Log into DigitalOcean**
2. **Create a new Droplet:**
   - **Image**: Ubuntu 22.04 LTS
   - **Size**: Basic $6/month (1 CPU, 1GB RAM, 25GB SSD)
   - **Datacenter**: Choose closest to your users
   - **Authentication**: SSH key (recommended) or password
   - **Hostname**: `threat-forge-prod`

### 2. Initial Server Setup

```bash
# Connect to your droplet
ssh root@YOUR_DROPLET_IP

# Create a non-root user
adduser threatforge
usermod -aG sudo threatforge
su - threatforge

# Update system
sudo apt update && sudo apt upgrade -y
```

## 🚀 Automated Deployment

### Option 1: Quick Deploy (Recommended)

```bash
# Download and run the deployment script
curl -fsSL https://raw.githubusercontent.com/your-repo/threat-forge/main/deploy.sh -o deploy.sh
chmod +x deploy.sh
./deploy.sh
```

### Option 2: Manual Deployment

```bash
# 1. Clone the repository
git clone https://github.com/your-repo/threat-forge.git
cd threat-forge

# 2. Set up environment
cp env.prod.example .env
nano .env  # Edit with your configuration

# 3. Deploy
make -f Makefile.prod deploy
```

## ⚙️ Configuration

### 1. Environment Variables

Edit `.env` file with your production settings:

```bash
# Required settings
SECRET_KEY=your-generated-secret-key
JWT_SECRET_KEY=your-generated-jwt-secret
POSTGRES_PASSWORD=your-secure-password

# Domain settings (replace with your domain)
ALLOWED_ORIGINS=https://yourdomain.com
ALLOWED_HOSTS=yourdomain.com

# API Keys (get from providers)
VIRUSTOTAL_API_KEY=your-virustotal-key
URLSCAN_API_KEY=your-urlscan-key
```

### 2. Generate Secrets

```bash
# Generate secure secrets
openssl rand -hex 32  # For SECRET_KEY
openssl rand -hex 32  # For JWT_SECRET_KEY
openssl rand -hex 16  # For POSTGRES_PASSWORD
```

## 🔧 Resource Optimization

The deployment is optimized for 1GB RAM:

- **PostgreSQL**: 256MB limit
- **Redis**: 64MB limit with LRU eviction
- **API**: 256MB limit
- **Worker**: 128MB limit (single worker)
- **Frontend**: 32MB limit
- **Nginx**: 32MB limit
- **Swap**: 1GB swap file

## 🌐 Domain Setup (Optional)

### 1. Point Domain to Droplet

1. **In DigitalOcean DNS:**
   - Add A record: `@` → `YOUR_DROPLET_IP`
   - Add A record: `www` → `YOUR_DROPLET_IP`

2. **Update environment:**
   ```bash
   nano .env
   # Update ALLOWED_ORIGINS and ALLOWED_HOSTS
   ```

3. **Restart services:**
   ```bash
   make -f Makefile.prod restart
   ```

### 2. SSL Certificate (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Monitoring

### 1. Check System Status

```bash
# View system resources
make -f Makefile.prod monitor

# Check service health
make -f Makefile.prod health

# View logs
make -f Makefile.prod logs
```

### 2. Resource Monitoring

```bash
# Monitor in real-time
htop

# Check disk usage
df -h

# Check memory usage
free -h

# Check Docker resources
docker stats
```

## 🔄 Maintenance

### 1. Regular Backups

```bash
# Backup database
make -f Makefile.prod backup

# Restore from backup
make -f Makefile.prod restore BACKUP_FILE=backups/threatforge_20240101_120000.sql
```

### 2. Updates

```bash
# Update application
make -f Makefile.prod update

# Or manually
git pull
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Log Management

```bash
# View specific service logs
docker-compose -f docker-compose.prod.yml logs api
docker-compose -f docker-compose.prod.yml logs worker

# Clean old logs
docker system prune -f
```

## 🚨 Troubleshooting

### Common Issues

1. **Out of Memory**
   ```bash
   # Check memory usage
   free -h
   
   # Restart services
   make -f Makefile.prod restart
   
   # Check swap
   swapon --show
   ```

2. **Database Connection Issues**
   ```bash
   # Check database status
   docker-compose -f docker-compose.prod.yml exec db pg_isready
   
   # Restart database
   docker-compose -f docker-compose.prod.yml restart db
   ```

3. **API Not Responding**
   ```bash
   # Check API health
   curl http://localhost/healthz
   
   # Restart API
   docker-compose -f docker-compose.prod.yml restart api
   ```

4. **Worker Not Processing Jobs**
   ```bash
   # Check worker logs
   docker-compose -f docker-compose.prod.yml logs worker
   
   # Restart worker
   docker-compose -f docker-compose.prod.yml restart worker
   ```

### Performance Optimization

1. **Reduce Rate Limits** (if needed):
   ```bash
   # Edit nginx.prod.conf
   nano nginx.prod.conf
   # Reduce rate limits
   ```

2. **Disable Unused Providers**:
   ```bash
   # Edit .env
   nano .env
   # Comment out unused API keys
   ```

3. **Increase Swap** (if needed):
   ```bash
   sudo fallocate -l 2G /swapfile2
   sudo chmod 600 /swapfile2
   sudo mkswap /swapfile2
   sudo swapon /swapfile2
   ```

## 🔐 Security Checklist

- [ ] Change default passwords
- [ ] Configure firewall (UFW)
- [ ] Set up SSL certificate
- [ ] Enable fail2ban
- [ ] Regular security updates
- [ ] Monitor access logs
- [ ] Backup encryption

### Firewall Setup

```bash
# Install UFW
sudo apt install ufw

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## 📈 Scaling Considerations

For higher traffic, consider:

1. **Upgrade Droplet**: 2GB RAM, 2 CPU
2. **Load Balancer**: DigitalOcean Load Balancer
3. **CDN**: CloudFlare for static assets
4. **Database**: Managed PostgreSQL
5. **Monitoring**: DigitalOcean Monitoring

## 🆘 Support

If you encounter issues:

1. Check the logs: `make -f Makefile.prod logs`
2. Monitor resources: `make -f Makefile.prod monitor`
3. Check health: `make -f Makefile.prod health`
4. Review this guide
5. Check GitHub issues

## 📞 Access Information

After successful deployment:

- **Portal**: http://YOUR_DROPLET_IP
- **API Docs**: http://YOUR_DROPLET_IP/docs
- **Default Credentials**:
  - Admin: `admin` / `admin123`
  - Analyst: `analyst` / `analyst123`

**⚠️ Important**: Change default passwords immediately after deployment!

---

**Threat-Forge** - *BlackHat Intelligence Portal*
