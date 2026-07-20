-- Private list / newsletter subscribers
-- Usage: node backend/scripts/apply-sql.js database/newsletter.sql

BEGIN;

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id         SERIAL PRIMARY KEY,
    email      VARCHAR(255) NOT NULL,
    source     VARCHAR(60)  NOT NULL DEFAULT 'footer',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT newsletter_subscribers_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_newsletter_created
  ON newsletter_subscribers (created_at DESC);

COMMIT;
