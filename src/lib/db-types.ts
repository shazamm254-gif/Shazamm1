// Shared data types and the Repository interface. Both the file-backed adapter
// and the PostgreSQL adapter implement `Repository`, so the rest of the app
// depends only on this interface — swapping storage is an env-var change.

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  plan: "free" | "pro";
  stripeCustomerId: string | null;
  generationsUsed: number;
  emailVerified: boolean;
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

export type TokenType = "verify" | "reset";

export interface Token {
  id: string;
  userId: string;
  type: TokenType;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}

export type EventType =
  | "page_view"
  | "signup"
  | "proposal_generated"
  | "proposal_sent"
  | "proposal_viewed"
  | "proposal_accepted"
  | "subscription_started";

export interface AnalyticsEvent {
  id: string;
  type: EventType;
  userId: string | null;
  anonId: string | null;
  proposalId: string | null;
  meta: string | null;
  createdAt: string;
}

export interface AnalyticsSummary {
  sinceDays: number;
  visitors: number;
  signups: number;
  generations: number;
  proposalViews: number;
  acceptances: number;
  subscriptions: number;
  activatedUsers: number;
  subscribedUsers: number;
  activationRate: number; // activated / signups
  conversionRate: number; // subscribed / signups
  funnel: {
    visitors: number;
    signups: number;
    activated: number;
    sent: number;
    accepted: number;
    subscribed: number;
  };
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string | null;
}

export interface CreateProposalInput {
  userId: string;
  title: string;
  clientName: string | null;
  clientCompany: string | null;
  brief: string;
  contentJson: string;
  amount: number | null;
  currency: string;
}

export interface RecordEventInput {
  type: EventType;
  userId?: string | null;
  anonId?: string | null;
  proposalId?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface Repository {
  init(): Promise<void>;

  users: {
    findById(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    findByStripeCustomer(customerId: string): Promise<User | null>;
    create(input: CreateUserInput): Promise<User>;
    update(id: string, patch: Partial<User>): Promise<User | null>;
    incrementGenerations(id: string): Promise<void>;
  };

  companies: {
    findByUser(userId: string): Promise<Company | null>;
    upsert(userId: string, data: Omit<Company, "id" | "userId">): Promise<Company>;
  };

  proposals: {
    listByUser(userId: string): Promise<Proposal[]>;
    findById(id: string): Promise<Proposal | null>;
    findByShareId(shareId: string): Promise<Proposal | null>;
    create(input: CreateProposalInput): Promise<Proposal>;
    update(id: string, patch: Partial<Proposal>): Promise<Proposal | null>;
    delete(id: string): Promise<void>;
  };

  tokens: {
    create(input: {
      userId: string;
      type: TokenType;
      tokenHash: string;
      expiresAt: string;
    }): Promise<void>;
    findValid(tokenHash: string, type: TokenType): Promise<Token | null>;
    consume(tokenHash: string): Promise<void>;
    deleteForUser(userId: string, type: TokenType): Promise<void>;
  };

  events: {
    record(input: RecordEventInput): Promise<void>;
    summary(sinceDays?: number): Promise<AnalyticsSummary>;
  };
}
