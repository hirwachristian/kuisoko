import rateLimit from 'express-rate-limit';

/** Login: only failed attempts count (skipSuccessfulRequests) - protects against brute-forcing
 * a password without penalizing a legitimate user who logs in repeatedly across devices. */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Please try again in a few minutes.' },
});

/** Signup: caps how many accounts one address can create in an hour, regardless of outcome. */
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many accounts created from this address. Please try again later.' },
});

/** Forgot-password: caps how many reset emails one address can trigger in an hour - the
 * endpoint's response is identical whether or not the email exists, so this is the only
 * real defense against using it to spam an arbitrary inbox. */
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset requests. Please try again later.' },
});

/** Email-change requests: caps how many verification emails one signed-in account can trigger
 * in an hour - this endpoint is authenticated (unlike forgot-password) but a new email address
 * could still be typo'd or malicious, so it shouldn't be usable to spam an arbitrary inbox. */
export const emailChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many email change requests. Please try again later.' },
});

/** Contact form submissions: public and unauthenticated, so this is the only defense against
 * using it to spam the admin inbox or flood an arbitrary "from" address with replies. */
export const enquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages sent. Please try again later.' },
});

/** 2FA code verification: only failed attempts count - a 6-digit code is just 1,000,000
 * combinations, so without this an attacker holding a valid pending-login token could brute-force
 * it in well under the code's 10-minute expiry. */
export const twoFactorVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

/** 2FA code sending (login codes, resends, and starting 2FA setup): caps how many codes one
 * account can trigger in an hour, the same reasoning as forgotPasswordLimiter/emailChangeLimiter. */
export const twoFactorCodeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification codes requested. Please try again later.' },
});

/** Category translation suggestions: calls a third-party free API per request, so this caps how
 * often one admin session can request suggestions - generous enough for normal category editing,
 * not for scripting bulk translation of unrelated text through this endpoint. */
export const translateSuggestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many translation requests. Please try again later.' },
});

/** Search-by-photo: public and unauthenticated, and each request decodes/hashes an uploaded
 * image - real CPU work with no login required to trigger it, so this caps how often one IP can
 * call it rather than leaving it wide open to being hammered. */
export const imageSearchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many image searches. Please try again in a few minutes.' },
});

/** WhatsApp-checkout verification code sending: public and unauthenticated (guest checkout),
 * same reasoning as forgotPasswordLimiter - caps how many codes one IP can trigger to an
 * arbitrary email address in an hour. */
export const checkoutVerificationCodeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification codes requested. Please try again later.' },
});

/** WhatsApp-checkout code verification: only failed attempts count, same reasoning as
 * twoFactorVerifyLimiter - a 6-digit code is brute-forceable well within its 10-minute expiry
 * without this. */
export const checkoutVerificationVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

/** Forgot-password username lookup: public and unauthenticated, and reveals whether a username
 * exists plus a masked preview of its email - a tighter cap than the plain signup availability
 * check (usernameCheckLimiter) since this one leaks more per request. */
export const forgotPasswordLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

/** Username availability check: public, unauthenticated, and called live while someone types in
 * the signup form (debounced client-side) - generous enough for normal typing but capped so it
 * can't be used to enumerate usernames at scale. */
export const usernameCheckLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many checks. Please slow down.' },
});

/** Rider location pings: authenticated but frequent by design (driven by the rider's phone while
 * "sharing" is on) - caps a runaway client (a stuck retry loop, a mis-set interval) without
 * punishing normal "ping every few seconds while delivering" use. */
export const riderLocationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many location updates. Please slow down.' },
});
