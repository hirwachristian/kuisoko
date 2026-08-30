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
