import { createHash, randomBytes } from "crypto";
import { db } from "./db";
import type { TokenType } from "./db-types";

const TTL: Record<TokenType, number> = {
  verify: 24 * 60 * 60 * 1000, // 24 hours
  reset: 60 * 60 * 1000, // 1 hour
};

function hash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// Issue a single-use token: only the hash is stored; the raw value goes in the
// emailed link. Any prior tokens of the same type for the user are cleared.
export async function issueToken(
  userId: string,
  type: TokenType,
): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  await db.tokens.deleteForUser(userId, type);
  await db.tokens.create({
    userId,
    type,
    tokenHash: hash(raw),
    expiresAt: new Date(Date.now() + TTL[type]).toISOString(),
  });
  return raw;
}

// Resolve a raw token to its (valid, unexpired) user id, or null.
export async function resolveToken(
  raw: string,
  type: TokenType,
): Promise<string | null> {
  if (!raw) return null;
  const token = await db.tokens.findValid(hash(raw), type);
  return token ? token.userId : null;
}

// Invalidate a token after use.
export async function consumeToken(raw: string): Promise<void> {
  if (!raw) return;
  await db.tokens.consume(hash(raw));
}
