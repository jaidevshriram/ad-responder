import { NextResponse } from "next/server";

const REACTOR_API_URL = "https://api.reactor.inc";
const MODEL = "reactor/happy-oyster-director";

// The browser cannot open a HappyOyster session with its own token: the SDK's
// follow-up "get session" is refused for it. So the server opens the session
// with the API key and hands the browser a token bound to that one session,
// which the SDK adopts through connect(jwt, { sessionId }).
export async function POST() {
  const apiKey = process.env.REACTOR_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "REACTOR_API_KEY is not configured" }, { status: 500 });
  }
  const headers = { "Content-Type": "application/json", "Reactor-API-Key": apiKey };

  const created = await fetch(`${REACTOR_API_URL}/sessions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: { name: MODEL } }),
    cache: "no-store",
  });
  const session = (await created.json()) as { session_id?: string; error?: string };
  if (!created.ok || !session.session_id) {
    return NextResponse.json(
      { error: `Reactor session request failed (${created.status}): ${session.error ?? ""}` },
      { status: 502 },
    );
  }

  const minted = await fetch(`${REACTOR_API_URL}/tokens`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      expires_after: 3600,
      authorization_details: [
        {
          type: "session",
          resources: { models: { match: [MODEL] }, sessions: { bind: [session.session_id] } },
        },
      ],
    }),
    cache: "no-store",
  });
  const token = (await minted.json()) as { jwt?: string; error?: string };
  if (!minted.ok || !token.jwt) {
    return NextResponse.json(
      { error: `Reactor token request failed (${minted.status}): ${token.error ?? ""}` },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { jwt: token.jwt, sessionId: session.session_id },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
