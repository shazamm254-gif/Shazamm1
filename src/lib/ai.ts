import Anthropic from "@anthropic-ai/sdk";
import { parseProposalContent, type ProposalContent } from "./types";

const MODEL = "claude-opus-4-8";

export interface GenerateInput {
  brief: string;
  clientName?: string | null;
  clientCompany?: string | null;
  company: {
    name: string;
    website?: string | null;
    industry?: string | null;
    services?: string | null;
    tone?: string | null;
    valueProps?: string | null;
    defaultCurrency: string;
  } | null;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not configured.");
    this.name = "MissingApiKeyError";
  }
}

// JSON schema the model must conform to (structured outputs).
const PROPOSAL_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "A compelling 2-4 sentence executive summary.",
    },
    sections: {
      type: "array",
      description:
        "Ordered proposal sections such as Understanding, Approach, Scope, Timeline, Why Us.",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          body: { type: "string" },
        },
        required: ["heading", "body"],
        additionalProperties: false,
      },
    },
    pricing: {
      type: "array",
      description: "Line items for the investment/pricing table.",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          amount: { type: "number" },
        },
        required: ["name", "description", "amount"],
        additionalProperties: false,
      },
    },
    currency: { type: "string" },
    total: { type: "number" },
  },
  required: ["summary", "sections", "pricing", "currency", "total"],
  additionalProperties: false,
} as const;

function buildSystemPrompt(company: GenerateInput["company"]): string {
  const lines: string[] = [
    "You are an expert proposal writer for B2B service businesses.",
    "You write persuasive, specific, well-scoped proposals that win deals.",
    "Avoid generic filler. Be concrete about deliverables, scope, and value.",
    "Pricing must be realistic for the described work and itemized clearly.",
    "Currency amounts are plain numbers (no symbols).",
  ];
  if (company) {
    lines.push("", "About the business writing this proposal:");
    lines.push(`- Name: ${company.name}`);
    if (company.industry) lines.push(`- Industry: ${company.industry}`);
    if (company.website) lines.push(`- Website: ${company.website}`);
    if (company.services) lines.push(`- Services offered: ${company.services}`);
    if (company.valueProps)
      lines.push(`- Differentiators / value props: ${company.valueProps}`);
    if (company.tone) lines.push(`- Preferred tone: ${company.tone}`);
    lines.push(`- Default currency: ${company.defaultCurrency}`);
    lines.push(
      "",
      "Write the proposal on behalf of this business, on-brand and referencing its real offerings.",
    );
  }
  return lines.join("\n");
}

function buildUserPrompt(input: GenerateInput): string {
  const parts: string[] = ["Write a client-ready proposal for this project.\n"];
  if (input.clientName || input.clientCompany) {
    parts.push(
      `Client: ${[input.clientName, input.clientCompany]
        .filter(Boolean)
        .join(" — ")}`,
    );
  }
  parts.push("Project brief / discovery notes:", input.brief.trim());
  parts.push(
    "",
    "Produce 4-6 sections (e.g. Understanding Your Needs, Proposed Approach, Scope of Work, Timeline, Why Work With Us), a concise executive summary, and an itemized pricing table with a correct total.",
  );
  return parts.join("\n");
}

export async function generateProposal(
  input: GenerateInput,
): Promise<ProposalContent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingApiKeyError();

  const client = new Anthropic({ apiKey });
  const currency = input.company?.defaultCurrency ?? "USD";

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: buildSystemPrompt(input.company),
    messages: [{ role: "user", content: buildUserPrompt(input) }],
    output_config: {
      format: {
        type: "json_schema",
        schema: PROPOSAL_SCHEMA,
      },
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "{}";

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {};
  }

  const content = parseProposalContent(parsed);
  if (!content.currency) content.currency = currency;
  // Recompute total defensively from line items if the model's total drifts.
  const lineSum = content.pricing.reduce((s, i) => s + (i.amount || 0), 0);
  if (lineSum > 0) content.total = lineSum;
  return content;
}
