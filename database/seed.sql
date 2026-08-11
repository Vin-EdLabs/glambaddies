-- GlamBaddies seed data — girls' dresses only (GHS pesewas)
-- Usage: psql -d glambaddies_db -f database/seed.sql   (after schema.sql)
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
  ('GlamBaddies Admin', 'admin@glambaddies.com', '$2b$10$qGEh3y7F9P/bnv12BaiF.O80ggPyVj26ryEIrPQ3NImItibZsrbSm');

-- ------------------------------------------------------------- categories
-- Top-level Dresses + dress subcategories only
INSERT INTO categories (name, slug, description) VALUES
  ('Dresses',         'dresses',         'Girls'' dresses for every occasion'),
  ('Casual Dresses',  'casual-dresses',  'Everyday and weekend dresses'),
  ('Party Dresses',   'party-dresses',   'Celebration and special-occasion dresses'),
  ('School Dresses',  'school-dresses',  'Smart uniforms and school-day dresses');

-- --------------------------------------------------------------- products (prices in GHS pesewas)
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active) VALUES
  (2, 'Floral Summer Dress', 'floral-summer-dress',
   'Light floaty dress in a fresh floral print with a smocked bodice and flutter sleeves. Perfect for sunny days.', 29900, 30, TRUE),
  (3, 'Girls'' Tulle Party Dress', 'girls-tulle-party-dress',
   'A dreamy layered tulle skirt with a satin bodice and bow sash. Sizes for ages 3–12. Made for twirling.', 34900, 35, TRUE),
  (3, 'Elegant Evening Gown', 'elegant-evening-gown',
   'Floor-length gown in flowing chiffon with a fitted waist and subtle shimmer. A red-carpet moment.', 58900, 12, TRUE),
  (2, 'Polka Dot Midi Dress', 'polka-dot-midi-dress',
   'Playful polka-dot midi with a wrap front, short sleeves and a flattering tie waist.', 27900, 28, TRUE),
  (2, 'Girls'' Cotton Sundress', 'girls-cotton-sundress',
   'Soft breathable cotton sundress with adjustable straps and a gathered skirt. Easy everyday wear for ages 2–10.', 19900, 45, TRUE),
  (4, 'Smart Plaid School Dress', 'smart-plaid-school-dress',
   'Classic plaid school dress with a peter-pan collar and button front. Comfortable for all-day wear.', 24900, 40, TRUE),
  (4, 'Navy Uniform Day Dress', 'navy-uniform-day-dress',
   'Neat navy day dress with white piping and a removable sash. Ideal for school and assemblies.', 22900, 38, TRUE),
  (3, 'Sparkle Birthday Dress', 'sparkle-birthday-dress',
   'Shimmer tulle party dress with sequin bodice — birthday-ready and photo-perfect.', 39900, 22, TRUE),
  (2, 'Linen Ruffle Casual Dress', 'linen-ruffle-casual-dress',
   'Soft linen-blend casual dress with ruffle hem and side pockets. Everyday glam for little fashionistas.', 25900, 32, TRUE),
  (1, 'Classic A-Line Dress', 'classic-a-line-dress',
   'Timeless A-line silhouette in soft jersey. A wardrobe staple from playground to party.', 21900, 50, TRUE);

-- ----------------------------------------------------------------- images (glamorous model photography)
INSERT INTO product_images (product_id, url, is_primary) VALUES
  (1,  'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=85', TRUE),
  (2,  'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=85', TRUE),
  (3,  'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=85', TRUE),
  (4,  'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1200&q=85', TRUE),
  (5,  'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=1200&q=85', TRUE),
  (6,  'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=85', TRUE),
  (7,  'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=85', TRUE),
  (8,  'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=1200&q=85', TRUE),
  (9,  'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=85', TRUE),
  (10, 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=85', TRUE);

-- ------------------------------------------------------------- cart items
INSERT INTO cart_items (user_id, product_id, quantity) VALUES
  (1, 1, 1),
  (1, 2, 1),
  (2, 5, 1);

-- ----------------------------------------------------------------- orders (GHS)
INSERT INTO orders (user_id, status, currency, total_cents, shipping_address, payment_reference, paystack_transaction_id, paid_at)
VALUES
  (1, 'paid', 'GHS', 64800,
   '{"line1": "12 Independence Ave", "city": "Accra", "country": "GH", "phone": "+233201234567"}',
   'GLAM-1-seedref0001', 4100001, NOW() - INTERVAL '6 days'),
  (2, 'delivered', 'GHS', 19900,
   '{"line1": "45 Ring Road", "city": "Kumasi", "country": "GH", "phone": "+233209876543"}',
   'GLAM-2-seedref0002', 4100002, NOW() - INTERVAL '20 days'),
  (3, 'pending', 'GHS', 27900,
   '{"line1": "8 Beach Rd", "city": "Takoradi", "country": "GH", "phone": "+233241112223"}',
   NULL, NULL, NULL);

INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity) VALUES
  (1, 1,  'Floral Summer Dress', 29900, 1),
  (1, 2,  'Girls'' Tulle Party Dress', 34900, 1),
  (2, 5,  'Girls'' Cotton Sundress', 19900, 1),
  (3, 4,  'Polka Dot Midi Dress', 27900, 1);

INSERT INTO payments (order_id, reference, provider, transaction_id, amount_cents, currency, status, channel, raw_response, verified_at) VALUES
  (1, 'GLAM-1-seedref0001', 'paystack', 4100001, 64800, 'GHS', 'success', 'card',
   '{"id": 4100001, "status": "success", "amount": 64800, "currency": "GHS"}', NOW() - INTERVAL '6 days'),
  (2, 'GLAM-2-seedref0002', 'paystack', 4100002, 19900, 'GHS', 'success', 'card',
   '{"id": 4100002, "status": "success", "amount": 19900, "currency": "GHS"}', NOW() - INTERVAL '20 days');

COMMIT;
