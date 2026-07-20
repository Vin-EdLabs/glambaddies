-- Bumps whenever products change so storefronts can invalidate cached catalogues.
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS catalogue_revision BIGINT NOT NULL DEFAULT 1;
