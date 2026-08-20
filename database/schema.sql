-- GlamBaddies PostgreSQL schema
-- Usage: psql -d glambaddies_db -f database/schema.sql

BEGIN;

DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS store_settings CASCADE;

CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(120)  NOT NULL,
    phone         VARCHAR(40),
    email         VARCHAR(255)  UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX users_phone_unique
  ON users (phone)
  WHERE phone IS NOT NULL AND phone <> '';

CREATE TABLE admins (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(120)  NOT NULL,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(120) NOT NULL UNIQUE,
    slug        VARCHAR(140) NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
    id           SERIAL PRIMARY KEY,
    category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name         VARCHAR(200) NOT NULL,
    slug         VARCHAR(220) NOT NULL UNIQUE,
    description  TEXT         NOT NULL DEFAULT '',
    -- All monetary amounts are stored as integer GHS pesewas (1 GHS = 100).
    price_cents  INTEGER      NOT NULL CHECK (price_cents >= 0),
    compare_at_price_cents INTEGER CHECK (compare_at_price_cents IS NULL OR compare_at_price_cents >= 0),
    discount_percent INTEGER CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 95)),
    sale_ends_at TIMESTAMPTZ,
    is_on_sale   BOOLEAN      NOT NULL DEFAULT FALSE,
    available_colors JSONB,
    stock        INTEGER      NOT NULL DEFAULT 0 CHECK (stock >= 0),
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_category  ON products(category_id);
CREATE INDEX idx_products_active    ON products(is_active);
CREATE INDEX idx_products_name_trgm ON products(LOWER(name));

CREATE TABLE product_images (
    id         SERIAL PRIMARY KEY,
    product_id INTEGER      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url        VARCHAR(500) NOT NULL,
    is_primary BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_images_product ON product_images(product_id);

CREATE TABLE cart_items (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER     NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    product_id INTEGER     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity   INTEGER     NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);

CREATE INDEX idx_cart_items_user ON cart_items(user_id);

CREATE TABLE orders (
    id                     SERIAL PRIMARY KEY,
    -- Nullable so guests can checkout without creating an account.
    user_id                INTEGER      REFERENCES users(id) ON DELETE RESTRICT,
    status                 VARCHAR(20)  NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'paid', 'shipped', 'out_for_delivery', 'delivered', 'cancelled')),
    currency               CHAR(3)      NOT NULL DEFAULT 'GHS',
    total_cents            INTEGER      NOT NULL CHECK (total_cents >= 0),
    shipping_address       JSONB        NOT NULL DEFAULT '{}'::jsonb,
    payment_reference      VARCHAR(100) UNIQUE,
    paystack_transaction_id BIGINT,
    paid_at                TIMESTAMPTZ,
    rider_name             VARCHAR(120),
    rider_phone            VARCHAR(40),
    rider_photo_url        VARCHAR(500),
    rider_assigned_at      TIMESTAMPTZ,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user   ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

CREATE TABLE order_items (
    id               SERIAL PRIMARY KEY,
    order_id         INTEGER      NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id       INTEGER      REFERENCES products(id) ON DELETE SET NULL,
    -- Snapshot of the product at purchase time.
    product_name     VARCHAR(200) NOT NULL,
    unit_price_cents INTEGER      NOT NULL CHECK (unit_price_cents >= 0),
    quantity         INTEGER      NOT NULL CHECK (quantity > 0)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- Audit log of verified Paystack transactions. The UNIQUE reference makes
-- payment processing idempotent at the database level.
CREATE TABLE payments (
    id             SERIAL PRIMARY KEY,
    order_id       INTEGER      NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    reference      VARCHAR(100) NOT NULL UNIQUE,
    provider       VARCHAR(30)  NOT NULL DEFAULT 'paystack',
    transaction_id BIGINT,
    amount_cents   INTEGER      NOT NULL,
    currency       CHAR(3)      NOT NULL,
    status         VARCHAR(30)  NOT NULL,
    channel        VARCHAR(50),
    raw_response   JSONB,
    verified_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Single-row store configuration (purchases open / paused + Paystack keys).
CREATE TABLE store_settings (
    id                         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    purchases_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    payment_mode               TEXT NOT NULL DEFAULT 'test'
                               CHECK (payment_mode IN ('test', 'live')),
    paystack_test_public_key   TEXT NOT NULL DEFAULT '',
    paystack_test_secret_key   TEXT NOT NULL DEFAULT '',
    paystack_live_public_key   TEXT NOT NULL DEFAULT '',
    paystack_live_secret_key   TEXT NOT NULL DEFAULT '',
    usd_to_ghs_rate            NUMERIC(12,4) NOT NULL DEFAULT 15.5,
    announcement_text          VARCHAR(120) NOT NULL DEFAULT 'Shop · Slay · Shine',
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO store_settings (id, purchases_enabled) VALUES (1, TRUE);

CREATE TABLE newsletter_subscribers (
    id         SERIAL PRIMARY KEY,
    email      VARCHAR(255) NOT NULL,
    source     VARCHAR(60)  NOT NULL DEFAULT 'footer',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT newsletter_subscribers_email_unique UNIQUE (email)
);

CREATE INDEX idx_newsletter_created ON newsletter_subscribers (created_at DESC);

COMMIT;
