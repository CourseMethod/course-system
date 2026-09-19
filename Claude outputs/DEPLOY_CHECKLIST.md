# 🚀 Course System Deployment Checklist

## What We Fixed
✅ Updated `backend/package.json` to auto-build vault on deploy  
✅ Stripe keys: already configured  
✅ Vercel account: already active  
❌ Railway account: **YOU NEED TO CREATE THIS**

---

## CRITICAL: You're Currently Trying Wrong Platform

**Current state:** Trying to deploy backend to Vercel  
**Problem:** Vercel = serverless, no persistent filesystem → your customer database disappears on each deploy  
**Solution:** Deploy backend to Railway (has persistent storage), keep frontend on Vercel

---

## Step-by-Step Deployment (30 minutes)

### Phase 1: Setup (You do this)

1. **Create Railway Account** (5 min)
   - Go to: https://railway.app
   - Click "Deploy"
   - Sign in with GitHub (create account if needed)
   - Authorize Railway access to your repos

2. **Push Code to GitHub** (5 min)
   ```bash
   cd your-project-folder
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/course-system.git
   git branch -M main
   git push -u origin main
   ```

### Phase 2: Railway Configuration (5 min)

3. **Create Railway Project from GitHub**
   - Railway Dashboard → New Project → Deploy from GitHub
   - Select your repository
   - Wait for detection (should auto-detect Node.js)
   - Click "Deploy"

4. **Configure Root Directory**
   - Service Settings → Root Directory
   - Set to: `backend`
   - Save

5. **Add Persistent Storage (DO NOT SKIP)**
   - Service Settings → Volumes
   - Add Volume:
     - Mount path: `/data`
     - Save

6. **Set Environment Variables**
   - Variables tab
   - Add each line from your `backend/.env.local`:
     ```
     STRIPE_SECRET_KEY=sk_test_xxxxx
     STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
     STRIPE_WEBHOOK_SECRET=whsec_xxxxx
     ADMIN_TOKEN=temptoken12345678901234567890
     TOKEN_SECRET=temptoken12345678901234567890
     PUBLIC_URL=https://YOUR_APP.up.railway.app
     EMAIL_TRANSPORT=gmail
     GMAIL_USER=your-email@gmail.com
     GMAIL_APP_PASSWORD=temp
     ```
   - Add production overrides:
     ```
     NODE_ENV=production
     DATABASE_PATH=/data/course-printer.db
     CORS_ORIGINS=https://YOUR_APP.up.railway.app
     LOG_JSON=true
     ```

7. **Get Your Railway URL**
   - Settings → Deployment
   - Copy the domain (e.g., `https://course-method.up.railway.app`)

### Phase 3: Stripe Webhook (3 min)

8. **Point Stripe to Railway**
   - Stripe Dashboard → Developers → Webhooks
   - Add endpoint:
     - URL: `https://YOUR_APP.up.railway.app/api/webhook`
     - Events: `payment_intent.succeeded`, `charge.refunded`
   - Copy webhook signing secret
   - Add to Railway Variables as `STRIPE_WEBHOOK_SECRET` (replace test secret)

### Phase 4: Update Frontend (5 min)

9. **Point Vercel Frontend to Railway Backend**
   - Open `web/index.html`
   - Find line: `var API = '/api';`
   - Replace with: `var API = 'https://YOUR_APP.up.railway.app/api';`
   - Save and push to GitHub:
     ```bash
     git add web/index.html
     git commit -m "Point frontend to Railway backend"
     git push
     ```

10. **Redeploy Frontend on Vercel**
    - Vercel Dashboard → Your project
    - Git will auto-trigger deploy from your push
    - Wait for green checkmark

### Phase 5: Test (2 min)

11. **Health Check**
    ```
    https://YOUR_APP.up.railway.app/api/health/ready
    ```
    Should return: `{"status": "ready", "checks": {"database": true, "stripe": true, "email": true, "deliverable": true}}`

12. **Test Purchase**
    - Go to your sales page (Vercel domain)
    - Click "Buy Now"
    - Use Stripe test card: `4242 4242 4242 4242` (exp: 12/25, CVC: any)
    - Check:
      - ✅ Page shows "Order processing..."
      - ✅ Email arrives with download link
      - ✅ Download link works
      - ✅ Stripe dashboard shows successful payment

---

## Troubleshooting

### "Health check fails"
- Railway dashboard → your service → Deployments
- Check logs for errors
- Common: .env variable missing or typo

### "Stripe webhook not firing"
- Check Railway logs for 400/500 errors
- Verify webhook URL in Stripe is EXACTLY correct
- Try re-adding endpoint in Stripe

### "Download link doesn't work"
- Check vault built: `https://YOUR_APP.up.railway.app/api/health/ready`
- `deliverable: false` = vault didn't build
- Check logs for build errors

### "CORS errors in browser console"
- Verify `CORS_ORIGINS` environment variable is set to your Vercel domain
- Redeploy Railway after changing it

---

## After Deploy

**In your .env files:**
- Keep test keys for local dev
- **NEVER commit** `.env` to git
- Stripe will give you live keys when you go live

**Monitor in first week:**
- Check error logs daily
- Test a purchase every 2 days
- Monitor Stripe webhook deliveries

---

## Commands Reference

```bash
# Clone and setup
git clone YOUR_REPO
cd course-system/backend
npm install

# Local testing
npm run dev
npm run check-env

# Build vault manually
npm run build-vault

# Smoke test
npm run test:smoke

# Deploy (via Railway dashboard, not CLI)
# Push changes and Railway auto-deploys
git push origin main
```

---

**Total time: ~30 minutes**  
**You're almost there!** 🎉
