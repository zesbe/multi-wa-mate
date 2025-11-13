# 🚂 Railway Deployment Guide - HalloWa.id

Panduan deploy aplikasi HalloWa.id ke Railway - Platform hosting modern dengan setup cepat dan mudah.

---

## 🎯 Mengapa Railway?

**Keuntungan:**
- ✅ Deploy otomatis from Git
- ✅ Gratis untuk start (5$ credit/month)
- ✅ Auto-scaling
- ✅ Built-in monitoring
- ✅ Easy rollback
- ✅ Environment variables management
- ✅ Automatic HTTPS

**Cocok untuk:**
- Quick deployment
- Testing & staging
- Low-maintenance hosting
- Small to medium traffic

---

## 📋 Prerequisites

1. ✅ Akun Railway ([railway.app](https://railway.app))
2. ✅ GitHub account dengan repository project
3. ✅ Akun Supabase (database)
4. ✅ Akun Upstash (Redis)

---

## 🚀 Step-by-Step Deployment

### **Step 1: Login ke Railway**

1. Go to [railway.app](https://railway.app)
2. Click **"Login with GitHub"**
3. Authorize Railway

### **Step 2: Create New Project**

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose your **HalloWa.id** repository
4. Select branch: `main` atau `master`

### **Step 3: Configure Service**

Railway akan auto-detect Node.js project.

**Project Structure:**
```
HalloWa.id/
├── railway-service/  ← Backend service (ini yang di-deploy)
└── src/              ← Frontend (deploy terpisah ke Lovable)
```

1. Service name: `hallowa-backend`
2. Root directory: `/railway-service`

### **Step 4: Add Environment Variables**

Di Railway Dashboard → Your Service → **Variables** tab:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Redis Configuration (Upstash)
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_rest_token_here

# 🆕 BullMQ Redis (TCP Connection) - PENTING!
UPSTASH_REDIS_URL=rediss://default:your_password@your-redis.upstash.io:6379

# Internal API Key (generate dengan: openssl rand -base64 32)
INTERNAL_API_KEY=your_super_secret_api_key_min_32_characters_long

# Server Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Monitoring (optional)
ADMIN_PASSWORD=your_admin_password
```

**Cara Tambah Variable:**
1. Click **"+ New Variable"**
2. Masukkan Key & Value
3. Click **"Add"**
4. Repeat untuk semua variables

### **Step 5: Configure Build Settings**

Di Railway → Service → **Settings** tab:

**Build Command:**
```bash
npm install
```

**Start Command:**
```bash
node index.js
```

**Health Check Path:**
```
/health
```

### **Step 6: Deploy**

1. Click **"Deploy"** button
2. Railway akan:
   - Clone repository
   - Install dependencies
   - Start service
3. Wait for deployment (biasanya 2-3 menit)

### **Step 7: Check Deployment Status**

Di **Deployments** tab:

```
✅ Building...
✅ Deploying...
✅ Active
```

View logs:
```
🚀 WhatsApp Baileys Service Started
📡 Using hybrid architecture: Polling + BullMQ Queue
✅ ioredis connected to Upstash
✅ BullMQ worker started
🌐 HTTP Server listening on port 3000
```

### **Step 8: Get Service URL**

Railway auto-generate URL:

```
https://hallowa-backend-production-abc123.up.railway.app
```

**Test:**
```bash
curl https://your-railway-url.railway.app/health
```

Should return:
```json
{
  "status": "ok",
  "activeConnections": 0,
  "timestamp": "2025-..."
}
```

---

## 🔧 Configuration

### **Custom Domain (Optional)**

1. Go to **Settings** → **Networking**
2. Click **"Generate Domain"** atau **"Custom Domain"**
3. Add your domain: `api.hallowa.id`
4. Add DNS record di domain registrar:
   ```
   Type: CNAME
   Name: api
   Value: your-railway-url.up.railway.app
   ```
5. Wait for DNS propagation (up to 24 hours)

### **Environment-Specific Configs**

Create multiple environments:

1. **Production**
   - Branch: `main`
   - Variables: Production values

2. **Staging** (optional)
   - Branch: `staging`
   - Variables: Staging values

---

## 📊 Monitoring

### **View Logs**

Railway Dashboard → Service → **Logs**

Filter by:
- All logs
- Error logs
- Info logs

**Download logs:**
```bash
railway logs --service hallowa-backend > logs.txt
```

### **Metrics**

Dashboard shows:
- CPU usage
- Memory usage
- Network traffic
- Request count
- Response times

### **Alerts (Optional)**

Setup alerts for:
- High memory usage (> 80%)
- High CPU usage (> 80%)
- Service crashes
- Failed deployments

---

## 🔄 Updates & Rollback

### **Auto-Deploy on Git Push**

Railway auto-deploys when you push to GitHub:

```bash
git add .
git commit -m "Update feature X"
git push origin main
```

Railway akan:
1. Detect changes
2. Build new version
3. Deploy automatically
4. Zero-downtime deployment

### **Manual Deploy**

Dashboard → **Deployments** → **"Trigger Deploy"**

### **Rollback to Previous Version**

1. Go to **Deployments** tab
2. Find previous successful deployment
3. Click **"⋮"** (3 dots)
4. Select **"Redeploy"**

---

## 💰 Pricing & Limits

### **Hobby Plan (Free)**
- $5 credit/month
- 512 MB RAM
- 1 GB disk
- Shared CPU
- 100 GB network

**Enough for:**
- Testing
- Low traffic (< 1000 requests/day)
- Development

### **Developer Plan ($20/month)**
- 8 GB RAM
- 100 GB disk
- Priority support
- More resources

**Calculator:**
```
Estimated usage:
- 512 MB RAM: ~20 devices
- 1 GB RAM: ~50 devices
- 2 GB RAM: ~100 devices
```

---

## 🛠️ Troubleshooting

### **Problem: Build Failed**

**Check logs:**
```
Railway → Deployments → Build Logs
```

**Common issues:**
1. Missing dependencies in `package.json`
2. Node version mismatch (use `"engines": { "node": "20.x" }`)
3. Build timeout (increase timeout in settings)

**Fix:**
```bash
# Update package.json
{
  "engines": {
    "node": "20.x"
  }
}

# Push changes
git commit -am "Fix build"
git push
```

### **Problem: Service Crashed**

**Check logs:**
```
Railway → Service → Logs
```

**Common causes:**
1. Environment variables not set
2. Out of memory
3. Connection to Supabase/Redis failed

**Fix:**
1. Verify all env vars are set
2. Check Supabase & Upstash status
3. Restart service: **Deployments** → **Restart**

### **Problem: High Memory Usage**

**Check metrics:**
```
Railway → Service → Metrics
```

**Fix:**
1. Upgrade plan (more RAM)
2. Optimize code (reduce memory usage)
3. Implement caching (already done!)
4. Restart service periodically

### **Problem: Slow Response**

**Possible causes:**
1. Database query slow
2. Redis connection timeout
3. Network latency

**Fix:**
1. Check Supabase performance tab
2. Use Redis caching (already implemented)
3. Check Railway region vs Supabase region
4. Consider using CDN

---

## 🔐 Security Best Practices

### **1. Environment Variables**

✅ **DO:**
- Store all secrets in Railway Variables
- Use strong passwords (min 32 chars)
- Rotate API keys regularly

❌ **DON'T:**
- Commit secrets to Git
- Share environment variables
- Use weak passwords

### **2. API Key Protection**

```bash
# Generate strong INTERNAL_API_KEY
openssl rand -base64 32
```

Store in Railway Variables, never in code.

### **3. Rate Limiting**

Already implemented:
- API rate limiting
- User rate limiting
- Redis-backed rate limits

### **4. HTTPS**

Railway automatically provides HTTPS:
```
https://your-service.railway.app ← Secure by default
```

---

## 📈 Scaling

### **Vertical Scaling (More Resources)**

1. Go to **Settings** → **Resources**
2. Adjust:
   - Memory limit
   - CPU allocation
3. Save changes
4. Service will restart automatically

### **Horizontal Scaling (Multiple Instances)**

Railway supports multiple replicas (Pro plan):

1. Go to **Settings** → **Replicas**
2. Set replica count: `2`, `3`, etc.
3. Load balancer automatically distributes traffic

**Note:** Perlu adjust concurrency settings di BullMQ untuk multiple instances.

---

## 🚀 Production Checklist

Before going to production:

- [ ] All environment variables set
- [ ] `UPSTASH_REDIS_URL` configured (for BullMQ)
- [ ] `INTERNAL_API_KEY` is strong (32+ chars)
- [ ] Health check working: `/health` returns 200
- [ ] Custom domain configured (optional)
- [ ] Monitoring & alerts setup
- [ ] Test broadcast functionality
- [ ] Test device connection
- [ ] Backup strategy in place (Supabase auto-backup)
- [ ] Rate limiting tested
- [ ] SSL/HTTPS working
- [ ] Logs review for errors

---

## 📋 Maintenance

### **Weekly Tasks**

1. Check logs for errors
   ```
   Railway → Logs (filter by Error)
   ```

2. Review metrics
   ```
   Railway → Metrics → Check CPU/Memory
   ```

3. Check deployment status
   ```
   Railway → Deployments → Latest status
   ```

### **Monthly Tasks**

1. Review billing & usage
2. Update dependencies (`npm update`)
3. Check for security updates
4. Review and optimize performance
5. Clean old deployments (auto-cleaned by Railway)

---

## 🆚 Railway vs VPS

| Feature | Railway | VPS |
|---------|---------|-----|
| **Setup Time** | 5 minutes | 1-2 hours |
| **Maintenance** | Zero | Manual updates |
| **Scaling** | Auto (click button) | Manual |
| **Cost (Small)** | $5-20/month | $7-12/month |
| **Cost (Large)** | $50-100/month | $20-50/month |
| **Control** | Limited | Full control |
| **Best For** | Quick start, low maintenance | Long-term, cost-effective |

**Recommendation:**
- Start with **Railway** untuk quick launch
- Migrate to **VPS** when scaling (500+ devices)

---

## 🔗 Related Guides

- [BullMQ Setup Guide](../BULLMQ_SETUP.md)
- [VPS Deployment Guide](./VPS_DEPLOYMENT.md) ← Recommended for production
- [CLI Session Manager](../cli/session-manager.js)

---

## 📞 Support

**Railway Support:**
- Discord: [railway.app/discord](https://railway.app/discord)
- Docs: [docs.railway.app](https://docs.railway.app)
- Status: [status.railway.app](https://status.railway.app)

**Project Support:**
- GitHub Issues
- Documentation
- Community

---

## ✅ Quick Reference

### **Deploy Commands (Railway CLI)**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy manually
railway up

# View logs
railway logs

# Open dashboard
railway open

# Add variable
railway variables set KEY=value

# Run command
railway run node cli/session-manager.js stats
```

### **Common URLs**

```
Dashboard:  https://railway.app/project/your-project-id
Service:    https://your-service.railway.app
Health:     https://your-service.railway.app/health
Logs:       railway logs
Metrics:    Dashboard → Service → Metrics
```

---

**🎉 Railway Deployment Complete!**

Your app is now running on Railway with:
- ✅ Auto-deployment from Git
- ✅ HTTPS enabled
- ✅ Environment variables configured
- ✅ Monitoring enabled
- ✅ Zero-downtime deployments
- ✅ Easy rollback

**Next Steps:**
1. Configure custom domain (optional)
2. Setup monitoring alerts
3. Test all features
4. Monitor usage & costs
5. Consider VPS for scaling (when needed)
