import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumeToken, resolveToken } from "@/lib/tokens";
import { sendWelcomeEmail } from "@/lib/email";

const appUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// GET /api/auth/verify?token=... — confirm an email address from the link.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const userId = await resolveToken(token, "verify");
  if (!userId) {
    return NextResponse.redirect(`${appUrl()}/login?verify=invalid`);
  }

  const user = await db.users.findById(userId);
  if (user && !user.emailVerified) {
    await db.users.update(userId, { emailVerified: true });
    await sendWelcomeEmail(user.email, user.name);
  }
  await consumeToken(token);

  return NextResponse.redirect(`${appUrl()}/app?verified=1`);
}
