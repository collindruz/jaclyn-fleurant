import { NextResponse } from "next/server";
import { writeWorkLayoutAtomic } from "@/lib/work-layout-server";

export const dynamic = "force-dynamic";

function denyProduction() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return denyProduction();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const result = await writeWorkLayoutAtomic(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, enabled: true });
}

export async function GET() {
  if (process.env.NODE_ENV === "production") return denyProduction();
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
