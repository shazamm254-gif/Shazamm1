import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { generateSchema } from "@/lib/validation";
import { generateProposal, MissingApiKeyError } from "@/lib/ai";
import { FREE_GENERATION_LIMIT } from "@/lib/billing";
import { track } from "@/lib/analytics";

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please describe the project in at least a sentence or two." },
      { status: 400 },
    );
  }

  const user = await db.users.findById(userId);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const company = await db.companies.findByUser(userId);

  // Enforce the free-tier generation quota.
  if (user.plan !== "pro" && user.generationsUsed >= FREE_GENERATION_LIMIT) {
    return NextResponse.json(
      {
        error: "limit_reached",
        message:
          "You've used your free proposals. Upgrade to Pro for unlimited generations.",
      },
      { status: 402 },
    );
  }

  const { brief, clientName, clientCompany, title } = parsed.data;

  let content;
  try {
    content = await generateProposal({
      brief,
      clientName: clientName || null,
      clientCompany: clientCompany || null,
      company: company
        ? {
            name: company.name,
            website: company.website,
            industry: company.industry,
            services: company.services,
            tone: company.tone,
            valueProps: company.valueProps,
            defaultCurrency: company.defaultCurrency,
          }
        : null,
    });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json(
        {
          error:
            "AI is not configured on this deployment. Add ANTHROPIC_API_KEY to enable generation.",
        },
        { status: 503 },
      );
    }
    console.error("Generation failed:", err);
    return NextResponse.json(
      { error: "Generation failed. Please try again." },
      { status: 500 },
    );
  }

  const proposal = await db.proposals.create({
    userId,
    title: title || `Proposal for ${clientCompany || clientName || "Client"}`,
    clientName: clientName || null,
    clientCompany: clientCompany || null,
    brief,
    contentJson: JSON.stringify(content),
    amount: content.total,
    currency: content.currency,
  });

  await db.users.incrementGenerations(userId);

  await track({
    type: "proposal_generated",
    userId,
    proposalId: proposal.id,
  });

  return NextResponse.json({ id: proposal.id });
}
