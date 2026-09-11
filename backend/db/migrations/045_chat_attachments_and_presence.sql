BEGIN;

-- Attachments: a message can now carry a file/image instead of (or alongside) text, so body can
-- no longer be required.
ALTER TABLE chat_messages ALTER COLUMN body DROP NOT NULL;
ALTER TABLE chat_messages ADD COLUMN attachment_url TEXT;
ALTER TABLE chat_messages ADD COLUMN attachment_type TEXT; -- mime type, so the UI knows image vs generic file
ALTER TABLE chat_messages ADD COLUMN attachment_name TEXT; -- original filename, shown in the UI instead of the randomized storage name

-- Admin presence: last time any admin made an authenticated request, used to show customers a
-- simple "admin is online" indicator (see middleware/auth.ts).
ALTER TABLE users ADD COLUMN last_active_at TIMESTAMPTZ;

COMMIT;
