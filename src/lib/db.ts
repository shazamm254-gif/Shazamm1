import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

/**
 * File-backed data layer.
 *
 * The committed MVP persists to a JSON file so it runs anywhere with zero
 * native dependencies or binary downloads. All access goes through the typed
 * `db` API below — to move to Postgres in production, reimplement these
 * functions against your driver of choice; no call sites change.
 */

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  plan: "free" | "pro";
  stripeCustomerId: string | null;
  generationsUsed: number;
  createdAt: string;
}

export interface Company {
  id: string;
  userId: string;
  name: string;
  website: string | null;
  industry: string | null;
  services: string | null;
  tone: string | null;
  valueProps: string | null;
  defaultCurrency: string;
}

export interface Proposal {
  id: string;
  userId: string;
  title: string;
  clientName: string | null;
  clientCompany: string | null;
  brief: string;
  contentJson: string;
  status: "draft" | "sent" | "accepted" | "declined";
  shareId: string;
  amount: number | null;
  currency: string;
  acceptedBy: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Store {
  users: User[];
  companies: Company[];
  proposals: Proposal[];
}

const DATA_FILE =
  process.env.DATA_FILE || join(process.cwd(), ".data", "db.json");

// Cache the store in the module scope (and across hot reloads in dev) so reads
// don't hit disk every call.
const globalForStore = globalThis as unknown as { __pfStore?: Store };

function load(): Store {
  if (globalForStore.__pfStore) return globalForStore.__pfStore;
  let store: Store = { users: [], companies: [], proposals: [] };
  try {
    if (existsSync(DATA_FILE)) {
      const raw = readFileSync(DATA_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<Store>;
      store = {
        users: parsed.users ?? [],
        companies: parsed.companies ?? [],
        proposals: parsed.proposals ?? [],
      };
    }
  } catch {
    // Corrupt or unreadable file — start from an empty store rather than crash.
    store = { users: [], companies: [], proposals: [] };
  }
  globalForStore.__pfStore = store;
  return store;
}

function persist(store: Store): void {
  const dir = dirname(DATA_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

function now(): string {
  return new Date().toISOString();
}

export const db = {
  users: {
    findById(id: string): User | null {
      return load().users.find((u) => u.id === id) ?? null;
    },
    findByEmail(email: string): User | null {
      const lower = email.toLowerCase();
      return load().users.find((u) => u.email.toLowerCase() === lower) ?? null;
    },
    findByStripeCustomer(customerId: string): User | null {
      return (
        load().users.find((u) => u.stripeCustomerId === customerId) ?? null
      );
    },
    create(input: {
      email: string;
      passwordHash: string;
      name: string | null;
    }): User {
      const store = load();
      const user: User = {
        id: randomUUID(),
        email: input.email,
        passwordHash: input.passwordHash,
        name: input.name,
        plan: "free",
        stripeCustomerId: null,
        generationsUsed: 0,
        createdAt: now(),
      };
      store.users.push(user);
      persist(store);
      return user;
    },
    update(id: string, patch: Partial<User>): User | null {
      const store = load();
      const user = store.users.find((u) => u.id === id);
      if (!user) return null;
      Object.assign(user, patch);
      persist(store);
      return user;
    },
    incrementGenerations(id: string): void {
      const store = load();
      const user = store.users.find((u) => u.id === id);
      if (!user) return;
      user.generationsUsed += 1;
      persist(store);
    },
  },

  companies: {
    findByUser(userId: string): Company | null {
      return load().companies.find((c) => c.userId === userId) ?? null;
    },
    upsert(
      userId: string,
      data: Omit<Company, "id" | "userId">,
    ): Company {
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
    listByUser(userId: string): Proposal[] {
      return load()
        .proposals.filter((p) => p.userId === userId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    findById(id: string): Proposal | null {
      return load().proposals.find((p) => p.id === id) ?? null;
    },
    findByShareId(shareId: string): Proposal | null {
      return load().proposals.find((p) => p.shareId === shareId) ?? null;
    },
    create(input: {
      userId: string;
      title: string;
      clientName: string | null;
      clientCompany: string | null;
      brief: string;
      contentJson: string;
      amount: number | null;
      currency: string;
    }): Proposal {
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
    update(id: string, patch: Partial<Proposal>): Proposal | null {
      const store = load();
      const proposal = store.proposals.find((p) => p.id === id);
      if (!proposal) return null;
      Object.assign(proposal, patch, { updatedAt: now() });
      persist(store);
      return proposal;
    },
    delete(id: string): void {
      const store = load();
      store.proposals = store.proposals.filter((p) => p.id !== id);
      persist(store);
    },
  },
};
