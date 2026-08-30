-- Seeds reference/config data that today lives hardcoded in constants.ts:
-- categories + mega-menu sections, footer content, currencies, languages,
-- and the singleton app_settings row (maintenance mode, default currency/language).
--
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/005_seed_reference_data.sql

BEGIN;

-- Currencies & languages (must exist before app_settings, which FKs to both)
INSERT INTO currencies (code, symbol, label, exchange_rate) VALUES
  ('USD', '$', 'USD - US Dollar', 1),
  ('KES', 'Ksh ', 'KES - Kenyan Shilling', 130),
  ('RWF', 'Rwf ', 'RWF - Rwandan Franc', 1200)
ON CONFLICT (code) DO NOTHING;

INSERT INTO languages (code, label) VALUES
  ('en', 'English (US)'),
  ('kin', 'Kinyarwanda'),
  ('swa', 'Kiswahili')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings (id, maintenance_mode, default_currency, default_language)
VALUES (1, false, 'USD', 'en')
ON CONFLICT (id) DO NOTHING;

-- Footer settings singleton + links
INSERT INTO footer_settings (id, location_lines, phone_number, email_address, copyright_text)
VALUES (
  1,
  ARRAY['22A Street, Kanombe', 'Kicukiro, Kigali, Rwanda'],
  '+250783655163',
  'kuisoko@gmail.com',
  '© ' || extract(year from now()) || ' KuISOKO Inc. All rights reserved. Built for MVP.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO footer_links (link_type, label, to_path, display_order) VALUES
  ('quick', 'Shop All', '/shop', 1),
  ('quick', 'Account', '/dashboard', 2),
  ('quick', 'View Cart', '/cart', 3),
  ('quick', 'Merchant Portal', '/admin', 4),
  ('support', 'FAQ', '/faq', 1),
  ('support', 'Shipping Policy', '#', 2),
  ('support', 'Privacy Policy', '#', 3),
  ('support', 'Terms of Service', '#', 4);

-- Categories
INSERT INTO categories (name, display_order) VALUES
  ('Electronics', 1),
  ('Home & Living', 2),
  ('Beauty', 3),
  ('Sports', 4),
  ('Fashion', 5)
ON CONFLICT (name) DO NOTHING;

-- Category mega-menu sections
INSERT INTO category_sections (category_id, title, items, display_order)
SELECT id, v.title, v.items, v.ord FROM categories,
  (VALUES
    ('📱 Phones & Tablets', ARRAY['Smartphones', 'Feature Phones', 'Tablets & iPads', 'E-Readers', 'Refurbished Devices'], 1),
    ('💻 Computing', ARRAY['Business Laptops', 'Gaming Laptops', '2-in-1 Laptops', 'Desktop PCs', 'Monitors'], 2),
    ('🎧 Audio & Sound', ARRAY['Wireless Headphones', 'Earbuds', 'Bluetooth Speakers', 'Home Theatre', 'Microphones'], 3),
    ('🎮 Gaming', ARRAY['Consoles', 'Controllers', 'Video Games', 'Gaming Chairs', 'VR Headsets'], 4),
    ('🔌 Tech Accessories', ARRAY['Phone Accessories', 'Cases & Covers', 'Chargers & Cables', 'Power Banks'], 5)
  ) AS v(title, items, ord)
WHERE categories.name = 'Electronics'
ON CONFLICT (category_id, title) DO NOTHING;

INSERT INTO category_sections (category_id, title, items, display_order)
SELECT id, v.title, v.items, v.ord FROM categories,
  (VALUES
    ('🛋 Furniture', ARRAY['Living Room', 'Sofas', 'Coffee Tables', 'Bedroom', 'Beds', 'Wardrobes'], 1),
    ('🍳 Kitchen', ARRAY['Cookware Sets', 'Kitchen Appliances', 'Blenders', 'Air Fryers', 'Coffee Machines'], 2),
    ('🖼 Home Decor', ARRAY['Wall Art', 'Mirrors', 'Decorative Vases', 'Clocks', 'Indoor Plants'], 3),
    ('💡 Lighting', ARRAY['Ceiling Lights', 'Floor Lamps', 'Table Lamps', 'Smart Lighting', 'Outdoor Lights'], 4),
    ('🛏 Bed & Bath', ARRAY['Bed Sheets', 'Duvet Covers', 'Pillows', 'Bath Towels', 'Bathroom Accessories'], 5)
  ) AS v(title, items, ord)
WHERE categories.name = 'Home & Living'
ON CONFLICT (category_id, title) DO NOTHING;

INSERT INTO category_sections (category_id, title, items, display_order)
SELECT id, v.title, v.items, v.ord FROM categories,
  (VALUES
    ('🧴 Skincare', ARRAY['Face Cleansers', 'Moisturizers', 'Serums & Oils', 'Sun Protection', 'Eye Care'], 1),
    ('💄 Makeup', ARRAY['Face Makeup', 'Foundations', 'Eye Makeup', 'Mascaras', 'Palettes', 'Lipstick & Gloss'], 2),
    ('💇 Haircare', ARRAY['Shampoos', 'Conditioners', 'Hair Treatments', 'Styling Tools', 'Hair Dryers', 'Straighteners'], 3),
    ('🌸 Fragrance', ARRAY['Men''s Perfumes', 'Women''s Perfumes', 'Unisex Scents', 'Body Sprays', 'Fragrance Gift Sets'], 4),
    ('✂️ Personal Care', ARRAY['Body Wash', 'Deodorants', 'Men''s Grooming', 'Trimmers', 'Shaving Kits', 'Beauty Tools'], 5)
  ) AS v(title, items, ord)
WHERE categories.name = 'Beauty'
ON CONFLICT (category_id, title) DO NOTHING;

INSERT INTO category_sections (category_id, title, items, display_order)
SELECT id, v.title, v.items, v.ord FROM categories,
  (VALUES
    ('🏋 Fitness', ARRAY['Dumbbells', 'Yoga Mats', 'Resistance Bands', 'Home Gym Sets', 'Jump Ropes'], 1),
    ('👟 Footwear', ARRAY['Running Shoes', 'Training Shoes', 'Basketball Shoes', 'Hiking Boots', 'Sports Sandals'], 2),
    ('🏕 Outdoor', ARRAY['Tents', 'Sleeping Bags', 'Camping Stoves', 'Backpacks', 'Water Bottles'], 3),
    ('🧘 Wellness', ARRAY['Yoga Accessories', 'Massagers', 'Foam Rollers', 'Supplements', 'Protein Shakers'], 4),
    ('⌚ Sports Tech', ARRAY['Smart Watches', 'Fitness Trackers', 'Heart Rate Monitors', 'Sports Headphones', 'Action Cameras'], 5)
  ) AS v(title, items, ord)
WHERE categories.name = 'Sports'
ON CONFLICT (category_id, title) DO NOTHING;

INSERT INTO category_sections (category_id, title, items, display_order)
SELECT id, v.title, v.items, v.ord FROM categories,
  (VALUES
    ('👕 Men''s Fashion', ARRAY['T-Shirts', 'Shirts', 'Hoodies', 'Jeans & Pants', 'Jackets'], 1),
    ('👗 Women''s Fashion', ARRAY['Dresses', 'Blouses', 'Skirts', 'Leggings', 'Coats & Knits'], 2),
    ('🧒 Kids & Baby', ARRAY['Boys'' Wear', 'Girls'' Wear', 'Baby Onesies', 'School Uniforms', 'Kids'' Shoes'], 3),
    ('👜 Accessories', ARRAY['Handbags', 'Backpacks', 'Wallets', 'Belts', 'Travel Bags'], 4),
    ('💎 Jewelry & Watches', ARRAY['Luxury Watches', 'Necklaces', 'Earrings', 'Bracelets', 'Sunglasses'], 5)
  ) AS v(title, items, ord)
WHERE categories.name = 'Fashion'
ON CONFLICT (category_id, title) DO NOTHING;

COMMIT;
