-- Allow guest (no account) checkouts
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;
