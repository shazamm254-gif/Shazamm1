import { randomUUID } from "crypto";
import { Pool, type PoolClient } from "pg";
import type {
  AnalyticsSummary,
  Company,
  CreateProposalInput,
  CreateUserInput,
  Proposal,
  RecordEventInput,
  Repository,
  Token,
  TokenType,
  User,
} from "./db-types";

/**
 * PostgreSQL adapter — the production storage backend. Activated automatically
 * when DATABASE_URL is set (see db.ts). Implements the same Repository
 * interface as the file adapter, so no call sites change.
 */

const globalForPg = globalThis as unknown as {
  __pfPool?: Pool;
  __pfInit?: Promise<void>;
};

function getPool(): Pool {
  if (globalForPg.__pfPool) return globalForPg.__pfPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const useSsl =
    process.env.DATABASE_SSL === "true" ||
    /sslmode=require/.test(connectionString);
  const pool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  });
  globalForPg.__pfPool = pool;
  return pool;
}

const toIso = (v: unknown): string =>
  v instanceof Date ? v.toISOString() : String(v);

function mapUser(r: Record<string, unknown>): User {
  return {
    id: r.id as string,
    email: r.email as string,
    passwordHash: r.password_hash as string,
    name: (r.name as string | null) ?? null,
    plan: r.plan as "free" | "pro",
    stripeCustomerId: (r.stripe_customer_id as string | null) ?? null,
    generationsUsed: Number(r.generations_used),
    emailVerified: Boolean(r.email_verified),
    createdAt: toIso(r.created_at),
  };
}

function mapCompany(r: Record<string, unknown>): Company {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    name: r.name as string,
    website: (r.website as string | null) ?? null,
    industry: (r.industry as string | null) ?? null,
    services: (r.services as string | null) ?? null,
    tone: (r.tone as string | null) ?? null,
    valueProps: (r.value_props as string | null) ?? null,
    defaultCurrency: r.default_currency as string,
  };
}

function mapProposal(r: Record<string, unknown>): Proposal {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    title: r.title as string,
    clientName: (r.client_name as string | null) ?? null,
    clientCompany: (r.client_company as string | null) ?? null,
    brief: r.brief as string,
    contentJson: r.content_json as string,
    status: r.status as Proposal["status"],
    shareId: r.share_id as string,
    amount: r.amount != null ? Number(r.amount) : null,
    currency: r.currency as string,
    acceptedBy: (r.accepted_by as string | null) ?? null,
    acceptedAt: r.accepted_at != null ? toIso(r.accepted_at) : null,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

function mapToken(r: Record<string, unknown>): Token {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    type: r.type as TokenType,
    tokenHash: r.token_hash as string,
    expiresAt: toIso(r.expires_at),
    createdAt: toIso(r.created_at),
  };
}

function ensureSchema(): Promise<void> {
  if (globalForPg.__pfInit) return globalForPg.__pfInit;
  globalForPg.__pfInit = (async () => {
    const pool = getPool();
    const client: PoolClient = await pool.connect();
    try {
      await client.query(SCHEMA);
    } finally {
      client.release();
    }
  })();
  return globalForPg.__pfInit;
}

async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureSchema();
  const pool = getPool();
  const res = await pool.query(text, params);
  return res.rows as T[];
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  generations_used INTEGER NOT NULL DEFAULT 0,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website TEXT,
  industry TEXT,
  services TEXT,
  tone TEXT,
  value_props TEXT,
  default_currency TEXT NOT NULL DEFAULT 'USD'
);
CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  client_name TEXT,
  client_company TEXT,
  brief TEXT NOT NULL,
  content_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  share_id TEXT UNIQUE NOT NULL,
  amount DOUBLE PRECISION,
  currency TEXT NOT NULL DEFAULT 'USD',
  accepted_by TEXT,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS proposals_user_id_idx ON proposals(user_id);
CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tokens_hash_idx ON tokens(token_hash);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  user_id TEXT,
  anon_id TEXT,
  proposal_id TEXT,
  meta TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_type_created_idx ON events(type, created_at);
`;

const now = () => new Date().toISOString();

export const postgresRepository: Repository = {
  async init() {
    return ensureSchema();
  },

  users: {
    async findById(id) {
      const rows = await query("SELECT * FROM users WHERE id = $1", [id]);
      return rows[0] ? mapUser(rows[0]) : null;
    },
    async findByEmail(email) {
      const rows = await query("SELECT * FROM users WHERE lower(email) = lower($1)", [
        email,
      ]);
      return rows[0] ? mapUser(rows[0]) : null;
    },
    async findByStripeCustomer(customerId) {
      const rows = await query(
        "SELECT * FROM users WHERE stripe_customer_id = $1",
        [customerId],
      );
      return rows[0] ? mapUser(rows[0]) : null;
    },
    async create(input: CreateUserInput) {
      const rows = await query(
        `INSERT INTO users (id, email, password_hash, name)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [randomUUID(), input.email, input.passwordHash, input.name],
      );
      return mapUser(rows[0]);
    },
    async update(id, patch) {
      const cols: string[] = [];
      const vals: unknown[] = [];
      const map: Record<string, string> = {
        email: "email",
        passwordHash: "password_hash",
        name: "name",
        plan: "plan",
        stripeCustomerId: "stripe_customer_id",
        generationsUsed: "generations_used",
        emailVerified: "email_verified",
      };
      for (const [key, col] of Object.entries(map)) {
        if (key in patch) {
          cols.push(`${col} = $${cols.length + 1}`);
          vals.push((patch as Record<string, unknown>)[key]);
        }
      }
      if (cols.length === 0) {
        const rows = await query("SELECT * FROM users WHERE id = $1", [id]);
        return rows[0] ? mapUser(rows[0]) : null;
      }
      vals.push(id);
      const rows = await query(
        `UPDATE users SET ${cols.join(", ")} WHERE id = $${vals.length} RETURNING *`,
        vals,
      );
      return rows[0] ? mapUser(rows[0]) : null;
    },
    async incrementGenerations(id) {
      await query(
        "UPDATE users SET generations_used = generations_used + 1 WHERE id = $1",
        [id],
      );
    },
  },

  companies: {
    async findByUser(userId) {
      const rows = await query("SELECT * FROM companies WHERE user_id = $1", [
        userId,
      ]);
      return rows[0] ? mapCompany(rows[0]) : null;
    },
    async upsert(userId, data: Omit<Company, "id" | "userId">) {
      const rows = await query(
        `INSERT INTO companies
          (id, user_id, name, website, industry, services, tone, value_props, default_currency)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (user_id) DO UPDATE SET
           name = EXCLUDED.name,
           website = EXCLUDED.website,
           industry = EXCLUDED.industry,
           services = EXCLUDED.services,
           tone = EXCLUDED.tone,
           value_props = EXCLUDED.value_props,
           default_currency = EXCLUDED.default_currency
         RETURNING *`,
        [
          randomUUID(),
          userId,
          data.name,
          data.website,
          data.industry,
          data.services,
          data.tone,
          data.valueProps,
          data.defaultCurrency,
        ],
      );
      return mapCompany(rows[0]);
    },
  },

  proposals: {
    async listByUser(userId) {
      const rows = await query(
        "SELECT * FROM proposals WHERE user_id = $1 ORDER BY updated_at DESC",
        [userId],
      );
      return rows.map(mapProposal);
    },
    async findById(id) {
      const rows = await query("SELECT * FROM proposals WHERE id = $1", [id]);
      return rows[0] ? mapProposal(rows[0]) : null;
    },
    async findByShareId(shareId) {
      const rows = await query("SELECT * FROM proposals WHERE share_id = $1", [
        shareId,
      ]);
      return rows[0] ? mapProposal(rows[0]) : null;
    },
    async create(input: CreateProposalInput) {
      const rows = await query(
        `INSERT INTO proposals
          (id, user_id, title, client_name, client_company, brief, content_json,
           status, share_id, amount, currency)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9,$10) RETURNING *`,
        [
          randomUUID(),
          input.userId,
          input.title,
          input.clientName,
          input.clientCompany,
          input.brief,
          input.contentJson,
          randomUUID(),
          input.amount,
          input.currency,
        ],
      );
      return mapProposal(rows[0]);
    },
    async update(id, patch) {
      const cols: string[] = [];
      const vals: unknown[] = [];
      const map: Record<string, string> = {
        title: "title",
        clientName: "client_name",
        clientCompany: "client_company",
        brief: "brief",
        contentJson: "content_json",
        status: "status",
        amount: "amount",
        currency: "currency",
        acceptedBy: "accepted_by",
        acceptedAt: "accepted_at",
      };
      for (const [key, col] of Object.entries(map)) {
        if (key in patch) {
          cols.push(`${col} = $${cols.length + 1}`);
          vals.push((patch as Record<string, unknown>)[key]);
        }
      }
      cols.push(`updated_at = now()`);
      vals.push(id);
      const rows = await query(
        `UPDATE proposals SET ${cols.join(", ")} WHERE id = $${vals.length} RETURNING *`,
        vals,
      );
      return rows[0] ? mapProposal(rows[0]) : null;
    },
    async delete(id) {
      await query("DELETE FROM proposals WHERE id = $1", [id]);
    },
  },

  tokens: {
    async create(input) {
      await query(
        `INSERT INTO tokens (id, user_id, type, token_hash, expires_at)
         VALUES ($1,$2,$3,$4,$5)`,
        [randomUUID(), input.userId, input.type, input.tokenHash, input.expiresAt],
      );
    },
    async findValid(tokenHash: string, type: TokenType) {
      const rows = await query(
        `SELECT * FROM tokens
         WHERE token_hash = $1 AND type = $2 AND expires_at > now()`,
        [tokenHash, type],
      );
      return rows[0] ? mapToken(rows[0]) : null;
    },
    async consume(tokenHash) {
      await query("DELETE FROM tokens WHERE token_hash = $1", [tokenHash]);
    },
    async deleteForUser(userId, type) {
      await query("DELETE FROM tokens WHERE user_id = $1 AND type = $2", [
        userId,
        type,
      ]);
    },
  },

  events: {
    async record(input: RecordEventInput) {
      await query(
        `INSERT INTO events (id, type, user_id, anon_id, proposal_id, meta, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          randomUUID(),
          input.type,
          input.userId ?? null,
          input.anonId ?? null,
          input.proposalId ?? null,
          input.meta ? JSON.stringify(input.meta) : null,
          now(),
        ],
      );
    },
    async summary(sinceDays = 30): Promise<AnalyticsSummary> {
      const cutoff = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
      const rows = await query<Record<string, string>>(
        `SELECT
           COUNT(DISTINCT anon_id) FILTER (WHERE type='page_view')              AS visitors,
           COUNT(DISTINCT user_id) FILTER (WHERE type='signup')                 AS signups,
           COUNT(*)                FILTER (WHERE type='proposal_generated')      AS generations,
           COUNT(*)                FILTER (WHERE type='proposal_viewed')         AS proposal_views,
           COUNT(*)                FILTER (WHERE type='proposal_accepted')       AS acceptances,
           COUNT(*)                FILTER (WHERE type='subscription_started')    AS subscriptions,
           COUNT(DISTINCT user_id) FILTER (WHERE type='proposal_generated')     AS activated_users,
           COUNT(DISTINCT user_id) FILTER (WHERE type='proposal_sent')          AS sent_users,
           COUNT(DISTINCT user_id) FILTER (WHERE type='proposal_accepted')      AS accepted_owners,
           COUNT(DISTINCT user_id) FILTER (WHERE type='subscription_started')   AS subscribed_users
         FROM events WHERE created_at >= $1`,
        [cutoff],
      );
      const r = rows[0] ?? {};
      const n = (k: string) => Number(r[k] ?? 0);
      const signups = n("signups");
      const activatedUsers = n("activated_users");
      const subscribedUsers = n("subscribed_users");
      return {
        sinceDays,
        visitors: n("visitors"),
        signups,
        generations: n("generations"),
        proposalViews: n("proposal_views"),
        acceptances: n("acceptances"),
        subscriptions: n("subscriptions"),
        activatedUsers,
        subscribedUsers,
        activationRate: signups ? activatedUsers / signups : 0,
        conversionRate: signups ? subscribedUsers / signups : 0,
        funnel: {
          visitors: n("visitors"),
          signups,
          activated: activatedUsers,
          sent: n("sent_users"),
          accepted: n("accepted_owners"),
          subscribed: subscribedUsers,
        },
      };
    },
  },
};
