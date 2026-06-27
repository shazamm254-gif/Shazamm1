import { NextResponse } from "next/server";
import { db, type Proposal } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { updateProposalSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

type Params = { params: Promise<{ id: string }> };

async function ownedProposal(
  userId: string,
  id: string,
): Promise<Proposal | null> {
  const proposal = await db.proposals.findById(id);
  if (!proposal || proposal.userId !== userId) return null;
  return proposal;
}

export async function GET(_req: Request, { params }: Params) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const proposal = await ownedProposal(userId, id);
  if (!proposal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ proposal });
}

export async function PATCH(req: Request, { params }: Params) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const proposal = await ownedProposal(userId, id);
  if (!proposal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateProposalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }

  const data: Partial<Proposal> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.clientName !== undefined)
    data.clientName = parsed.data.clientName || null;
  if (parsed.data.clientCompany !== undefined)
    data.clientCompany = parsed.data.clientCompany || null;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.content !== undefined) {
    data.contentJson = JSON.stringify(parsed.data.content);
    data.amount = parsed.data.content.total;
    data.currency = parsed.data.content.currency;
  }

  const updated = await db.proposals.update(id, data);

  // Record a send the first time a proposal transitions to "sent".
  if (parsed.data.status === "sent" && proposal.status !== "sent") {
    await track({ type: "proposal_sent", userId, proposalId: id });
  }

  return NextResponse.json({ proposal: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const proposal = await ownedProposal(userId, id);
  if (!proposal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db.proposals.delete(id);
  return NextResponse.json({ ok: true });
}
