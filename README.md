# The Ad That Listens

Ask a TV ad a question out loud. It answers you in its own voice, and the picture
changes to show you.

**[Watch the demo](https://jaidevshriram.com/ad-responder/)**: a full ad break, 3½ minutes, with sound.
The video is also in the repo as [`docs/demo.mp4`](docs/demo.mp4).

![The ad answering "How much is it for three nights?", with the price on a card](docs/screenshots/13-answer.webp)

## What it does

You're watching a show in NotFlix, a Netflix-style app. An ad comes on: a made-up
Hilton stay on the Amalfi Coast, with a narrator over live, AI-generated video.

Hold the space bar and ask it something. The narrator stops and the answer comes back
in the same voice, with a card for any number worth seeing. The video moves to show
what you asked about. When you're done, the ad finishes and the show picks up where
it left off.

| "What's it like there at night?" | A few seconds later |
|---|---|
| ![Daytime on a coast road, with the question on screen](docs/screenshots/16-night-question-960.webp) | ![The harbour at dusk with the lights coming on](docs/screenshots/19-night-later-960.webp) |

## Run it on a Mac

You need Node.js 20+, Python 3.11+, and API keys for
[AssemblyAI](https://www.assemblyai.com/) and [Reactor](https://reactor.inc/).

```bash
git clone git@github.com:jaidevshriram/ad-responder.git
cd ad-responder
npm install
npm run setup:voice                      # creates .venv for the voice relay

cp .env.example .env.local               # add your REACTOR_API_KEY
echo "ASSEMBLYAI_API_KEY=your-key" > voice/.env
```

Then, in two terminals:

```bash
npm run relay        # the voice side: mic, speakers, voice agent
```

```bash
npm run dev          # the app, on http://localhost:3000
```

Open http://localhost:3000/notflix. The first time, macOS asks whether your terminal
may use the microphone; allow it.

1. Click **Play** on Big Buck Bunny.
2. Click **Prepare ad**, and wait for it to become **Start the ad** (about 20 seconds).
3. Click **Start the ad**.
4. Hold **Space**, ask a question, let go. For example:
   - "How much is it for three nights?"
   - "Do you provide transport?"
   - "What's it like there at night?"
   - "OK, carry on."

The very first run also builds the ad's video world, which takes about two minutes.
It's saved and reused after that.

| Key | Does |
|---|---|
| Space (hold) | Talk to the ad |
| Esc | Skip the ad |
| D | Audio check: devices, levels, speaker and mic tests |
| A | Start the ad break right away |

If the mic doesn't work, tap the suggested questions along the bottom of the ad.

## How it's built

```
 Mac mic ──► voice relay (Python) ──► AssemblyAI Voice Agent
 speakers ◄──     │     ▲                   │ answers + tool calls
                  │     └───────────────────┘
                  ▼ local WebSocket
            NotFlix (Next.js) ──► Reactor HappyOyster ──► live video
```

- **Voice relay** (`voice/relay.py`) handles all the sound: it plays the narrator,
  sends your voice to the agent while you hold Space, plays the answers, and passes
  the agent's requests on to the app.
- **AssemblyAI Voice Agent** hears the question and answers out loud. Its tools look
  up hotel details, price a stay, check availability, change the scene, put a card on
  screen, and hand back to the narrator.
- **Reactor HappyOyster** generates the ad's video live and follows short written
  directions as it plays, like "night falls over the harbour". The project page
  explains [how we got it to follow reliably](https://jaidevshriram.com/ad-responder/#reactor).
- **NotFlix** (Next.js) shows the film, the ad, the captions and the cards. It starts
  the ad's video in the background while the show is playing, so the break never
  shows a loading screen.

You hold Space because a laptop has no echo cancelling: an open mic hears the ad and
the ad starts answering itself. A mic array that cancels its own playback, such as a
reSpeaker XVF3800, is picked up automatically when plugged in, and then the mic stays
open.

The messages between the relay and the app are listed in [`docs/PROTOCOL.md`](docs/PROTOCOL.md).

## Change the ad

The whole ad lives in [`voice/ad_script.json`](voice/ad_script.json): the narration
lines with a shot for each, the facts the agent knows, the suggested questions, and
the description of the video world. The relay reads it again at the start of every ad.
After editing a narration line, record it again:

```bash
.venv/bin/python voice/make_narration.py --all
```

Prices, availability and the fallback shots are in `voice/relay.py`.

## Files

| Path | What it is |
|---|---|
| `app/notflix`, `components/` | the streaming app, the player and the ad break |
| `voice/relay.py` | the voice relay |
| `voice/ad_script.json` | the ad: narration, shots, facts, suggested questions |
| `voice/test_relay.py` | end-to-end test with synthesized questions, no sound |
| `app/api/happy-oyster/` | opens Reactor sessions on the server and stores the world id |
| `app/ad-lab` | developer page for trying directions on the video world |
| `docs/` | the project page (GitHub Pages), screenshots and the demo video |

## Notes

- The Hilton stay, its prices and its details are made up for this demo; Hilton isn't
  involved.
- Big Buck Bunny © Blender Foundation, CC BY 3.0.
