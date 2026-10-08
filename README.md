# The Ad That Listens

A travel ad you can interrupt. While a show plays on NotFlix, an ad break cuts in:
a live HappyOyster world (Reactor) with a scripted narration. Ask it anything out
loud — the narration pauses, an AssemblyAI Voice Agent answers in the same voice,
and the world on screen changes to show you.

| path | what it is |
|---|---|
| `app/notflix` | the streaming app, show playback and the ad break |
| `app/ad-lab` | developer page for the HappyOyster world |
| `app/api/happy-oyster/token` | opens a HappyOyster session server-side, returns a bound token |
| `voice/` | Python relay: reSpeaker audio, Voice Agent, narration timeline |

## Setup

```bash
npm install
cp .env.example .env.local          # REACTOR_API_KEY, GEMINI_API_KEY
echo "ASSEMBLYAI_API_KEY=..." > voice/.env
python3 -m venv ~/esp-tools && ~/esp-tools/bin/pip install websockets sounddevice numpy
```

## Run

```bash
~/esp-tools/bin/python -u voice/relay.py --in mac --out mac   # MacBook mic + speakers
npm run dev
```

Open `/notflix`, play Big Buck Bunny, click **Prepare ad**, then **Start the ad**.
During the ad, **hold Space** (or the on-screen button) to ask a question; the mic
is push-to-talk because the laptop has no echo cancelling. The question chips
along the bottom ask for you if the mic fails. `Esc` skips the ad, `D` opens the
audio-check panel.

Relay flags: `--in`/`--out mac|respeaker` pick the devices (a reSpeaker XVF3800
cancels its own playback, so with it the mic can stay open); `--silent` discards
output audio for tests (`voice/test_relay.py`).

The agent's knowledge — facts, narration, question chips, world prompt — is in
`voice/ad_script.json`; pricing, availability and scene fallbacks are in
`voice/relay.py`.
