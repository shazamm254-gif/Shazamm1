import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resetSchema } from "@/lib/validation";
import { consumeToken, resolveToken } from "@/lib/tokens";
import { hashPassword } from "@/lib/password";

// POST /api/auth/reset — set a new password using a valid reset token.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const userId = await resolveToken(parsed.data.token, "reset");
  if (!userId) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired." },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await db.users.update(userId, { passwordHash });
  await consumeToken(parsed.data.token);

  return NextResponse.json({ ok: true });
}
