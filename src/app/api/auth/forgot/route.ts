import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { forgotSchema } from "@/lib/validation";
import { issueToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";

// POST /api/auth/forgot — always returns ok (no account enumeration).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const user = await db.users.findByEmail(parsed.data.email);
  if (user) {
    const token = await issueToken(user.id, "reset");
    await sendPasswordResetEmail(user.email, user.name, token);
  }

  return NextResponse.json({ ok: true });
}
