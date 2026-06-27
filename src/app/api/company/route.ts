import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { companySchema } from "@/lib/validation";

export async function PUT(req: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = companySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please provide at least a company name." },
      { status: 400 },
    );
  }

  const data = {
    name: parsed.data.name,
    website: parsed.data.website || null,
    industry: parsed.data.industry || null,
    services: parsed.data.services || null,
    tone: parsed.data.tone || null,
    valueProps: parsed.data.valueProps || null,
    defaultCurrency: parsed.data.defaultCurrency || "USD",
  };

  const company = await db.companies.upsert(userId, data);

  return NextResponse.json({ company });
}
