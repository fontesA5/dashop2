-- Supabase Migration: 002-promos.sql
-- Promos & Discount Codes Table

CREATE TABLE IF NOT EXISTS promos (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    discount_type VARCHAR(50) DEFAULT 'percentage',
    discount_value DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
    promo_code VARCHAR(50) NOT NULL UNIQUE,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS and public policies
ALTER TABLE promos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to promos"
ON promos FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow public insert and update to promos"
ON promos FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Insert default promo codes
INSERT INTO promos (title, description, discount_type, discount_value, promo_code, active)
VALUES 
('Launch Special', 'Get 15% off your entire order with code LAUNCH15', 'percentage', 15.00, 'LAUNCH15', true),
('Welcome Discount', 'Save 10% on your shopping with code SAVE10', 'percentage', 10.00, 'SAVE10', true)
ON CONFLICT (promo_code) DO NOTHING;
