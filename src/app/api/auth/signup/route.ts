import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/auth";
import { signupSchema } from "@/lib/validation";
import { issueToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { track } from "@/lib/analytics";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid email or password (min 8 chars)." },
      { status: 400 },
    );
  }

  const { email, password, name } = parsed.data;
  const existing = await db.users.findByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await db.users.create({
    email,
    passwordHash,
    name: name || null,
  });

  await createSession(user.id);

  // Send email verification (non-blocking for the response path).
  const token = await issueToken(user.id, "verify");
  await sendVerificationEmail(user.email, user.name, token);

  await track({ type: "signup", userId: user.id });

  return NextResponse.json({ ok: true });
}
