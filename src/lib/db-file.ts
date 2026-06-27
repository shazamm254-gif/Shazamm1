import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type {
  AnalyticsEvent,
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
 * File-backed adapter — zero native deps, runs anywhere. Used when no
 * DATABASE_URL is configured (local dev / demo / single process). Not for
 * multi-instance production: use the Postgres adapter there.
 */

interface Store {
  users: User[];
  companies: Company[];
  proposals: Proposal[];
  tokens: Token[];
  events: AnalyticsEvent[];
}

const DATA_FILE =
  process.env.DATA_FILE || join(process.cwd(), ".data", "db.json");

const globalForStore = globalThis as unknown as { __pfStore?: Store };

function emptyStore(): Store {
  return { users: [], companies: [], proposals: [], tokens: [], events: [] };
}

function load(): Store {
  if (globalForStore.__pfStore) return globalForStore.__pfStore;
  let store = emptyStore();
  try {
    if (existsSync(DATA_FILE)) {
      const parsed = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Partial<Store>;
      store = {
        users: parsed.users ?? [],
        companies: parsed.companies ?? [],
        proposals: parsed.proposals ?? [],
        tokens: parsed.tokens ?? [],
        events: parsed.events ?? [],
      };
    }
  } catch {
    store = emptyStore();
  }
  globalForStore.__pfStore = store;
  return store;
}

function persist(store: Store): void {
  const dir = dirname(DATA_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

const now = () => new Date().toISOString();
const sinceIso = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString();

export const fileRepository: Repository = {
  async init() {
    // Ensure the file/dir exists.
    const store = load();
    persist(store);
  },

  users: {
    async findById(id) {
      return load().users.find((u) => u.id === id) ?? null;
    },
    async findByEmail(email) {
      const lower = email.toLowerCase();
      return load().users.find((u) => u.email.toLowerCase() === lower) ?? null;
    },
    async findByStripeCustomer(customerId) {
      return load().users.find((u) => u.stripeCustomerId === customerId) ?? null;
    },
    async create(input: CreateUserInput) {
      const store = load();
      const user: User = {
        id: randomUUID(),
        email: input.email,
        passwordHash: input.passwordHash,
        name: input.name,
        plan: "free",
        stripeCustomerId: null,
        generationsUsed: 0,
        emailVerified: false,
        createdAt: now(),
      };
      store.users.push(user);
      persist(store);
      return user;
    },
    async update(id, patch) {
      const store = load();
      const user = store.users.find((u) => u.id === id);
      if (!user) return null;
      Object.assign(user, patch);
      persist(store);
      return user;
    },
    async incrementGenerations(id) {
      const store = load();
      const user = store.users.find((u) => u.id === id);
      if (!user) return;
      user.generationsUsed += 1;
      persist(store);
    },
  },

  companies: {
    async findByUser(userId) {
      return load().companies.find((c) => c.userId === userId) ?? null;
    },
    async upsert(userId, data: Omit<Company, "id" | "userId">) {
      const store = load();
      const existing = store.companies.find((c) => c.userId === userId);
      if (existing) {
        Object.assign(existing, data);
        persist(store);
        return existing;
      }
      const company: Company = { id: randomUUID(), userId, ...data };
      store.companies.push(company);
      persist(store);
      return company;
    },
  },

  proposals: {
    async listByUser(userId) {
      return load()
        .proposals.filter((p) => p.userId === userId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async findById(id) {
      return load().proposals.find((p) => p.id === id) ?? null;
    },
    async findByShareId(shareId) {
      return load().proposals.find((p) => p.shareId === shareId) ?? null;
    },
    async create(input: CreateProposalInput) {
      const store = load();
      const ts = now();
      const proposal: Proposal = {
        id: randomUUID(),
        userId: input.userId,
        title: input.title,
        clientName: input.clientName,
        clientCompany: input.clientCompany,
        brief: input.brief,
        contentJson: input.contentJson,
        status: "draft",
        shareId: randomUUID(),
        amount: input.amount,
        currency: input.currency,
        acceptedBy: null,
        acceptedAt: null,
        createdAt: ts,
        updatedAt: ts,
      };
      store.proposals.push(proposal);
      persist(store);
      return proposal;
    },
    async update(id, patch) {
      const store = load();
      const proposal = store.proposals.find((p) => p.id === id);
      if (!proposal) return null;
      Object.assign(proposal, patch, { updatedAt: now() });
      persist(store);
      return proposal;
    },
    async delete(id) {
      const store = load();
      store.proposals = store.proposals.filter((p) => p.id !== id);
      persist(store);
    },
  },

  tokens: {
    async create(input) {
      const store = load();
      store.tokens.push({
        id: randomUUID(),
        userId: input.userId,
        type: input.type,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        createdAt: now(),
      });
      persist(store);
    },
    async findValid(tokenHash: string, type: TokenType) {
      const t = load().tokens.find(
        (x) => x.tokenHash === tokenHash && x.type === type,
      );
      if (!t) return null;
      if (new Date(t.expiresAt).getTime() < Date.now()) return null;
      return t;
    },
    async consume(tokenHash) {
      const store = load();
      store.tokens = store.tokens.filter((t) => t.tokenHash !== tokenHash);
      persist(store);
    },
    async deleteForUser(userId, type) {
      const store = load();
      store.tokens = store.tokens.filter(
        (t) => !(t.userId === userId && t.type === type),
      );
      persist(store);
    },
  },

  events: {
    async record(input: RecordEventInput) {
      const store = load();
      store.events.push({
        id: randomUUID(),
        type: input.type,
        userId: input.userId ?? null,
        anonId: input.anonId ?? null,
        proposalId: input.proposalId ?? null,
        meta: input.meta ? JSON.stringify(input.meta) : null,
        createdAt: now(),
      });
      persist(store);
    },
    async summary(sinceDays = 30): Promise<AnalyticsSummary> {
      const cutoff = sinceIso(sinceDays);
      const events = load().events.filter((e) => e.createdAt >= cutoff);
      const byType = (t: string) => events.filter((e) => e.type === t);
      const distinct = (arr: (string | null)[]) =>
        new Set(arr.filter((x): x is string => !!x)).size;

      const visitors = distinct(byType("page_view").map((e) => e.anonId));
      const signups = distinct(byType("signup").map((e) => e.userId));
      const generations = byType("proposal_generated").length;
      const proposalViews = byType("proposal_viewed").length;
      const acceptances = byType("proposal_accepted").length;
      const subscriptions = byType("subscription_started").length;
      const activatedUsers = distinct(
        byType("proposal_generated").map((e) => e.userId),
      );
      const sentUsers = distinct(byType("proposal_sent").map((e) => e.userId));
      const acceptedOwners = distinct(
        byType("proposal_accepted").map((e) => e.userId),
      );
      const subscribedUsers = distinct(
        byType("subscription_started").map((e) => e.userId),
      );

      return {
        sinceDays,
        visitors,
        signups,
        generations,
        proposalViews,
        acceptances,
        subscriptions,
        activatedUsers,
        subscribedUsers,
        activationRate: signups ? activatedUsers / signups : 0,
        conversionRate: signups ? subscribedUsers / signups : 0,
        funnel: {
          visitors,
          signups,
          activated: activatedUsers,
          sent: sentUsers,
          accepted: acceptedOwners,
          subscribed: subscribedUsers,
        },
      };
    },
  },
};
