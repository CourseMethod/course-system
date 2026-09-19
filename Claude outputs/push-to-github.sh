#!/bin/bash
# Quick push to GitHub script

set -e

echo "🚀 Pushing course system to GitHub..."
echo ""

# Check if git repo exists
if [ ! -d ".git" ]; then
    echo "❌ Not a git repository. Run this from your project root."
    exit 1
fi

# Check .env is gitignored
echo "📋 Checking .gitignore..."
if ! grep -q "\.env" .gitignore; then
    echo ".env" >> .gitignore
    echo "✅ Added .env to .gitignore"
fi

# Stage everything
echo "📦 Staging files..."
git add .
git status

# Ask for confirmation
echo ""
echo "⚠️  About to commit and push. Verify above that .env is NOT staged."
read -p "Proceed? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

# Commit
git commit -m "Deploy to Railway: course system with Stripe + email" || {
    echo "Nothing to commit (changes already staged)"
}

# Push
echo ""
echo "🔄 Pushing to GitHub..."
if git remote get-url origin > /dev/null 2>&1; then
    git push origin main
    echo "✅ Pushed successfully!"
    echo ""
    REMOTE_URL=$(git remote get-url origin)
    echo "📍 Your repo: $REMOTE_URL"
    echo ""
    echo "Next: Open https://railway.app and deploy from GitHub"
else
    echo "❌ No GitHub remote configured."
    echo ""
    echo "First time setup:"
    echo "  git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
    echo "  git branch -M main"
    echo "  git push -u origin main"
fi
