# Voice relay

Owns all audio for "The Ad That Listens": reSpeaker mic + speaker, ad narration,
AssemblyAI Voice Agent. Browser contract: `docs/PROTOCOL.md` (ws://localhost:8765).

## Run

    ~/esp-tools/bin/python -u voice/relay.py                 # plays on the reSpeaker
    ~/esp-tools/bin/python -u voice/relay.py --out mac       # plays on MacBook Pro Speakers
    ~/esp-tools/bin/python -u voice/relay.py --silent        # nothing audible (or RELAY_SILENT=1)

Needs `ASSEMBLYAI_API_KEY=` in `voice/.env`. `voice/ad_script.json` (beats, facts,
roleplay) and `voice/narration/<id>.wav` are re-read on every `ad.start`/session.
Every event is printed and appended to `voice/session.jsonl`.

## Flow

`ad.prepare` opens the agent (fed silence until the ad starts) -> `ad.start` plays
beats (`beat`) -> viewer speaks -> narration fades, `listening`, `user`, `agent`,
`scene`/`card` from tool calls -> ~3 s after the reply (or 0.8 s after "carry on")
`resume` at the next beat -> 4 s after the last beat `ad.end`. Agent closes 5 s later.
Tools: show_scene(direction), show_card(title, body), resume_ad(). Tool names are
never in the prompt and are scrubbed from transcripts.

## Test (silent)

    ~/esp-tools/bin/python voice/test_relay.py

Starts its own relay with `--silent`, mutes the real mic (`debug.mute_mic`), and injects
three `say`-generated questions (`debug.inject_audio`): night (expects a scene),
3-day price (expects 1,290 + a card), transport (expects scene). Port 8765 must be free,
and close the NotFlix tab first: the browser auto-connects and its `ad.start` restarts the ad.
