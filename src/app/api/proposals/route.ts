import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const all = await db.proposals.listByUser(userId);
  const proposals = all.map((p) => ({
    id: p.id,
    title: p.title,
    clientName: p.clientName,
    clientCompany: p.clientCompany,
    status: p.status,
    amount: p.amount,
    currency: p.currency,
    updatedAt: p.updatedAt,
  }));

  return NextResponse.json({ proposals });
}
