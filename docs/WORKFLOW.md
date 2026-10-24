# The AI video workflow

The pipeline the brief asked for, stage by stage — with an honest label on each:
**[auto]**, **[one command]**, **[human]**, or **[needs paid API]**.

---

## Stage 0 — Choose the shape of the video

Before anything renders, decide the *format*, because it decides scene count and
pacing:

| format | target length | scenes | notes |
|---|---|---|---|
| Explainer | 6–12 min | 25–45 | chapter cards every 2–3 min |
| Deep dive / documentary | 20–45 min | 60–120 | needs B-roll discipline |
| List / tutorial | 8–15 min | 20–40 | `bullets` and `stats` scenes carry it |
| Podcast / interview | 30–90 min | per segment | `video` scene with lower thirds |

Rule of thumb used by the planner: **~150 words of narration per minute**, and
one visual change every 4–7 seconds. The planner turns your narration length into
scene durations automatically, so the script *is* the timeline.

## Stage 1 — Topic research and script **[human / paid API]**

Not automated here, deliberately. What the system gives you:

* `ytstudio init "Topic"` scaffolds a project whose YAML *is* the script
  (each scene carries a `narration:` field).
* `audio.estimate_speech_seconds()` predicts runtime from text at 150 wpm
  before you record a single word — so you can trim a 22-minute script down to
  15 minutes without rendering it first.
* `ytstudio plan <project>` prints exact per-scene timing and the caption count.

Write the narration **per scene**. That granularity is what makes captions,
ducking and scene timing exact instead of approximate.

## Stage 2 — Storyboard **[one command]**

A storyboard here is just `project.yaml`:

```yaml
scenes:
  - kind: title      # hook, 4-6 s
  - kind: chapter    # "01 — the problem"
  - kind: bullets    # three claims
  - kind: image      # evidence, with Ken-Burns
  - kind: stats      # the one number people remember
  - kind: quote      # the turn
  - kind: slideshow  # montage
  - kind: outro
  - kind: endscreen  # held >= 10 s
```

`ytstudio plan` is your storyboard review: timings, durations, caption count, and
warnings (e.g. a scene with no media) — all before spending CPU on frames.

## Stage 3 — Voiceover **[one command, or human]**

Three options, in ascending quality:

```bash
# 1. scratch VO, offline, free (robotic - timing decisions only)
ytstudio voice --file script.txt --out assets/audio/vo.wav

# 2. your own recording - just drop it in and reference it
#    audio.voice: assets/audio/vo.mp3        (whole video)
#    or per scene:  voice: assets/audio/vo_03.wav

# 3. neural TTS (publishable) - needs a key or a local voice model
export ELEVENLABS_API_KEY=...   # or OPENAI_API_KEY / YTV_PIPER_MODEL=...
ytstudio voice --file script.txt --out assets/audio/vo.wav --engine elevenlabs
```

Per-scene voice files are strongly recommended: the planner places each at the
scene's exact start time, so a re-recorded sentence never desynchronises the film.

## Stage 4 — Visuals and B-roll **[human sourcing, auto assembly]**

Drop files into `projects/<slug>/assets/images/` and `assets/clips/`. Scenes pick
them up automatically (next unused file), or name them explicitly.

* Stills get Ken-Burns motion (`zoom_in`, `zoom_out`, `pan_left`, `pan_right`,
  `pan_up`) at a gentle 1.06–1.12 strength so text in the image is not cropped.
* Clips are conformed to the preset (scale + center-crop, 30 fps), auto-looped if
  shorter than the scene, and can carry a lower third.
* A mismatched aspect ratio can be letterboxed over a blurred copy of itself
  (`mode="contain"`) instead of black bars.
* B-roll **sourcing** is not automated: stock libraries and AI video generators
  are external services. Screen recordings, your own footage, and generated
  stills (as in the demo) work fine.

## Stage 5 — Music and mix **[auto]**

```yaml
audio:
  music: null          # null → generate a copyright-safe bed
  synth_music: true
  music_style: calm    # calm | uplifting | cinematic | focus
  music_gain_db: -19
  duck: true           # side-chain under narration
  normalize: true
  target_lufs: -14.0
```

The music is looped to the exact video length, faded at both ends, ducked ~12 dB
under speech via `sidechaincompress`, and the whole mix is normalised to
−14 LUFS / −1.5 dBTP in two passes (YouTube's reference point). Supplying your own
track is a one-line change — but check its licence; the generated bed never has one.

## Stage 6 — Captions **[auto]**

Captions are derived from the same narration text that drives the timeline, so
they are word-accurate with no ASR step:

* split at sentence/comma boundaries to ≤ 84 characters (configurable),
* distributed across the scene's narration window by text length,
* burned in with libass (real font, outline, shadow, safe margin) **and**
  written as `.srt` / `.vtt` / `.ass` sidecars for uploading to YouTube.

Automatic transcription from *audio* is supported through `faster-whisper` but is
not installed (model hosts blocked). Provide an SRT via `subtitles.file:` and it
takes precedence over everything.

## Stage 7 — Master render **[one command]**

```bash
ytstudio render projects/<slug>           # full quality
ytstudio render projects/<slug> --draft   # 720p sanity pass
```

Stages inside: per-scene clips (cached by content fingerprint) → cross-faded join
with captions burned in → narration stem → ducked mix → LUFS normalise → mux →
sidecars → thumbnail → poster → verification. Each stage writes a file, so a
crash resumes rather than restarts.

## Stage 8 — Thumbnail **[auto]**

1280×720, big bold type with stroke, accent bar, optional badge and background
image:

```yaml
thumbnail:
  title: "Your Hook, In Big Letters"
  subtitle: "the line underneath"
  badge: "NEW"
  image: assets/images/thumb_bg.png
```

## Stage 9 — End screen **[auto]**

`kind: endscreen` renders two clickable zones plus a subscribe prompt inside
YouTube's safe margins and is held for at least 10 seconds — the platform's
requirement for end-screen elements to remain editable.

## Stage 10 — Upload **[human / paid API]**

Uploading needs the YouTube Data API (OAuth) or a human. What is prepared for you:

* the master MP4 (`+faststart`, H.264 High, AAC 320k),
* the caption file to attach,
* the thumbnail JPEG,
* `manifest.json` with per-scene start times — ready to paste into a chapter list:

```
0:00 Intro
0:12 The pipeline
1:04 Five stages
...
```

---

## Motion graphics with Remotion

FFmpeg handles the mass of the video. For frames that want real animation curves
(springs, staggered word reveals), Remotion renders React components to video:

```bash
# whole library: intro, title card, lower third, end screen, kinetic type
make remotion

# one composition with your own text
npx remotion render src/index.ts TitleCard out/title.mp4 \
  --props '{"title":"Why Sleep Matters","subtitle":"a 12 minute explainer","kicker":"chapter one"}'
```

Compositions: `ChannelIntro`, `TitleCard`, `LowerThird`, `EndScreen`,
`KineticTitle`, plus a `ThumbnailBase` still. Fonts are loaded from
`remotion-studio/public/fonts` so renders are identical to the FFmpeg path.

Use Remotion where springs and choreography matter (an opening ident, a kinetic
hook), and the FFmpeg scene renderer everywhere else — it is 5–10× faster per
second of video on this hardware.

---

## A realistic production loop

```bash
# 1. structure
ytstudio init "Why Sleep Matters"

# 2. write the script into project.yaml (per-scene narration)

# 3. check the runtime BEFORE recording
ytstudio plan projects/why-sleep-matters

# 4. generate a scratch VO to hear the pacing
ytstudio voice --file projects/why-sleep-matters/script.txt \
  --out projects/why-sleep-matters/assets/audio/vo_01.wav

# 5. drop in stills and clips
# 6. fast preview
ytstudio render projects/why-sleep-matters --draft

# 7. fix what the preview reveals (usually pacing, not typos)
# 8. record the real VO, replace assets/audio/vo_*.wav
# 9. final render
ytstudio render projects/why-sleep-matters

# 10. verify and upload
ytstudio verify projects/why-sleep-matters/output/*-1920x1080.mp4 --grab 3,60,300
```
