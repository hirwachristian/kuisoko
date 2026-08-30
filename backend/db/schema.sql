-- KuISOKO PostgreSQL schema
-- Mirrors the data model currently mocked in constants.ts / context/AppContext.tsx
-- Run with: psql -d kuisoko -f db/schema.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gives us gen_random_uuid()

CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE order_status AS ENUM ('Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled');
CREATE TYPE footer_link_type AS ENUM ('quick', 'support');

-- Shared trigger: keep updated_at current on every UPDATE
CREATE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name              TEXT NOT NULL,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  phone_number      TEXT,
  address           TEXT,
  role              user_role NOT NULL DEFAULT 'user',
  profile_image     TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true, -- admin can deactivate to block login
  is_unread         BOOLEAN NOT NULL DEFAULT true, -- new-registration flag for admin notifications
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- "Forgot password" flow: single-use, expiring reset tokens emailed to the account holder.
-- Only the SHA-256 hash of the token is stored, never the raw value.
CREATE TABLE password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- Email change verification: single-use, expiring tokens emailed to the *new* address, so an
-- account's email can't be changed without proving control of the new inbox first.
CREATE TABLE email_change_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_email   TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_email_change_tokens_user_id ON email_change_tokens(user_id);

-- ---------------------------------------------------------------------------
-- Categories & mega-menu sections
-- ---------------------------------------------------------------------------
CREATE TABLE categories (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL UNIQUE,
  display_order  INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE category_sections (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id    UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  items          TEXT[] NOT NULL DEFAULT '{}', -- mega-menu leaf labels (not FK'd to products)
  display_order  INT NOT NULL DEFAULT 0,
  UNIQUE (category_id, title)
);
CREATE INDEX idx_category_sections_category_id ON category_sections(category_id);

-- ---------------------------------------------------------------------------
-- Products, variants, reviews
-- ---------------------------------------------------------------------------
CREATE TABLE products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  description    TEXT,
  price          NUMERIC(12,2) NOT NULL CHECK (price >= 0),      -- base price, RWF
  discount       NUMERIC(5,2) CHECK (discount >= 0 AND discount <= 100),
  category_id    UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  sub_category   TEXT NOT NULL,
  images         TEXT[] NOT NULL DEFAULT '{}',
  video_urls     TEXT[] NOT NULL DEFAULT '{}',                     -- optional showcase/demo videos
  rating         NUMERIC(2,1) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  reviews_count  INT NOT NULL DEFAULT 0,                          -- denormalized, kept in sync by trigger below
  stock          INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  featured       BOOLEAN NOT NULL DEFAULT false,
  image_hash     TEXT,                                             -- perceptual hash (dHash) of images[0], for "search by photo"
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_featured ON products(featured) WHERE featured = true;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE product_variants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku         TEXT NOT NULL UNIQUE,
  color       TEXT,
  size        TEXT,
  price       NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  stock       INT NOT NULL DEFAULT 0 CHECK (stock >= 0)
);
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);

CREATE TABLE reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  user_name   TEXT NOT NULL,          -- snapshot, survives account deletion
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  image       TEXT,
  is_hidden   BOOLEAN NOT NULL DEFAULT false, -- admin can hide from public view without deleting
  is_unread   BOOLEAN NOT NULL DEFAULT true,  -- new-review flag for admin notifications
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reviews_product_id ON reviews(product_id);

-- Keep products.rating / reviews_count in sync whenever reviews change (hidden reviews don't count)
CREATE FUNCTION refresh_product_rating() RETURNS TRIGGER AS $$
DECLARE
  target_product_id UUID := COALESCE(NEW.product_id, OLD.product_id);
BEGIN
  UPDATE products p
  SET reviews_count = agg.cnt,
      rating = COALESCE(agg.avg_rating, 0)
  FROM (
    SELECT COUNT(*) AS cnt, ROUND(AVG(rating)::numeric, 1) AS avg_rating
    FROM reviews WHERE product_id = target_product_id AND is_hidden = false
  ) agg
  WHERE p.id = target_product_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reviews_refresh_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION refresh_product_rating();

-- ---------------------------------------------------------------------------
-- Wishlist (user <-> product)
-- ---------------------------------------------------------------------------
CREATE TABLE wishlists (
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Cart (user <-> product) - per-account, persists across logout/login and devices
-- ---------------------------------------------------------------------------
CREATE TABLE cart_items (
  user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity       INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  selected_color TEXT,
  selected_size  TEXT,
  unit_price     NUMERIC(12,2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Shipping zones - district-based flat shipping fees, admin-configurable
-- ---------------------------------------------------------------------------
CREATE TABLE shipping_zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  districts   TEXT[] NOT NULL DEFAULT '{}', -- district names this zone covers (case-insensitive match)
  fee         NUMERIC(12,2) NOT NULL CHECK (fee >= 0), -- RWF
  is_default  BOOLEAN NOT NULL DEFAULT false, -- fallback zone when a district matches no other zone
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- At most one default zone at a time
CREATE UNIQUE INDEX idx_shipping_zones_single_default ON shipping_zones (is_default) WHERE is_default;
CREATE TRIGGER trg_shipping_zones_updated_at BEFORE UPDATE ON shipping_zones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE shipping_settings (
  id                       SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton row
  free_shipping_threshold  NUMERIC(12,2) NOT NULL DEFAULT 0, -- RWF subtotal at/above which shipping is free; 0 disables it
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_shipping_settings_updated_at BEFORE UPDATE ON shipping_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Orders, line items, tracking history
-- ---------------------------------------------------------------------------

-- Random (not sequential) 6-digit order number, so order volume can't be inferred externally
CREATE FUNCTION generate_order_number() RETURNS BIGINT AS $$
DECLARE
  new_number BIGINT;
BEGIN
  LOOP
    new_number := floor(random() * 900000 + 100000)::BIGINT; -- 100000-999999
    EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE order_number = new_number);
  END LOOP;
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Coupons / promo codes
-- ---------------------------------------------------------------------------
CREATE TABLE coupons (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL UNIQUE, -- stored uppercase, e.g. 'SAVE20'
  discount_type     TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value    NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
  min_order_amount  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
  usage_limit       INT CHECK (usage_limit IS NULL OR usage_limit > 0), -- NULL = unlimited
  usage_count       INT NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  expires_at        TIMESTAMPTZ, -- NULL = no expiry
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE orders (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number                BIGINT NOT NULL UNIQUE DEFAULT generate_order_number(), -- human-readable, displayed as KS-<order_number>
  user_id                     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  customer_name               TEXT NOT NULL,          -- snapshot
  delivery_full_name          TEXT NOT NULL,
  delivery_phone_number       TEXT NOT NULL,
  customer_email              TEXT,                    -- for transactional emails (order confirmation, etc.); guest checkouts included
  delivery_country            TEXT NOT NULL,
  delivery_city_town          TEXT NOT NULL,
  delivery_district           TEXT NOT NULL,
  delivery_street_address     TEXT NOT NULL,
  delivery_house_building_no  TEXT,
  delivery_additional_info    TEXT,
  order_date                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  subtotal                    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0), -- RWF, sum of item prices
  shipping_fee                NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0), -- RWF, from the matched shipping zone
  shipping_zone               TEXT,                    -- name of the shipping zone applied
  tax                         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax >= 0), -- RWF
  coupon_code                 TEXT,                    -- code applied at checkout, if any
  discount_amount             NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0), -- RWF, from the coupon
  total                       NUMERIC(12,2) NOT NULL CHECK (total >= 0), -- stored in RWF; subtotal + shipping_fee + tax - discount_amount
  currency                    TEXT,                    -- display currency label, e.g. 'RWF'
  status                      order_status NOT NULL DEFAULT 'Pending',
  payment_status               TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'failed')),
  payment_method               TEXT,
  is_unread                   BOOLEAN NOT NULL DEFAULT true,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name    TEXT NOT NULL,      -- snapshot
  image           TEXT,               -- snapshot of primary product image
  unit_price      NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0), -- RWF at time of order
  quantity        INT NOT NULL CHECK (quantity > 0),
  selected_color  TEXT,
  selected_size   TEXT
);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

CREATE TABLE order_tracking_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status       TEXT NOT NULL,
  event_date   TIMESTAMPTZ NOT NULL DEFAULT now(),
  description  TEXT
);
CREATE INDEX idx_order_tracking_events_order_id ON order_tracking_events(order_id);

-- ---------------------------------------------------------------------------
-- MTN MoMo "Request to Pay" transactions
-- ---------------------------------------------------------------------------
CREATE TABLE momo_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id  UUID NOT NULL UNIQUE, -- X-Reference-Id sent to the MTN MoMo API
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  phone_number  TEXT NOT NULL,        -- MSISDN the payment prompt was sent to
  amount        NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency      TEXT NOT NULL DEFAULT 'EUR',
  status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESSFUL', 'FAILED')),
  reason        TEXT,                 -- failure reason, if any, from MTN
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_momo_transactions_order_id ON momo_transactions(order_id);
CREATE TRIGGER trg_momo_transactions_updated_at BEFORE UPDATE ON momo_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Newsletter ("Join our inner circle") subscriptions
-- ---------------------------------------------------------------------------
CREATE TABLE newsletter_subscribers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL UNIQUE,
  user_id          BIGINT REFERENCES users(id) ON DELETE SET NULL, -- set if the subscriber is also a registered user
  is_active        BOOLEAN NOT NULL DEFAULT true,
  is_unread        BOOLEAN NOT NULL DEFAULT true, -- new-subscriber flag for admin notifications
  subscribed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at  TIMESTAMPTZ
);
CREATE INDEX idx_newsletter_subscribers_email ON newsletter_subscribers(email);

-- ---------------------------------------------------------------------------
-- Dismissed admin notifications (NotificationPanel's "Delete"/hide action)
-- ---------------------------------------------------------------------------
CREATE TABLE dismissed_notifications (
  notification_id  TEXT PRIMARY KEY, -- e.g. 'order-<uuid>' or 'user-<id>'
  dismissed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Storefront settings (footer, payment methods, currency, maintenance mode)
-- ---------------------------------------------------------------------------
CREATE TABLE footer_settings (
  id              SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton row
  location_lines  TEXT[] NOT NULL DEFAULT '{}',
  phone_number    TEXT,
  email_address   TEXT,
  copyright_text  TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_footer_settings_updated_at BEFORE UPDATE ON footer_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE footer_links (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_type      footer_link_type NOT NULL,
  label          TEXT NOT NULL,
  to_path        TEXT NOT NULL,
  display_order  INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_footer_links_type ON footer_links(link_type);

CREATE TABLE payment_methods (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name    TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  detail  TEXT
);

CREATE TABLE currencies (
  code           TEXT PRIMARY KEY,        -- 'USD', 'KES', 'RWF'
  symbol         TEXT NOT NULL,
  label          TEXT NOT NULL,
  exchange_rate  NUMERIC(12,4) NOT NULL CHECK (exchange_rate > 0) -- relative to 1 USD
);

CREATE TABLE languages (
  code   TEXT PRIMARY KEY,  -- 'en', 'kin', 'swa'
  label  TEXT NOT NULL
);

CREATE TABLE app_settings (
  id                          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton row
  maintenance_mode            BOOLEAN NOT NULL DEFAULT false,
  default_currency            TEXT NOT NULL REFERENCES currencies(code),
  default_language            TEXT NOT NULL REFERENCES languages(code),
  marketing_emails_enabled    BOOLEAN NOT NULL DEFAULT true, -- "Push Alerts": admin-sent discount/special emails to newsletter subscribers
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_app_settings_updated_at BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Site-wide announcement banners (shown above the navbar) - multiple can be live at once.
CREATE TABLE site_announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message     TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  expires_at  TIMESTAMPTZ, -- NULL = no auto-expiry; only the admin can turn it off, no visitor dismiss
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_site_announcements_active ON site_announcements(is_active);
CREATE TRIGGER trg_site_announcements_updated_at BEFORE UPDATE ON site_announcements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Customer <-> admin support chat: one running conversation per customer (identified by
-- user_id), all admins share the same inbox. Read flags are tracked separately per side so
-- each party's unread badge only reflects messages the *other* side sent.
CREATE TABLE chat_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role    TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
  sender_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  body           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_by_user   BOOLEAN NOT NULL DEFAULT false,
  read_by_admin  BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id, created_at);

-- Contact Us submissions, surfaced to admins as an "Enquiries" inbox. Replies are sent by email
-- only, to whichever address the visitor provided - there's no guarantee they have an account or
-- would ever see an in-app reply, so email is the only reliable channel back to them.
CREATE TABLE enquiries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  subject     TEXT NOT NULL,
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'replied')),
  reply_body  TEXT,
  replied_at  TIMESTAMPTZ,
  replied_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  is_unread   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_enquiries_created_at ON enquiries(created_at DESC);

COMMIT;
