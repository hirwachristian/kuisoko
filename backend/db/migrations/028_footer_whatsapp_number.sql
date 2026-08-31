-- Adds the WhatsApp contact number to footer_settings. The frontend's "Contact & Storefront"
-- admin section has had a WhatsApp field for a while, but this column never existed - so it was
-- never actually saved anywhere the backend could serve it, only written to the admin's own
-- browser localStorage (see the AppContext.tsx footer-settings fix that goes with this migration).
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/028_footer_whatsapp_number.sql

BEGIN;

ALTER TABLE footer_settings ADD COLUMN whatsapp_number TEXT;

-- Seed it from the existing phone number so the singleton row isn't left with a blank WhatsApp
-- number the first time this is deployed (matches the previous frontend-only default, which used
-- the same number for both fields).
UPDATE footer_settings SET whatsapp_number = phone_number WHERE id = 1 AND whatsapp_number IS NULL;

COMMIT;
