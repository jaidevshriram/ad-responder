import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

// Dev only: saves a captured video frame to data/frames/ so it can be inspected.
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "dev only" }, { status: 404 });
  }
  const { name, dataUrl } = (await request.json()) as { name: string; dataUrl: string };
  const dir = path.join(process.cwd(), "data", "frames");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${name.replace(/[^\w-]/g, "_")}.jpg`);
  await writeFile(file, Buffer.from(dataUrl.split(",")[1], "base64"));
  return NextResponse.json({ file });
}
