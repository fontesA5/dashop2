# 🚀 Dashop Quick Start Guide

## ⚡ Get Your Store Running in 10 Minutes

### What You Have (Phase 1 Complete ✅)
- ✅ Mobile-first HTML/JS store
- ✅ Shopping cart system  
- ✅ Checkout flow
- ✅ Admin dashboard foundation
- ✅ Supabase database schema ready
- ✅ Cloudflare deployment configured

---

## 📋 Step-by-Step Setup

### Step 1: Create Supabase (3 min)
```bash
1. Go to https://app.supabase.com
2. Click "New Project" → Fill in details → Create
3. Wait ~60 seconds for project to provision
4. Go to Settings > API
5. Copy these two values:
   - Project URL (e.g., https://xxxxx.supabase.co)
   - Anon Public Key (long string starting with eyJ...)
```

### Step 2: Set Up Database (1 min)
```bash
1. In your Supabase project, click "SQL Editor" in left sidebar
2. Copy ENTIRE contents of: supabase/migrations/001-schema.sql
3. Paste into SQL Editor
4. Click "Run" to execute
5. You should see confirmation that tables were created
```

### Step 3: Configure Environment (1 min)
```bash
1. In project folder, copy template:
   cp .supabase.env .env

2. Edit .env file with your credentials:
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_anon_key_here

3. Save the file
```

### Step 4: Test Locally (1 min)
```bash
npx serve public -l 3000

# Open your browser and go to:
http://localhost:3000

# You should see the Dashop landing page! 🎉
```

---

## 🌐 Deploy to Production (Optional, 5 min)

### Prerequisites
- Install Wrangler CLI: `npm install -g wrangler`
- Login to Cloudflare: `wrangler login`

### Deploy Command
```bash
wrangler pages deploy public --project-name dashop
```

### After Deployment
Your store will be live at:
```
https://dashop.pages.dev
```

---

## 🔐 Admin Login

Access your admin dashboard at:
```
http://localhost:3000/admin/login.html
```

**Default credentials:**
- Email: `admin@dashop.com`
- Password: `admin123`

⚠️ **Change password after first login!**

---

## 🎯 What Works Right Now

| Feature | Status | Description |
|---------|--------|-------------|
| Browse Products | ✅ | See 8 demo products |
| Add to Cart | ✅ | Shopping cart with localStorage |
| View Cart | ✅ | Modal popup showing cart items |
| Checkout | ✅ | Collect customer info, submit order |
| Order Sync | ⚠️ | Requires Supabase setup |
| Admin Login | ✅ | Protected admin panel |
| Inventory View | ✅ | See all products in dashboard |

---

## 🛠️ Common Issues & Solutions

### "Cart not syncing to backend"
**Solution:** Make sure you ran the SQL migration and environment variables are set correctly.

### "Supabase connection error"
**Solution:** Check that SUPABASE_URL and SUPABASE_ANON_KEY are correct in .env file.

### "Products not loading"
**Solution:** This is normal for demo mode! Products load from localStorage until Supabase is configured.

---

## 📁 Key Files to Edit

| File | Purpose | When to Edit |
|------|---------|--------------|
| `.env` | Your credentials | Immediately after setup |
| `supabase/migrations/001-schema.sql` | Database structure | Only if modifying schema |
| `public/index.html` | Landing page content | Customizing branding |
| `public/css/styles.css` | Styling | Theme customization |

---

## 🎨 Quick Customizations

### Change Store Name
Edit in `public/index.html`:
```html
<title>YOUR STORE NAME - Your Mobile Store</title>
```

### Add Your Logo
Replace the text logo with an image:
```html
<img src="images/logo.png" alt="Logo" class="logo-img">
```
Then add `.logo-img` styles to `public/css/styles.css`

### Modify Product Prices/Descriptions
Edit in `supabase/migrations/001-schema.sql`:
- Find the INSERT statements
- Update price, name, description fields
- Re-run SQL in Supabase Editor

---

## 📈 What's Next?

Once you've tested Phase 1, we can build:

**Phase 2:** Enhanced cart, product details, payment integration  
**Phase 3:** Full admin CRUD, sales charts, reports  
**Phase 4:** Testing suite, production deployment, analytics  

See `docs/PROJECT_STATUS.md` for full breakdown.

---

## ✅ Checklist - Are You Ready?

- [ ] Supabase project created
- [ ] SQL migration run in Supabase
- [ ] `.env` file configured with credentials  
- [ ] Local development server running
- [ ] Landing page visible in browser
- [ ] Can add items to cart
- [ ] Can complete checkout process
- [ ] Admin dashboard accessible

If all checked ✅ → **Your store is production-ready!** 🎉

---

## 🆘 Need Help?

Check these files:
- `SETUP.md` - Detailed setup instructions
- `README.md` - Full documentation  
- `docs/PROJECT_STATUS.md` - Phase progress tracker

Or ask me! I'm here to help. 😊
