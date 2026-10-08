import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

// The ad's HappyOyster world (Amalfi) is built once and reopened by id.
// The id lives in data/ad-world.json ({"worldId": "..."}), which is gitignored.

const FILE = path.join(process.cwd(), "data", "ad-world.json");
const noStore = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  try {
    const saved = JSON.parse(await readFile(FILE, "utf8")) as { worldId?: string };
    return NextResponse.json({ worldId: saved.worldId || null }, { headers: noStore });
  } catch {
    return NextResponse.json({ worldId: null }, { headers: noStore });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { worldId?: unknown };
  if (typeof body.worldId !== "string" || !body.worldId.trim()) {
    return NextResponse.json({ error: "worldId (string) is required" }, { status: 400 });
  }
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify({ worldId: body.worldId.trim() }, null, 2) + "\n");
  return NextResponse.json({ ok: true }, { headers: noStore });
}
