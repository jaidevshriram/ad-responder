import { rails, titles } from "@/lib/catalog";

export async function GET() {
  return Response.json(
    { featuredId: titles[0].id, rails, titles },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
