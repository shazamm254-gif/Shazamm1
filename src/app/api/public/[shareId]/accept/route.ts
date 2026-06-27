import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { acceptSchema } from "@/lib/validation";

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

  const proposal = db.proposals.findByShareId(shareId);
  if (!proposal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (proposal.status === "accepted") {
    return NextResponse.json({ ok: true, alreadyAccepted: true });
  }

  db.proposals.update(proposal.id, {
    status: "accepted",
    acceptedBy: parsed.data.acceptedBy,
    acceptedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
