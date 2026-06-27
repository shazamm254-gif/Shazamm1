import type { Repository } from "./db-types";
import { fileRepository } from "./db-file";
import { postgresRepository } from "./db-postgres";

/**
 * Storage selector.
 *
 * - DATABASE_URL set  → PostgreSQL adapter (production).
 * - DATABASE_URL unset → file-backed adapter (zero-setup local/dev).
 *
 * Both implement the same `Repository` interface, so application code imports
 * `db` and never depends on which backend is active.
 */
export const db: Repository = process.env.DATABASE_URL
  ? postgresRepository
  : fileRepository;

export type {
  AnalyticsEvent,
  AnalyticsSummary,
  Company,
  EventType,
  Proposal,
  Token,
  TokenType,
  User,
} from "./db-types";
