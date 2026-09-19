# 🚀 Launch Checklist

## Pre-Launch (This Week)

### 1. Stripe Setup (15 min)
- [ ] Go to [stripe.com](https://stripe.com) and create an account
- [ ] Navigate to **Developers → API keys**
- [ ] Copy your **Secret Key** (starts with `sk_test_` or `sk_live_`)
- [ ] Copy your **Publishable Key** (starts with `pk_test_` or `pk_live_`)
- [ ] Navigate to **Webhooks** and create a new endpoint:
  - URL: `https://yourdomain.com/api/webhook` (or `http://localhost:3000/api/webhook` for local testing)
  - Events: Select `charge.completed`
  - Copy the **Webhook Secret**

### 2. Email Setup (10 min)
Choose one method:

**Option A: Gmail (Easiest)**
- [ ] Enable 2-factor authentication on your Gmail account
- [ ] Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
- [ ] Select "Mail" and "Windows Computer"
- [ ] Copy the 16-character app password

**Option B: SMTP**
- [ ] Get SMTP credentials from your email provider
- [ ] Note: host, port, username, password

### 3. Generate Admin Token (5 min)
```bash
cd backend
node scripts/create-admin-token.js
```
Copy the token that prints out.

### 4. Create .env File (5 min)
```bash
cd backend
cp .env.example .env
```

Edit `.env` with your values:
```
# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Email (Gmail)
EMAIL_TRANSPORT=gmail
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Or SMTP
# EMAIL_TRANSPORT=smtp
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=xxx
# SMTP_PASSWORD=xxx

# Admin
ADMIN_TOKEN=<paste the token from step 3>
TOKEN_SECRET=<generate random 32+ chars>

# Domain
PUBLIC_URL=https://yourdomain.com

# Pricing (in cents)
PRICE_METHOD=4700
PRICE_ENGINE=9700

# Optional: Launch window (ISO 8601)
# LAUNCH_PRICE_ENDS_AT=2026-09-24T23:59:59Z
# PRICE_METHOD_AFTER_LAUNCH=7900
# PRICE_ENGINE_AFTER_LAUNCH=14900
```

### 5. Install Dependencies
```bash
cd backend
npm install
```

### 6. Build Course Vault (if you haven't)
```bash
npm run build-vault
```

### 7. Test Locally
```bash
npm run dev
```
Visit `http://localhost:3000` — you should see the sales page with pricing loaded.

---

## Deployment (This Weekend)

### Option A: Vercel (Recommended - Easiest)
```bash
npm i -g vercel

# Deploy backend
cd backend
vercel

# Deploy frontend
cd ../web
vercel
```
Then point your domain to Vercel.

### Option B: Railway (One Click)
1. Push your code to GitHub
2. Go to [railway.app](https://railway.app)
3. Create new project → Import from GitHub
4. Add environment variables in Railway dashboard
5. Railway auto-deploys on push

### Option C: Render
1. Push code to GitHub
2. Go to [render.com](https://render.com)
3. New → Web Service
4. Connect GitHub repo
5. Add environment variables
6. Deploy

### Option D: Your Own Server
See `docs/Deployment-Guide.md` for detailed SSH setup.

---

## Post-Launch (Day 1)

### 1. Test the Full Funnel
- [ ] Visit your sales page
- [ ] Verify pricing loads from `/api/config`
- [ ] Click "Get The Method" or "Get The Engine"
- [ ] Use test card: `4242 4242 4242 4242`, any future date, any CVC
- [ ] Confirm you receive a download email with course ZIP
- [ ] Download and open in Obsidian to verify

### 2. Set Up Webhook
- [ ] In Stripe dashboard, go to **Webhooks**
- [ ] Find your endpoint
- [ ] Click it and verify **Recent attempts** show successful deliveries
- [ ] You should see `charge.completed` events

### 3. Update Admin Dashboard
- [ ] Visit `https://yourdomain.com/admin.html`
- [ ] Paste your ADMIN_TOKEN in the auth form
- [ ] Verify you can see test customer data
- [ ] Check the analytics dashboard

---

## First Week

### 1. Customize Course Content
- [ ] Open `vault/` in Obsidian or your text editor
- [ ] Update Module 1 with your specific topic/expertise
- [ ] Edit `vault/00-Command-Center.md` with your course name
- [ ] Update the marketing copy in `web/index.html`

### 2. Create Your First 5 Reels
Follow `vault/04-Market/01-Distribution-From-Zero.md` for the script templates.

### 3. Start Posting
- [ ] Post reel 1 on Instagram/TikTok
- [ ] Engage with 20+ similar accounts' posts
- [ ] Reply to every comment within 1 hour
- [ ] Post reel 2 the next day
- [ ] Keep going for 30 days

### 4. Collect Real Testimonials
- [ ] Every customer who completes 3+ lessons, send them: "Hey, you've been amazing. Would you send me one sentence about what you got from this course?"
- [ ] Use `/admin.html` dashboard to approve and display testimonials
- [ ] Refresh your sales page to see them live

---

## Troubleshooting

**Pricing shows "Loading pricing…"**
- Verify `/api/config` endpoint is returning data: `curl http://localhost:3000/api/config`
- Check that `STRIPE_PUBLISHABLE_KEY` is set in `.env`
- Restart backend server

**Webhook not working**
- Verify `STRIPE_WEBHOOK_SECRET` is correct (starts with `whsec_`)
- Check Stripe dashboard → Webhooks → Recent attempts for error details
- Ensure your `PUBLIC_URL` is correct and accessible

**Emails not sending**
- Test with `npm run smoke-test` from backend folder
- Verify Gmail app password is correct (16 chars, with spaces)
- Check SMTP credentials if using SMTP
- See `docs/Troubleshooting.md` for full guide

**Course ZIP not found**
- Run `npm run build-vault` from backend folder
- Verify `dist/` folder contains `.zip` files

---

## What's Next (Month 1)

1. **Week 1-2:** Post reels daily, collect feedback
2. **Week 2-3:** First 5-10 sales come in, analyze what worked
3. **Week 3-4:** Optimize your content, increase posting consistency
4. **End of Month:** Review analytics, plan pricing increase

---

## Admin Dashboard Features

Visit `/admin.html` with your `ADMIN_TOKEN`:

- **Sales Dashboard:** Revenue, customer count, tier breakdown
- **Customer List:** All buyers, download status, email
- **Testimonials:** Approve/feature customer quotes
- **Analytics:** Traffic, conversion rate, UTM tracking
- **Support Tickets:** Customer emails and requests

---

## Key Files

- `web/index.html` — Sales page (update marketing copy here)
- `backend/server.js` — Main app entry point
- `backend/routes/config.js` — Public pricing endpoint (✓ already working)
- `vault/` — Course content (customize for your topic)
- `docs/` — Full documentation and guides

---

## Support

**Stuck on Stripe setup?** → See `docs/Stripe-Setup.md`  
**Deployment questions?** → See `docs/Deployment-Guide.md`  
**Email not working?** → See `docs/Email-Setup.md`  
**Full troubleshooting?** → See `docs/Troubleshooting.md`

---

## The Timeline

- **Today:** Complete sections 1-4 (setup takes 45 min)
- **Tomorrow:** Deploy (15 min)
- **This weekend:** Test funnel, customize content
- **Next week:** Post first reel

**Goal:** First sale within 2 weeks.

You've got this. 🚀
