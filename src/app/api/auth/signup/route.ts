import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/auth";
import { signupSchema } from "@/lib/validation";

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
  const existing = db.users.findByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const user = db.users.create({
    email,
    passwordHash,
    name: name || null,
  });

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
