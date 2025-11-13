# 🖥️ VPS Deployment Guide - HalloWa.id (Priority)

Panduan lengkap untuk deploy aplikasi HalloWa.id ke VPS (Virtual Private Server) pribadi. Guide ini cocok untuk production jangka panjang dengan kontrol penuh.

---

## 📋 Daftar Isi

1. [Requirement VPS](#requirement-vps)
2. [Persiapan Awal](#persiapan-awal)
3. [Instalasi Dependencies](#instalasi-dependencies)
4. [Setup Database & Redis](#setup-database--redis)
5. [Clone & Configure Project](#clone--configure-project)
6. [Setup Process Manager (PM2)](#setup-process-manager-pm2)
7. [Setup Nginx Reverse Proxy](#setup-nginx-reverse-proxy)
8. [Setup SSL Certificate (HTTPS)](#setup-ssl-certificate-https)
9. [Monitoring & Maintenance](#monitoring--maintenance)
10. [Troubleshooting](#troubleshooting)

---

## 🔧 Requirement VPS

### **Minimum Specs:**
- **CPU**: 2 vCPU (4 vCPU recommended)
- **RAM**: 2GB (4GB recommended untuk production)
- **Storage**: 20GB SSD
- **OS**: Ubuntu 20.04 LTS atau 22.04 LTS (recommended)
- **Network**: Port 80, 443, 3000 terbuka

### **Recommended VPS Providers:**
- DigitalOcean (Droplet $12/month)
- Vultr ($12/month)
- Linode ($12/month)
- Contabo ($7/month - value for money)
- Hetzner Cloud (€4.5/month - EU region)

---

## 🚀 Persiapan Awal

### **1. Login ke VPS**

```bash
ssh root@your-vps-ip
```

### **2. Update System**

```bash
apt update && apt upgrade -y
```

### **3. Create Non-Root User (Security Best Practice)**

```bash
# Create user
adduser hallowa

# Add to sudo group
usermod -aG sudo hallowa

# Switch to new user
su - hallowa
```

### **4. Setup Firewall (UFW)**

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow ssh
sudo ufw allow 22/tcp

# Allow HTTP & HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow Node.js app port (optional, jika direct access)
sudo ufw allow 3000/tcp

# Check status
sudo ufw status
```

---

## 📦 Instalasi Dependencies

### **1. Install Node.js 20.x LTS**

```bash
# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version
```

### **2. Install Git**

```bash
sudo apt install -y git
git --version
```

### **3. Install PM2 (Process Manager)**

```bash
sudo npm install -g pm2

# Verify installation
pm2 --version
```

### **4. Install Nginx (Web Server)**

```bash
sudo apt install -y nginx

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

### **5. Install Certbot (untuk SSL/HTTPS)**

```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## 🗄️ Setup Database & Redis

### **Option A: Managed Services (Recommended)**

Gunakan managed services untuk production:

1. **Database**: Supabase (sudah ada)
   - Tidak perlu install PostgreSQL lokal
   - Akses via `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`

2. **Redis**: Upstash (sudah ada)
   - Tidak perlu install Redis lokal
   - Akses via `UPSTASH_REDIS_URL` dan REST API

**Keuntungan:**
- ✅ Managed, automatic backups
- ✅ High availability
- ✅ Easy scaling
- ✅ No maintenance overhead

---

### **Option B: Self-Hosted (Advanced)**

Jika ingin host database sendiri:

#### **Install PostgreSQL:**

```bash
# Install PostgreSQL 14
sudo apt install -y postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database
sudo -u postgres psql
```

```sql
-- Di PostgreSQL console
CREATE DATABASE hallowa;
CREATE USER hallowa_user WITH PASSWORD 'your_strong_password';
GRANT ALL PRIVILEGES ON DATABASE hallowa TO hallowa_user;
\q
```

#### **Install Redis:**

```bash
# Install Redis
sudo apt install -y redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
# Ubah: supervised systemd

# Restart Redis
sudo systemctl restart redis
sudo systemctl enable redis

# Test connection
redis-cli ping  # Should return PONG
```

---

## 📁 Clone & Configure Project

### **1. Clone Repository**

```bash
# Navigate to home directory
cd ~

# Clone project
git clone https://github.com/your-username/HalloWa.id.git
cd HalloWa.id/railway-service

# Install dependencies
npm install
```

### **2. Create Environment File**

```bash
# Copy example env
cp .env.example .env

# Edit env file
nano .env
```

**Isi .env dengan:**

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Redis Configuration (Upstash)
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_rest_token_here

# BullMQ Redis (TCP Connection)
UPSTASH_REDIS_URL=rediss://default:your_password@your-redis.upstash.io:6379

# Internal API Key (generate random string min 32 chars)
INTERNAL_API_KEY=your_super_secret_api_key_min_32_characters_long

# Server Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Monitoring (optional)
MONITORING_PORT=3001
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_admin_password_here
```

**Generate random INTERNAL_API_KEY:**

```bash
openssl rand -base64 32
```

### **3. Test Run**

```bash
# Test if app starts
node index.js

# Should see:
# 🚀 WhatsApp Baileys Service Started
# 📡 Using hybrid architecture: Polling + BullMQ Queue
# ✅ ioredis connected to Upstash (TCP native protocol)
# ✅ BullMQ worker started
```

Jika berhasil, tekan `Ctrl+C` untuk stop.

---

## 🔄 Setup Process Manager (PM2)

PM2 akan keep aplikasi tetap running, auto-restart on crash, dan restart on reboot.

### **1. Create PM2 Ecosystem File**

```bash
nano ecosystem.config.js
```

**Isi dengan:**

```javascript
module.exports = {
  apps: [
    {
      name: 'hallowa-baileys',
      script: 'index.js',
      cwd: '/home/hallowa/HalloWa.id/railway-service',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
    },
    {
      name: 'hallowa-monitoring',
      script: 'monitoring/dashboard-server.js',
      cwd: '/home/hallowa/HalloWa.id/railway-service',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        MONITORING_PORT: 3001,
      },
      error_file: './logs/monitoring-err.log',
      out_file: './logs/monitoring-out.log',
    },
  ],
};
```

### **2. Create Logs Directory**

```bash
mkdir -p logs
```

### **3. Start with PM2**

```bash
# Start application
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs hallowa-baileys

# Monitor in real-time
pm2 monit
```

### **4. Setup PM2 Startup Script**

```bash
# Generate startup script
pm2 startup systemd

# COPY dan RUN command yang muncul (something like):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u hallowa --hp /home/hallowa

# Save PM2 process list
pm2 save
```

**Test restart:**

```bash
# Reboot VPS
sudo reboot

# After reboot, login dan check
pm2 status  # Should show apps running
```

---

## 🌐 Setup Nginx Reverse Proxy

Nginx akan handle HTTP/HTTPS requests dan forward ke Node.js app.

### **1. Create Nginx Config**

```bash
sudo nano /etc/nginx/sites-available/hallowa
```

**Isi dengan:**

```nginx
# Rate limiting zone
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/m;
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=60r/m;

# Upstream servers
upstream hallowa_backend {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

upstream hallowa_monitoring {
    server 127.0.0.1:3001;
}

# Main server block
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Logs
    access_log /var/log/nginx/hallowa_access.log;
    error_log /var/log/nginx/hallowa_error.log;

    # Main backend proxy
    location / {
        proxy_pass http://hallowa_backend;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Rate limiting for general endpoints
        limit_req zone=general_limit burst=10 nodelay;
    }

    # API endpoints with stricter rate limiting
    location /api/ {
        proxy_pass http://hallowa_backend;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Strict rate limiting for API
        limit_req zone=api_limit burst=5 nodelay;
    }

    # Monitoring dashboard (optional - restrict by IP)
    location /admin/queues {
        proxy_pass http://hallowa_monitoring;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # Restrict access by IP (uncomment and add your IP)
        # allow 123.456.789.0;  # Your IP
        # deny all;
    }

    # Health check endpoint (no rate limiting)
    location /health {
        proxy_pass http://hallowa_backend;
        access_log off;
    }
}
```

### **2. Enable Site**

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/hallowa /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### **3. Test Domain**

```bash
# Point your domain to VPS IP first (A record)
# Then test:
curl http://your-domain.com/health
```

---

## 🔒 Setup SSL Certificate (HTTPS)

### **1. Install SSL with Certbot**

```bash
# Run certbot
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow prompts:
# - Enter email
# - Agree to terms
# - Choose: Redirect HTTP to HTTPS (option 2)
```

### **2. Verify SSL**

```bash
# Check SSL certificate
sudo certbot certificates

# Test HTTPS
curl https://your-domain.com/health
```

### **3. Auto-Renewal**

Certbot automatically sets up auto-renewal. Test it:

```bash
# Dry run renewal
sudo certbot renew --dry-run

# Should show: Congratulations, all renewals succeeded
```

---

## 📊 Monitoring & Maintenance

### **1. PM2 Commands**

```bash
# View logs
pm2 logs hallowa-baileys
pm2 logs hallowa-baileys --lines 100

# Monitor resources
pm2 monit

# Restart app
pm2 restart hallowa-baileys

# Stop app
pm2 stop hallowa-baileys

# Reload without downtime
pm2 reload hallowa-baileys
```

### **2. Check System Resources**

```bash
# CPU and memory
htop

# Disk usage
df -h

# Network connections
netstat -tulpn | grep :3000
```

### **3. View Nginx Logs**

```bash
# Access logs
sudo tail -f /var/log/nginx/hallowa_access.log

# Error logs
sudo tail -f /var/log/nginx/hallowa_error.log
```

### **4. Database Monitoring**

Use CLI tool:

```bash
cd ~/HalloWa.id/railway-service

# Show stats
node cli/session-manager.js stats

# List devices
node cli/session-manager.js list
```

### **5. Queue Monitoring**

Access BullBoard dashboard:
```
https://your-domain.com/admin/queues
```

---

## 🔄 Update & Deployment

### **1. Pull Latest Changes**

```bash
cd ~/HalloWa.id
git pull origin main

cd railway-service
npm install  # Install new dependencies if any
```

### **2. Restart Services**

```bash
# Reload PM2 (zero-downtime restart)
pm2 reload ecosystem.config.js

# Or restart
pm2 restart all
```

### **3. Verify**

```bash
pm2 status
pm2 logs --lines 50
curl https://your-domain.com/health
```

---

## 🛡️ Security Best Practices

### **1. Setup Fail2Ban (Prevent brute force)**

```bash
# Install fail2ban
sudo apt install -y fail2ban

# Configure
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local

# Enable SSH protection
# Find [sshd] section and set:
# enabled = true
# maxretry = 3
# bantime = 3600

# Restart fail2ban
sudo systemctl restart fail2ban
sudo systemctl enable fail2ban
```

### **2. Setup Automatic Updates**

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

### **3. Disable Root Login**

```bash
sudo nano /etc/ssh/sshd_config

# Change:
# PermitRootLogin no
# PasswordAuthentication no  # If using SSH keys

sudo systemctl restart sshd
```

---

## ⚠️ Troubleshooting

### **Problem: App Not Starting**

```bash
# Check PM2 logs
pm2 logs hallowa-baileys --err

# Check if port is already in use
sudo lsof -i :3000

# Check environment variables
cat .env
```

### **Problem: Can't Connect to Database**

```bash
# Test Supabase connection
curl https://your-project.supabase.co

# Check firewall
sudo ufw status

# Check env variables
grep SUPABASE .env
```

### **Problem: High Memory Usage**

```bash
# Check memory
free -h

# Restart PM2
pm2 restart all

# Adjust max memory in ecosystem.config.js
max_memory_restart: '800M'  # Lower limit
```

### **Problem: SSL Certificate Issues**

```bash
# Renew certificate
sudo certbot renew

# Check certificate
sudo certbot certificates

# Test SSL
curl -I https://your-domain.com
```

---

## 📋 Maintenance Checklist (Weekly)

- [ ] Check PM2 app status: `pm2 status`
- [ ] View logs for errors: `pm2 logs --lines 100`
- [ ] Check disk space: `df -h`
- [ ] Check memory usage: `free -h`
- [ ] Update system packages: `sudo apt update && sudo apt upgrade`
- [ ] Check Nginx logs: `sudo tail -100 /var/log/nginx/hallowa_error.log`
- [ ] Monitor queue health via BullBoard dashboard
- [ ] Check device connection status via CLI

---

## 🎓 Next Steps

1. ✅ Setup monitoring alerts (email/Telegram on errors)
2. ✅ Configure database backups
3. ✅ Setup CDN for static assets (optional)
4. ✅ Implement rate limiting at Nginx level
5. ✅ Setup log rotation
6. ✅ Configure monitoring dashboard (Grafana + Prometheus)

---

## 📞 Support

Jika ada masalah:
1. Check PM2 logs: `pm2 logs`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/hallowa_error.log`
3. Check system logs: `sudo journalctl -xe`
4. Search GitHub issues
5. Contact support

---

**🎉 Deployment Complete!**

Aplikasi sekarang running di VPS dengan:
- ✅ Production-ready configuration
- ✅ Auto-restart on crash
- ✅ HTTPS enabled
- ✅ Reverse proxy configured
- ✅ Monitoring enabled
- ✅ Secure firewall setup

**Access Points:**
- Main App: `https://your-domain.com`
- Health Check: `https://your-domain.com/health`
- Queue Dashboard: `https://your-domain.com/admin/queues`
