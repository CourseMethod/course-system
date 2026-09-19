#!/bin/bash
# Course System Railway Deployment Script
# Run this from your project root directory

set -e

echo "🚀 Course System Railway Deployment Setup"
echo "=========================================="
echo ""

# Step 1: Initialize git repo if needed
if [ ! -d ".git" ]; then
    echo "📦 Initializing Git repository..."
    git init
    echo "node_modules/" >> .gitignore
    echo ".env" >> .gitignore
    echo ".vercel" >> .gitignore
    git add .
    git commit -m "Initial commit: course system"
else
    echo "✅ Git repository already exists"
fi

# Step 2: Check .env is in gitignore
if grep -q ".env" .gitignore; then
    echo "✅ .env is properly gitignored"
else
    echo "⚠️  Adding .env to .gitignore"
    echo ".env" >> .gitignore
    git add .gitignore
    git commit -m "Update gitignore"
fi

# Step 3: Verify backend files
echo ""
echo "📋 Verifying backend structure..."
if [ ! -f "backend/package.json" ]; then
    echo "❌ ERROR: backend/package.json not found"
    exit 1
fi
echo "✅ Backend structure OK"

# Step 4: Instructions for user
echo ""
echo "🔑 NEXT STEPS (Manual):"
echo "========================"
echo ""
echo "1. Push to GitHub:"
echo "   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "2. Create Railway Account:"
echo "   - Go to https://railway.app"
echo "   - Click 'Deploy'"
echo "   - Sign in with GitHub"
echo ""
echo "3. Create New Railway Project:"
echo "   - Click 'New Project' → 'Deploy from GitHub'"
echo "   - Select your repository"
echo "   - Wait for auto-detection"
echo ""
echo "4. Configure Railway Service:"
echo "   Settings → Root Directory → backend"
echo "   (It should auto-detect Node.js and set npm start)"
echo ""
echo "5. Add Persistent Volume (CRITICAL - DO NOT SKIP):"
echo "   Settings → Volumes → Add Volume"
echo "   Mount path: /data"
echo "   Then go to Variables tab and add:"
echo "   DATABASE_PATH=/data/course-printer.db"
echo ""
echo "6. Add Environment Variables:"
echo "   Copy ALL lines from backend/.env.local into Variables:"
echo ""

# Read .env.local and display
if [ -f "backend/.env.local" ]; then
    echo "   ┌─ Copy these variables into Railway:"
    cat backend/.env.local | sed 's/^/   │ /'
    echo "   └─"
fi

echo ""
echo "7. Add these PRODUCTION overrides:"
echo "   NODE_ENV=production"
echo "   PUBLIC_URL=https://your-app.up.railway.app"
echo "   CORS_ORIGINS=https://your-app.up.railway.app"
echo "   LOG_JSON=true"
echo ""
echo "8. Build the vault on deploy:"
echo "   Add to backend/package.json under 'scripts':"
echo '   "postinstall": "npm run build-vault || true"'
echo ""
echo "9. Get your Railway URL:"
echo "   Once deployed, visit:"
echo "   https://your-app.up.railway.app/api/health/ready"
echo ""
echo "10. Point Stripe webhook:"
echo "    Stripe Dashboard → Webhooks → Add endpoint"
echo "    URL: https://your-app.up.railway.app/api/webhook"
echo "    Events: payment_intent.succeeded, charge.refunded"
echo "    Copy the webhook signing secret"
echo "    Add to Railway Variables as STRIPE_WEBHOOK_SECRET"
echo ""
echo "11. Update Vercel Frontend:"
echo "    In web/index.html, success.html, admin.html:"
echo "    Change: var API = '/api';"
echo "    To: var API = 'https://your-app.up.railway.app/api';"
echo "    Then redeploy to Vercel"
echo ""
echo "12. Test:"
echo "    curl https://your-app.up.railway.app/api/health/ready"
echo "    Should return: {\"status\": \"ready\", \"checks\": {...}}"
echo ""
echo "✅ Setup complete!"
