#!/usr/bin/env bash
# Dashop Deployment Script for Cloudflare Pages
# Run: ./deploy.sh

echo "🚀 Deploying Dashop to Cloudflare Pages..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler not found. Installing..."
    npm install -g wrangler
fi

# Login to Cloudflare (first time only)
echo "🔐 Make sure you're logged into Cloudflare:"
echo "   wrangler login"

# Deploy
echo "📦 Deploying..."
wrangler pages deploy public --project-name dashop

echo "✅ Deployment complete!"
echo ""
echo "🌐 Your store is now live at: https://dashop.pages.dev"
echo ""
echo "Next steps:"
echo "  - Update SUPABASE_URL and SUPABASE_ANON_KEY in wrangler.toml"
echo "  - Run supabase/migrations/001-schema.sql in your Supabase project"
echo "  - Test your store at the deployed URL"
