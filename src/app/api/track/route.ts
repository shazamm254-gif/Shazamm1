import { NextResponse } from "next/server";
import { track } from "@/lib/analytics";
import { trackSchema } from "@/lib/validation";

// Public analytics beacon — accepts only client-observable event types
// (page_view, proposal_viewed). Trusted events are recorded server-side.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = trackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await track({
    type: parsed.data.type,
    anonId: parsed.data.anonId,
    proposalId: parsed.data.proposalId ?? null,
  });
  return NextResponse.json({ ok: true });
}
