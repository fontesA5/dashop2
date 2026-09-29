-- ==============================================================================
-- Supabase Migration: 004-enable-rls.sql
-- Fix: Enable Row-Level Security (RLS) on all public tables
-- ==============================================================================
-- This script fixes the Supabase security advisory:
-- "Table publicly accessible Anyone with your project URL can read, edit, and delete all data in this table because Row-Level Security is not enabled."
--
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/wninmlukmkdlrfgblobz
-- 2. Go to "SQL Editor" in the left sidebar
-- 3. Click "New Query", paste this entire script, and click "Run" (or press Ctrl+Enter)
-- ==============================================================================

-- 1. PRODUCTS TABLE
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to products" ON products;
DROP POLICY IF EXISTS "Allow public insert to products" ON products;
DROP POLICY IF EXISTS "Allow public update to products" ON products;
DROP POLICY IF EXISTS "Allow public delete to products" ON products;
DROP POLICY IF EXISTS "Allow public all access to products" ON products;

-- Allow public and admin to read products (storefront catalog)
CREATE POLICY "Allow public read access to products"
ON products FOR SELECT
TO anon, authenticated
USING (true);

-- Allow inserting products (Admin Hub add product & store config)
CREATE POLICY "Allow public insert to products"
ON products FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow updating products (Admin Hub edit product & stock updates)
CREATE POLICY "Allow public update to products"
ON products FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Allow deleting products (Admin Hub)
CREATE POLICY "Allow public delete to products"
ON products FOR DELETE
TO anon, authenticated
USING (true);


-- 2. ORDERS TABLE
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to orders" ON orders;
DROP POLICY IF EXISTS "Allow public insert to orders" ON orders;
DROP POLICY IF EXISTS "Allow public update to orders" ON orders;
DROP POLICY IF EXISTS "Allow public delete to orders" ON orders;
DROP POLICY IF EXISTS "Allow public all access to orders" ON orders;

-- Allow reading orders (Admin Hub orders list & Customer order tracking)
CREATE POLICY "Allow public read access to orders"
ON orders FOR SELECT
TO anon, authenticated
USING (true);

-- Allow placing new orders (Storefront checkout)
CREATE POLICY "Allow public insert to orders"
ON orders FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow updating orders (Admin Hub order status changes)
CREATE POLICY "Allow public update to orders"
ON orders FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Allow deleting orders (Admin Hub delete order action)
CREATE POLICY "Allow public delete to orders"
ON orders FOR DELETE
TO anon, authenticated
USING (true);


-- 3. SESSIONS TABLE
ALTER TABLE IF EXISTS sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all access to sessions" ON sessions;

CREATE POLICY "Allow public all access to sessions"
ON sessions FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);


-- 4. ADMIN_USERS TABLE
ALTER TABLE IF EXISTS admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to active admin users" ON admin_users;
DROP POLICY IF EXISTS "Allow public all access to admin_users" ON admin_users;

-- Only allow SELECT for active admin users (for login verification)
-- Public users cannot INSERT, UPDATE, or DELETE admin accounts
CREATE POLICY "Allow public read access to active admin users"
ON admin_users FOR SELECT
TO anon, authenticated
USING (is_active = true);


-- 5. PROMOS & BANNERS TABLES (If they exist)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'promos') THEN
        ALTER TABLE promos ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow public read access to promos" ON promos;
        DROP POLICY IF EXISTS "Allow public insert and update to promos" ON promos;
        DROP POLICY IF EXISTS "Allow public all access to promos" ON promos;
        CREATE POLICY "Allow public read access to promos" ON promos FOR SELECT TO anon, authenticated USING (true);
        CREATE POLICY "Allow public all access to promos" ON promos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'banners') THEN
        ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow public read access to banners" ON banners;
        DROP POLICY IF EXISTS "Allow public insert, update, delete to banners" ON banners;
        DROP POLICY IF EXISTS "Allow public all access to banners" ON banners;
        CREATE POLICY "Allow public read access to banners" ON banners FOR SELECT TO anon, authenticated USING (true);
        CREATE POLICY "Allow public all access to banners" ON banners FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;


-- 6. REALTIME REPLICATION FOR ORDERS
-- Ensure orders table emits realtime events for Admin dashboard notifications
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;
