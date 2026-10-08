# Browser ⇄ voice relay protocol

The voice relay (`voice/relay.py`) owns all audio: the reSpeaker mic and speaker,
the ad narration, and the AssemblyAI Voice Agent. The browser (NotFlix) owns all
pictures: the show, the HappyOyster world, overlays. They talk over one WebSocket:

    ws://localhost:8765        JSON text frames, one object per frame, field "type"

The browser reconnects every 2 s if the relay is not up. Everything works without
the relay except the voice: the ad then plays silently on its timeline.

## Browser → relay

| type | fields | meaning |
|---|---|---|
| `hello` | `client: "notflix"` | sent on connect; relay answers with `status` |
| `ad.prepare` | — | ad break is ~20 s away: open the Voice Agent session now so it is ready |
| `ad.start` | — | the ad is on screen: start the narration timeline at beat 0 |
| `ad.stop` | — | abort (viewer skipped / closed): stop all audio, close the agent session |
| `test.speaker` | — | play a short chime + the line "Speaker check." through the speaker |
| `test.mic` | `seconds?: number` (default 4) | record from the mic, transcribe it, report back |
| `scene.done` | `direction` | browser applied a scene change (for logs only) |

## Relay → browser

| type | fields | meaning |
|---|---|---|
| `status` | `agent: "off"\|"connecting"\|"ready"`, `mic: string`, `speaker: string` | device names and agent state; sent on hello and on every change |
| `level` | `mic: 0..1`, `out: 0..1` | RMS levels, ~10 per second, for meters and the "listening" glow |
| `beat` | `id, index, total, line, scene` | a narration line starts playing now. Show `line` as a subtitle; send `scene` to HappyOyster `instruct()` |
| `listening` | — | the viewer started speaking (Voice Agent `input.speech.started`); narration is paused |
| `user` | `text, final: bool` | the viewer's words (partial, then final) |
| `agent` | `text, final: bool` | the agent's reply so far (accumulated text, not deltas), then final |
| `scene` | `direction` | the agent asked to change the picture: send `direction` to HappyOyster `instruct()` |
| `card` | `title, body` | the agent asked to show a fact card (price, dates…) |
| `resume` | `index` | conversation over; narration continues from beat `index` |
| `ad.end` | — | the script has finished and nobody is talking: cut back to the show |
| `test.result` | `test: "mic"\|"speaker", ok: bool, detail: string, transcript?: string` | outcome of a test |
| `error` | `message` | something failed; show it in the dev panel, never in the ad |

## Timeline rules (relay)

- Beats play back to back with ~0.6 s between lines, from `voice/narration/<id>.wav`
  (24 kHz mono 16-bit, made by `voice/make_narration.py`, script in `voice/ad_script.json`).
- On `input.speech.started` the current line fades out over ~150 ms and `listening` is
  sent. After the agent's reply finishes and ~3 s pass with nobody speaking, `resume`
  is sent and narration continues at the *next* beat (the interrupted one is not replayed).
  A viewer who says "carry on" / "continue" / "ok thanks" also resumes it (agent tool `resume_ad`).
- After the last beat, wait ~4 s; if nobody spoke, send `ad.end`.

## Debug-only (voice/test_relay.py; browsers never send or need these)

- Browser → relay `hello` may carry `debug: true` to receive `debug.*` messages.
- `debug.inject_audio` `{audio: base64 PCM 24 kHz mono s16le}`: fed to the agent in 50 ms
  frames as if from the mic. Relay → `debug.inject_done` when the last frame is sent.
- `debug.mute_mic` `{mute: bool}`: real mic replaced by silence.
- Relay → `debug.reply_audio`: first audio frame of an agent reply (latency measurement).
- Note: after a conversation that follows the last beat, `resume` carries `index == total`
  (no more beats); `ad.end` follows ~1 s later.
