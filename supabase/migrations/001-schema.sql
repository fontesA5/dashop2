-- Supabase Database Schema for Dashop
-- Run this in your Supabase SQL Editor to create all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Products Table
CREATE TABLE products (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    stock INTEGER NOT NULL DEFAULT 0,
    image VARCHAR(50),
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders Table
CREATE TABLE orders (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    items_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions Table (for admin login tracking)
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_agent TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin Users Table
CREATE TYPE role_type AS ENUM ('admin', 'staff');

CREATE TABLE admin_users (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role role_type DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_sessions_created_at ON sessions(created_at);

-- Insert demo products if table is empty
INSERT INTO products (name, description, price, stock, image, category) VALUES
('Wireless Bluetooth Earbuds', 'High-quality wireless earbuds with noise cancellation and 24h battery life.', 49.99, 50, '🎧', 'Electronics'),
('Smartphone Stand', 'Adjustable aluminum smartphone stand for desk.', 19.99, 100, '📱', 'Accessories'),
('USB-C Cable 6ft', 'Durable braided USB-C charging and data cable.', 12.99, 200, '🔌', 'Cables'),
('Portable Power Bank', '20000mAh portable charger with fast charging support.', 34.99, 75, '🔋', 'Power'),
('Laptop Sleeve 13"', 'Waterproof protective sleeve for 13-inch laptops.', 24.99, 60, '💼', 'Protection'),
('Mechanical Keyboard', 'RGB backlit mechanical keyboard with Cherry MX switches.', 89.99, 30, '⌨️', 'Peripherals'),
('Gaming Mouse', 'Precision gaming mouse with programmable buttons.', 39.99, 80, '🖱️', 'Peripherals'),
('Monitor Stand', 'Ergonomic monitor stand with cable management.', 29.99, 45, '🪑', 'Furniture');

-- Insert default admin user (password: admin123)
-- Note: Use bcrypt or Argon2 in production for password hashing
INSERT INTO admin_users (email, password_hash, role) VALUES
('admin@dashop.com', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIJjZMiagBZkpQ46dVn5G3YhZzXcWfIq', 'admin');

-- ==============================================================================
-- Row-Level Security (RLS) Configuration
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Products Policies
CREATE POLICY "Allow public read access to products" ON products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public insert to products" ON products FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow public update to products" ON products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete to products" ON products FOR DELETE TO anon, authenticated USING (true);

-- Orders Policies
CREATE POLICY "Allow public read access to orders" ON orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public insert to orders" ON orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow public update to orders" ON orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete to orders" ON orders FOR DELETE TO anon, authenticated USING (true);

-- Sessions Policies
CREATE POLICY "Allow public all access to sessions" ON sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Admin Users Policies
CREATE POLICY "Allow public read access to active admin users" ON admin_users FOR SELECT TO anon, authenticated USING (is_active = true);

