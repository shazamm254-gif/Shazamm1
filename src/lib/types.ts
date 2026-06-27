// Shared types for the structured proposal content.

export interface PricingItem {
  name: string;
  description?: string;
  amount: number;
}

export interface ProposalSection {
  heading: string;
  body: string; // plain text / light markdown
}

export interface ProposalContent {
  summary: string;
  sections: ProposalSection[];
  pricing: PricingItem[];
  currency: string;
  total: number;
}

export function emptyProposalContent(currency = "USD"): ProposalContent {
  return {
    summary: "",
    sections: [],
    pricing: [],
    currency,
    total: 0,
  };
}

// Defensive parse of stored/AI JSON into a ProposalContent.
export function parseProposalContent(raw: unknown): ProposalContent {
  const base = emptyProposalContent();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;

  const sections = Array.isArray(obj.sections)
    ? (obj.sections as unknown[])
        .map((s) => {
          const sec = s as Record<string, unknown>;
          return {
            heading: String(sec.heading ?? ""),
            body: String(sec.body ?? ""),
          };
        })
        .filter((s) => s.heading || s.body)
    : [];

  const pricing = Array.isArray(obj.pricing)
    ? (obj.pricing as unknown[])
        .map((p) => {
          const item = p as Record<string, unknown>;
          return {
            name: String(item.name ?? ""),
            description:
              item.description != null ? String(item.description) : undefined,
            amount: Number(item.amount ?? 0) || 0,
          };
        })
        .filter((p) => p.name)
    : [];

  const currency = String(obj.currency ?? base.currency) || base.currency;
  const total =
    Number(obj.total) ||
    pricing.reduce((sum, item) => sum + (item.amount || 0), 0);

  return {
    summary: String(obj.summary ?? ""),
    sections,
    pricing,
    currency,
    total,
  };
}
