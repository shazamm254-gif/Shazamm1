import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { acceptSchema } from "@/lib/validation";
import { sendProposalAcceptedEmail } from "@/lib/email";
import { track } from "@/lib/analytics";

type Params = { params: Promise<{ shareId: string }> };

// Public endpoint — a client accepts a proposal via its unguessable shareId.
export async function POST(req: Request, { params }: Params) {
  const { shareId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please enter your name to accept." },
      { status: 400 },
    );
  }

  const proposal = await db.proposals.findByShareId(shareId);
  if (!proposal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (proposal.status === "accepted") {
    return NextResponse.json({ ok: true, alreadyAccepted: true });
  }

  await db.proposals.update(proposal.id, {
    status: "accepted",
    acceptedBy: parsed.data.acceptedBy,
    acceptedAt: new Date().toISOString(),
  });

  await track({
    type: "proposal_accepted",
    userId: proposal.userId,
    proposalId: proposal.id,
  });

  // Notify the proposal owner.
  const owner = await db.users.findById(proposal.userId);
  if (owner) {
    await sendProposalAcceptedEmail(
      owner.email,
      owner.name,
      proposal.title,
      parsed.data.acceptedBy,
    );
  }

  return NextResponse.json({ ok: true });
}
