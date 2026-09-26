-- Supabase Migration: 003-banners.sql
-- Storefront Carousel Banners & Seasonal Ads Table

CREATE TABLE IF NOT EXISTS banners (
    id TEXT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    subtitle TEXT,
    tag VARCHAR(100) DEFAULT 'Limited Time',
    tag_icon VARCHAR(50) DEFAULT 'local_fire_department',
    promo_code VARCHAR(50),
    link_url VARCHAR(255) DEFAULT '/catalog',
    button_text VARCHAR(100) DEFAULT 'Shop now',
    theme VARCHAR(50) DEFAULT 'primary',
    image_url TEXT,
    active BOOLEAN DEFAULT true,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS and public policies
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to banners"
ON banners FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow public insert, update, delete to banners"
ON banners FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Insert default starter banners
INSERT INTO banners (id, title, subtitle, tag, tag_icon, promo_code, link_url, button_text, theme, active)
VALUES 
('banner_1', 'Save Big on Your Essentials', 'Use code SAVE10 for instant discounts on all everyday items!', 'Limited Time', 'local_fire_department', 'SAVE10', '/catalog', 'Shop now', 'primary', true),
('banner_2', 'Weekend Flash Deals', 'Exclusive savings on household & cleaning essentials!', 'Flash Deals', 'bolt', 'FLASH20', '/catalog?category=Household+Essentials', 'Explore Deals', 'sunset', true),
('banner_3', 'Personal Care & Beauty', 'Discover premium skincare and personal wellness products.', 'Seasonal Special', 'spa', '', '/catalog?category=Personal+Care', 'Discover More', 'emerald', true)
ON CONFLICT (id) DO NOTHING;
