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
~/esp-tools/bin/python voice/relay.py
npm run dev
```
