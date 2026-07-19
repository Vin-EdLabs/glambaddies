-- Vublishop seed data
-- Usage: psql -d vublishop -f database/seed.sql   (after schema.sql)
--
-- Demo credentials (bcrypt-hashed below):
--   Customers: password  "Customer123!"
--   Admin:     password  "Admin123!"

BEGIN;

TRUNCATE payments, order_items, orders, cart_items, product_images,
         products, categories, admins, users RESTART IDENTITY CASCADE;

-- ------------------------------------------------------------------ users
INSERT INTO users (name, email, password_hash) VALUES
  ('Ama Mensah',    'ama.mensah@example.com',    '$2b$10$oieufpavtegA9bHHGdu1dOmiD8X6YN4rScLDY/.G7q3qnnk1NlvBa'),
  ('Kwame Boateng', 'kwame.boateng@example.com', '$2b$10$oieufpavtegA9bHHGdu1dOmiD8X6YN4rScLDY/.G7q3qnnk1NlvBa'),
  ('Efua Owusu',    'efua.owusu@example.com',    '$2b$10$oieufpavtegA9bHHGdu1dOmiD8X6YN4rScLDY/.G7q3qnnk1NlvBa');

-- ----------------------------------------------------------------- admins
INSERT INTO admins (name, email, password_hash) VALUES
  ('Vublishop Admin', 'admin@vublishop.com', '$2b$10$qGEh3y7F9P/bnv12BaiF.O80ggPyVj26ryEIrPQ3NImItibZsrbSm');

-- ------------------------------------------------------------- categories
INSERT INTO categories (name, slug, description) VALUES
  ('Electronics',   'electronics',   'Phones, audio, computing and accessories'),
  ('Fashion',       'fashion',       'Clothing, shoes and accessories for every style'),
  ('Home & Living', 'home-living',   'Furniture, decor and kitchen essentials'),
  ('Beauty',        'beauty',        'Skincare, fragrance and personal care'),
  ('Sports',        'sports',        'Fitness gear and outdoor equipment'),
  ('Games',         'games',         'Consoles, controllers and play essentials');

-- --------------------------------------------------------------- products
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active) VALUES
  (1, 'Wireless Noise-Cancelling Headphones', 'wireless-noise-cancelling-headphones',
   'Over-ear Bluetooth headphones with active noise cancellation, 35-hour battery life and USB-C fast charging.', 12999, 45, TRUE),
  (1, 'Smartwatch Series X', 'smartwatch-series-x',
   'Fitness-focused smartwatch with heart-rate tracking, GPS and a 1.9-inch AMOLED display. Water resistant to 50m.', 19999, 30, TRUE),
  (1, 'Portable Bluetooth Speaker', 'portable-bluetooth-speaker',
   'Compact 20W speaker with deep bass, IPX7 waterproofing and 12 hours of playtime.', 5999, 80, TRUE),
  (1, 'USB-C Fast Charger 65W', 'usb-c-fast-charger-65w',
   'GaN wall charger with two USB-C ports and one USB-A port. Charges laptops, tablets and phones.', 3499, 120, TRUE),
  (2, 'Classic Denim Jacket', 'classic-denim-jacket',
   'Unisex medium-wash denim jacket with button front and chest pockets. 100% cotton.', 6499, 60, TRUE),
  (2, 'Leather Crossbody Bag', 'leather-crossbody-bag',
   'Handcrafted genuine leather bag with adjustable strap and three interior compartments.', 8999, 25, TRUE),
  (2, 'Canvas Low-Top Sneakers', 'canvas-low-top-sneakers',
   'Everyday sneakers with cushioned insole and vulcanized rubber outsole. Available in multiple colors.', 4599, 90, TRUE),
  (3, 'Ceramic Pour-Over Coffee Set', 'ceramic-pour-over-coffee-set',
   'Matte ceramic dripper with matching carafe and reusable stainless steel filter. Brews 2-4 cups.', 4299, 40, TRUE),
  (3, 'Linen Throw Blanket', 'linen-throw-blanket',
   'Stonewashed 100% linen throw, 130x170cm. Breathable and machine washable.', 5499, 35, TRUE),
  (3, 'Minimalist Desk Lamp', 'minimalist-desk-lamp',
   'Dimmable LED desk lamp with touch controls, three color temperatures and a USB charging port.', 3899, 55, TRUE),
  (4, 'Vitamin C Brightening Serum', 'vitamin-c-brightening-serum',
   '15% vitamin C serum with hyaluronic acid and vitamin E. Fragrance-free, 30ml.', 2799, 100, TRUE),
  (4, 'Shea Butter Body Cream', 'shea-butter-body-cream',
   'Rich 48-hour moisture cream made with unrefined shea butter. 200ml jar.', 1899, 150, TRUE),
  (5, 'Adjustable Dumbbell Set 2x12kg', 'adjustable-dumbbell-set-2x12kg',
   'Pair of adjustable dumbbells with quick-lock plates, 2-12kg per hand.', 14999, 20, TRUE),
  (5, 'Premium Yoga Mat', 'premium-yoga-mat',
   '6mm non-slip TPE yoga mat with alignment lines and carrying strap. 183x61cm.', 3299, 70, TRUE),
  (6, 'Wireless Pro Controller', 'wireless-pro-controller',
   'Responsive wireless controller with adaptive triggers, haptic feedback and 40-hour battery life.', 6999, 40, TRUE),
  (6, 'Compact Gaming Headset', 'compact-gaming-headset',
   'Lightweight over-ear headset with spatial audio, detachable mic and USB-C charging.', 8999, 28, TRUE),
  (1, 'Mechanical Keyboard TKL', 'mechanical-keyboard-tkl',
   'Tenkeyless hot-swappable mechanical keyboard with tactile switches and white backlight. (Discontinued colorway)', 8499, 0, FALSE);

-- ----------------------------------------------------------------- images
INSERT INTO product_images (product_id, url, is_primary) VALUES
  (1,  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=85', TRUE),
  (2,  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=85', TRUE),
  (3,  'https://images.unsplash.com/photo-1608043152269-423dbba4b7c1?auto=format&fit=crop&w=1200&q=85', TRUE),
  (4,  'https://images.unsplash.com/photo-1583863788434-e58a36338f94?auto=format&fit=crop&w=1200&q=85', TRUE),
  (5,  'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1200&q=85', TRUE),
  (6,  'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=85', TRUE),
  (7,  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=85', TRUE),
  (8,  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=85', TRUE),
  (9,  'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=1200&q=85', TRUE),
  (10, 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1200&q=85', TRUE),
  (11, 'https://images.unsplash.com/photo-1620916297397-a4a3372a4c9c?auto=format&fit=crop&w=1200&q=85', TRUE),
  (12, 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=1200&q=85', TRUE),
  (13, 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=85', TRUE),
  (14, 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?auto=format&fit=crop&w=1200&q=85', TRUE),
  (15, 'https://images.unsplash.com/photo-1592840496694-26d035b52b48?auto=format&fit=crop&w=1200&q=85', TRUE),
  (16, 'https://images.unsplash.com/photo-1612287230202-1ff1d867d123?auto=format&fit=crop&w=1200&q=85', TRUE);

-- ------------------------------------------------------------- cart items
INSERT INTO cart_items (user_id, product_id, quantity) VALUES
  (1, 3, 1),
  (1, 11, 2),
  (2, 14, 1);

-- ----------------------------------------------------------------- orders
-- Ama: a paid order (headphones + serum).
INSERT INTO orders (user_id, status, currency, total_cents, shipping_address, payment_reference, paystack_transaction_id, paid_at)
VALUES
  (1, 'paid', 'USD', 15798,
   '{"line1": "12 Independence Ave", "city": "Accra", "country": "GH", "phone": "+233201234567"}',
   'VUB-1-seedref0001', 4100001, NOW() - INTERVAL '6 days'),
  (2, 'delivered', 'USD', 6499,
   '{"line1": "45 Ring Road", "city": "Kumasi", "country": "GH", "phone": "+233209876543"}',
   'VUB-2-seedref0002', 4100002, NOW() - INTERVAL '20 days'),
  (3, 'pending', 'USD', 4299,
   '{"line1": "8 Beach Rd", "city": "Takoradi", "country": "GH", "phone": "+233241112223"}',
   NULL, NULL, NULL);

INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity) VALUES
  (1, 1,  'Wireless Noise-Cancelling Headphones', 12999, 1),
  (1, 11, 'Vitamin C Brightening Serum',           2799, 1),
  (2, 5,  'Classic Denim Jacket',                  6499, 1),
  (3, 8,  'Ceramic Pour-Over Coffee Set',          4299, 1);

INSERT INTO payments (order_id, reference, provider, transaction_id, amount_cents, currency, status, channel, raw_response, verified_at) VALUES
  (1, 'VUB-1-seedref0001', 'paystack', 4100001, 15798, 'USD', 'success', 'card',
   '{"id": 4100001, "status": "success", "amount": 15798, "currency": "USD"}', NOW() - INTERVAL '6 days'),
  (2, 'VUB-2-seedref0002', 'paystack', 4100002, 6499, 'USD', 'success', 'card',
   '{"id": 4100002, "status": "success", "amount": 6499, "currency": "USD"}', NOW() - INTERVAL '20 days');

COMMIT;
