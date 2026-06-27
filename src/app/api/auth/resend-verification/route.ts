import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { issueToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";

export async function POST() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await db.users.findById(userId);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }
  const token = await issueToken(user.id, "verify");
  await sendVerificationEmail(user.email, user.name, token);
  return NextResponse.json({ ok: true });
}
