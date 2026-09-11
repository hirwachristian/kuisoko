import crypto from 'node:crypto';

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const ID_SUFFIX_LENGTH = 6;

/** Generates a new user id like "KU-A1B2C3" - 6 uppercase letters/digits, ~36^6 (~2.2 billion)
 * combinations, so a collision on insert is astronomically unlikely but not impossible; callers
 * should retry the insert with a fresh id if it collides (see isUserIdCollision below). */
export function generateUserId(): string {
  let suffix = '';
  for (let i = 0; i < ID_SUFFIX_LENGTH; i++) {
    suffix += ID_CHARS[crypto.randomInt(ID_CHARS.length)];
  }
  return `KU-${suffix}`;
}

/** True if `err` is a Postgres unique-violation specifically on users.id (its primary key) -
 * as opposed to any other unique constraint (e.g. username, email) a users INSERT might also hit. */
export function isUserIdCollision(err: unknown): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: unknown }).code === '23505' &&
    'constraint' in err &&
    (err as { constraint?: unknown }).constraint === 'users_pkey'
  );
}
