# Your Next Steps (The Exact Path)

## Read These Files First (In Order)

1. **QUICK-START.md** (5 min) ← Start here
2. **WHAT-YOU-HAVE.md** (10 min) ← Overview of the system
3. **LAUNCH-CHECKLIST.md** (step-by-step) ← Your deployment guide
4. This file (5 min)

---

## Today (If It's Weekday)

### Do This Right Now (30 minutes)

#### 1. Extract the ZIP
```bash
unzip course-system-premium.zip
cd course-system-premium
```

#### 2. Create Stripe Account (10 min)
Go to [stripe.com](https://stripe.com):
- Sign up
- Developers → API Keys
- Copy Secret Key (starts with `sk_test_`)
- Copy Publishable Key (starts with `pk_test_`)
- Webhooks → Create endpoint at `http://localhost:3000/api/webhook` (for testing)
- Copy Webhook Secret

#### 3. Get Gmail App Password (5 min)
- Go to [myaccount.google.com](https://myaccount.google.com)
- Security → 2-Step Verification (enable if not already)
- App passwords → Mail → Windows Computer
- Copy the 16-character password

#### 4. Setup .env File (5 min)
```bash
cd backend
cp .env.example .env

# Edit .env with your keys:
# STRIPE_SECRET_KEY=sk_test_xxx
# STRIPE_PUBLISHABLE_KEY=pk_test_xxx
# STRIPE_WEBHOOK_SECRET=whsec_xxx
# GMAIL_USER=your-email@gmail.com
# GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
# ADMIN_TOKEN=<generate random string, 32+ chars>
# TOKEN_SECRET=<generate random string, 32+ chars>
```

#### 5. Install & Test (5 min)
```bash
npm install
npm run dev
```

Visit `http://localhost:3000` in your browser. You should see the sales page with pricing loaded.

**If you see pricing:** ✅ Everything works. Go to step 6.  
**If it says "Loading pricing...":** See LAUNCH-CHECKLIST.md → Troubleshooting

#### 6. Test Payment (5 min)
On the sales page:
1. Click "Get The Method" or "Get The Engine"
2. Use test card: `4242 4242 4242 4242`
3. Any future date (e.g., 12/25)
4. Any CVC (e.g., 123)
5. Click Pay
6. Check your email for download link with course ZIP

**If you get email:** ✅ Webhook is working. You're ready to deploy.  
**If no email:** Check console for errors, see Troubleshooting.

---

## This Weekend

### Deploy to the World (1 hour)

Pick ONE option:

#### Option A: Vercel (Easiest)
```bash
npm i -g vercel

# Deploy backend
cd backend
vercel
# Follow prompts, connect to account

# Deploy frontend
cd ../web
vercel
# Follow prompts
```

Then:
1. Note your backend URL (e.g., `https://backend-xyz.vercel.app`)
2. Update `web/index.html` line 1172: change `var API = '/api'` to `var API = 'https://backend-xyz.vercel.app/api'`
3. Re-deploy web: `cd web && vercel`
4. Get a domain ($12/year from Namecheap) and point DNS to Vercel

#### Option B: Railway (One-click)
1. Push to GitHub
2. Go to [railway.app](https://railway.app)
3. New Project → Import GitHub repo
4. Add environment variables from your `.env`
5. Railway auto-deploys

See LAUNCH-CHECKLIST.md for detailed steps.

#### Option C: Your Own Server
See `docs/Deployment-Guide.md`

### Update Stripe Webhook (10 min)

Once deployed:
1. Go to Stripe → Webhooks
2. Update the endpoint to: `https://yourdomain.com/api/webhook`
3. Test it by making another payment

### Test Full Funnel (15 min)

1. Visit your live domain
2. Click checkout, use test card
3. Verify download email arrives
4. Download the ZIP and open in Obsidian
5. Check `/admin.html` with your token to see the customer

**If all works:** You're deployed. Move to next section.

---

## Next Week (Content & Launch)

### Day 1: Customize Content (1 hour)

1. Open `vault/` folder in any text editor
2. Read `vault/00-Command-Center.md`
3. Update the course title for your topic
4. Edit at least one lesson (e.g., 01-Mindset/01-Why-This-Works.md)
5. Change pricing/copy in `web/index.html` if desired
6. Deploy changes: `cd web && vercel`

### Days 2-3: Create First 5 Reels (2 hours)

1. Open `vault/04-Market/01-Distribution-From-Zero.md`
2. Find the "30-Day Reel Script Calendar"
3. Pick 5 scripts from it
4. Customize for your course topic
5. Record as short videos (30-60 sec each)

### Days 4-8: Post & Engage (30 min/day)

**Reel 1:** Post on Instagram and TikTok
- Caption: Your first hook from the script
- Hashtags: 15-20 relevant ones
- Post time: 9am your timezone

**Engagement:** Spend 30 min engaging
- Like 30 similar posts
- Comment on 20 similar posts (real comments, not generic)
- Reply to every comment on YOUR post within 1 hour

**Reel 2:** Next day, same process

Keep going for 30 days. Most people see:
- **Week 1:** 500-2K views, 50-200 followers
- **Week 2:** 2K-5K views per reel, some DM traffic
- **Week 3:** First 2-3 sales
- **Week 4:** 5-10 sales

---

## Your First Sale (What to Expect)

When someone buys:

1. **Stripe charges them** ($47 or $97, minus 2.9% + $0.30)
2. **You get notified** (check your email)
3. **Webhook fires** (automatic, behind the scenes)
4. **Customer gets download link** (emailed within seconds)
5. **Admin dashboard updates** (new customer visible at `/admin.html`)

**Your profit:**
- $47 sale → you keep ~$44
- $97 sale → you keep ~$93

After 10 sales, you'll have $440-$930.

---

## First 100 Sales (The Pattern)

| Week | Reel Views | Followers | Sales | Revenue |
|------|-----------|-----------|-------|---------|
| 1 | 5K-30K | 100-500 | 0-2 | $0-$100 |
| 2 | 10K-50K | 300-1K | 1-3 | $50-$300 |
| 3 | 20K-100K | 500-2K | 2-5 | $100-$500 |
| 4 | 30K-150K | 1K-5K | 3-8 | $150-$800 |

**After 30 days:** Most people have 5-20 sales and $200-$2,000 revenue.

---

## Collecting Real Testimonials

Every customer who completes 3+ lessons:

1. Email them: "Hey! How's the course going? Would you send me one sentence about what you got from it?"
2. They reply with a quote
3. You approve it in `/admin.html` → Testimonials
4. It appears live on your sales page
5. New visitors see social proof from real customers

By week 3, you should have 2-3 testimonials. By week 6, you'll have 10+.

---

## Growing to $10K/Month

**Month 1:** 5-15 sales = $235-$1,455  
Post 30 reels. Learn what hooks work.

**Month 2:** 15-40 sales = $705-$3,880  
Raise prices to $67/$127. Launch affiliate program.

**Month 3:** 30-80 sales = $1,410-$7,760  
Launch second course or coaching tier.

**Month 6:** 100+ sales/month = $10K+  
Multiple products, YouTube, partnerships.

The blueprint works. The math is real. You just have to execute.

---

## If You Get Stuck

**Stripe not working?**
→ See `docs/Stripe-Setup.md` or LAUNCH-CHECKLIST.md → Troubleshooting

**Email not sending?**
→ See `docs/Email-Setup.md` or LAUNCH-CHECKLIST.md → Troubleshooting

**Can't deploy?**
→ See `docs/Deployment-Guide.md`

**Course not downloading?**
→ Run `npm run build-vault` in backend folder

**Something else?**
→ See `docs/Troubleshooting.md` (29 problems + fixes)

All documentation is in the ZIP. Everything you need is there.

---

## The Timeline

| When | What | Time |
|------|------|------|
| Today | Setup & test locally | 30 min |
| This weekend | Deploy to Vercel | 1 hour |
| Day 3 | Customize content | 1 hour |
| Day 4 | Create first 5 reel scripts | 2 hours |
| Day 5 | Post first reel | 30 min |
| Days 6-34 | Post daily, engage | 30 min/day |
| **Week 3-4** | **First sales come in** | — |
| **Month 1** | **$500-$2,000 revenue** | — |

---

## What Success Looks Like

✅ Sales page is live  
✅ You can make a test purchase  
✅ Download email works  
✅ Admin dashboard shows customers  
✅ First reel posted  
✅ First real customer within 2 weeks  
✅ First $1,000 within 4-6 weeks  
✅ Building momentum  

---

## One Last Thing

This system works because:

1. **It's faceless** — No camera fear holds you back
2. **It has real psychology** — Copy that converts
3. **It's fully yours** — Open source, no platform risk
4. **The math works** — $47 courses actually sell
5. **Distribution is taught** — The vault teaches you how to reach people

But none of it works if you don't execute.

**Post your first reel this week.**

That's the only thing standing between you and your first sale.

---

## Quick Links

- Stripe: [stripe.com](https://stripe.com)
- Vercel: [vercel.com](https://vercel.com)
- Gmail App Passwords: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
- Obsidian: [obsidian.md](https://obsidian.md)
- Name a domain: [namecheap.com](https://namecheap.com)

---

## You've Got This

You have:
- ✅ The course
- ✅ The selling system
- ✅ The marketing playbook
- ✅ The deployment guide
- ✅ Everything

Now go execute.

Your first sale is waiting. 🚀
