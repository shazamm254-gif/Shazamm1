import { db } from "./db";
import type { RecordEventInput } from "./db-types";

/**
 * Records an analytics event. Never throws — analytics must not break the
 * primary request path. Use for trusted, server-side events (signup,
 * generation, send, accept, subscription).
 */
export async function track(input: RecordEventInput): Promise<void> {
  try {
    await db.events.record(input);
  } catch (err) {
    console.error("[analytics] failed to record event:", err);
  }
}
