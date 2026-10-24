# ytstudio — a complete YouTube long-form video production system

Everything needed to go from *"a topic"* to *"a 1920×1080 H.264 master with
captions, a ducked music bed, a thumbnail and a compliant end screen"* is
installed, configured, wired together and tested in this repository.

It was built **inside the sandbox it now runs in** — a 2-vCPU, 3.8 GB, GPU-less
Debian 12 container where `apt-get` cannot reach Debian mirrors and model hubs
are blocked. That constraint shaped the design: every component is sourced from
the two registries that *are* reachable (PyPI + npm), and nothing requires a
GPU, a browser download, or a paid API key to work.

```
$ make doctor
  35 pass · 1 warn · 0 fail · 2 info

$ make sample
▶ Build a YouTube Video Machine
  10 scenes · 1.37 min · 1920x1080 @ 30fps
  ...
✔ rendered in 272.8s -> projects/_demo-youtube-system/output/demo-1920x1080.mp4
   PASS  file exists & non-empty: 60.38 MiB
   PASS  video stream present: h264
   PASS  audio stream present: aac 48000Hz 2ch
   PASS  resolution 1920x1080: 1920x1080
   PASS  frame rate 30: 30.000
   PASS  duration >= 81.0s: 82.01s
```

---

## 1. Quick start

```bash
./bootstrap.sh                 # install + verify everything (idempotent)
make doctor                    # what is actually available
make sample                    # render the demo video end to end
make test                      # 64 automated tests

# make your own video
.venv/bin/python -m ytstudio init "Why Sleep Matters"
#   → edit projects/why-sleep-matters/project.yaml (scenes + narration text)
#   → drop stills/clips/voiceover into assets/{images,clips,audio}
.venv/bin/python -m ytstudio plan   projects/why-sleep-matters   # timeline only
.venv/bin/python -m ytstudio render projects/why-sleep-matters --draft
.venv/bin/python -m ytstudio render projects/why-sleep-matters
```

Outputs land in `projects/<slug>/output/`:

| file | purpose |
|---|---|
| `<slug>-1920x1080.mp4` | the master, ready to upload |
| `<slug>.srt` / `.vtt` / `.ass` | caption tracks (upload the SRT to YouTube) |
| `<slug>-thumbnail.jpg` | 1280×720 thumbnail |
| `<slug>-poster.jpg` | still frame for community posts |
| `<slug>-manifest.json` | timeline, scene durations, verification results |

---

## 2. What is installed

Full detail, including *what failed and why*, is in **[docs/TOOLING.md](docs/TOOLING.md)**.

**Video / audio engine** — FFmpeg 7.0.2 (static, full build: libx264, libx265,
libvpx, libass, freetype, fribidi, loudnorm, sidechaincompress, rubberband) plus
ffprobe. Delivered via the `imageio-ffmpeg` wheel and `ffprobe-static` on npm
because Debian mirrors are unreachable.

**Python** (`.venv`) — numpy, Pillow, OpenCV (headless), SciPy, imageio,
imageio-ffmpeg, MoviePy, pydub, soundfile, mutagen, fontTools, brotli, PyYAML,
rich, tqdm, pytest.

**Motion graphics** — Remotion 4.0.538 + React 19 in `remotion-studio/`, with a
working headless Chromium 153 (extracted from the `@sparticuz/chromium` npm
tarball; Remotion's usual Chrome download host is blocked here).

**Fonts** — 23 TTF faces in `fonts/` (Inter, Montserrat, Bebas Neue, Oswald,
JetBrains Mono, DejaVu). The container ships **no** system fonts, so these were
installed from Fontsource npm packages and converted WOFF→TTF with fontTools.

**Speech** — offline TTS through `libespeak-ng` (from the `espeakng-loader`
wheel) driven by ctypes. Intelligible but robotic: it exists so the pipeline can
be exercised, not to publish. Hooks for Piper / ElevenLabs / OpenAI are in place.

**Hardware acceleration** — none available (no `/dev/dri`, no NVIDIA device).
The code probes for NVENC/VAAPI/QSV/VideoToolbox/AMF and uses them when present;
otherwise it falls back to CPU x264. See §7 for the honest numbers.

---

## 3. Architecture

```
ytstudio/
  tools.py      tool discovery + capability probing (never assumes)
  presets.py    export presets → real FFmpeg arguments
  probe.py      ffprobe (with ffmpeg-stderr fallback) + acceptance checks
  graphics.py   Pillow/NumPy cards: backgrounds, titles, lower thirds,
                thumbnails, end screens, bullet builds
  audio.py      music beds, SFX, ducking, LUFS normalisation, TTS
  subtitles.py  SRT/VTT/ASS authoring, chunking, libass burn-in
  render.py     FFmpeg primitives: Ken-Burns, overlays, xfade, mux, encode
  scenes.py     10 scene types → one clip each
  engine.py     project loading, timeline maths, staged + resumable rendering
  remotion.py   bridge to the React/Remotion compositions
  cli.py        `python -m ytstudio …`
```

**One FFmpeg pass per scene.** A scene is a still + N animated overlays + motion,
expressed as a single `filter_complex` graph — roughly 2× faster than layering in
separate passes, and it avoids intermediate quality loss.

**One FFmpeg pass for the whole video.** Scenes are joined with `xfade`
(and `acrossfade` for audio), and the subtitles are burned into the *same*
filtergraph. No second generation.

**Timeline correctness.** Cross-fades overlap, so scene *n* does not start at the
sum of the previous durations. The planner subtracts the overlap, and narration
offsets and caption cues are derived from that same timeline — which is why audio
stays locked to picture for 40-minute videos, not just for the demo.

**Resumable.** Each scene file has a SHA-256 fingerprint of its config (plus
resolution/fps). If a render dies, everything already finished is reused:

```
[scene 10/10] cached (endscreen)
```

---

## 4. Scene types

Declare them in `project.yaml`. All support `narration`, `voice`, `duration`,
`accent`, `motion` and `transition`.

| kind | what it renders |
|---|---|
| `title` | gradient/B-roll background, word-block title, accent rule, subtitle |
| `chapter` | "01 / The pipeline" segment card |
| `bullets` | headline + list that builds up item by item |
| `image` | your photo with Ken-Burns motion and a caption or lower third |
| `slideshow` | several stills, cross-faded, with varied motion |
| `video` | your clip conformed to preset (cover-crop), auto-looped, with lower third |
| `stats` | oversized number/stat + explanation |
| `quote` | pull-quote with attribution |
| `outro` | sign-off card |
| `endscreen` | YouTube-safe end screen, held ≥ 10 s |

Auto-assignment: if a scene needs an image and you didn't name one, it takes the
next unused file from `assets/images/` (same for `assets/clips/`), so dropping in
a folder of stills is enough to get a first cut.

---

## 5. Export presets

| preset | resolution | fps | video | audio |
|---|---|---|---|---|
| `youtube-1080p30` **(default)** | 1920×1080 | 30 | H.264 CRF 18 `medium`, high@4.1, 2 s GOP, max 12 Mbps | AAC 320k, 48 kHz stereo |
| `youtube-1080p60` | 1920×1080 | 60 | CRF 18, max 18 Mbps | AAC 320k |
| `youtube-1440p30` | 2560×1440 | 30 | CRF 19, max 24 Mbps | AAC 320k |
| `youtube-4k30` / `4k60` | 3840×2160 | 30/60 | CRF 20 `slow`, ≤ 53/80 Mbps | AAC 320k |
| `draft-720p30` | 1280×720 | 30 | CRF 26 `veryfast` | fast previews |
| `shorts-1080x1920` | 1080×1920 | 30 | CRF 18 | vertical promos |

Every preset is `+faststart`, `yuv420p`, H.264 High profile, AAC-LC, MP4 — the
exact combination YouTube recommends. Loudness is normalised to **−14 LUFS**
integrated with a **−1.5 dBTP** ceiling (YouTube's reference, two-pass `loudnorm`).

4K is *available* but on this 2-vCPU box it is not practical for long videos;
use it only when the source is genuinely 4K and you can wait (see §7).

---

## 6. The AI video workflow

[docs/WORKFLOW.md](docs/WORKFLOW.md) walks the full pipeline —
research → script → storyboard → voice → visuals → music → captions → master →
thumbnail → upload — and says exactly which step is automated, which is a
one-command step, and which needs a human decision or a paid API.

Short version of what is automated here:

```bash
ytstudio init "Topic"     # structure + YAML skeleton
ytstudio voice --file script.txt --out assets/audio/vo.wav   # offline TTS (scratch)
ytstudio plan  projects/x # exact timeline, durations, caption count
ytstudio render projects/x            # master + captions + thumbnail + manifest
ytstudio verify output/x-1920x1080.mp4 --grab 2,30,60
```

What is **not** automated (by design, and honestly): topic research, script
writing quality, B-roll *sourcing*, and publishable-sounding narration. Those
need you, or a paid API. No paid API is configured — see §8.

---

## 7. Measured performance (this machine)

| measurement | value |
|---|---|
| Scene render (1080p30, still + animation, 1 encode) | ~1.4 s per second of video |
| 82 s demo video, 10 scenes, full pipeline | **282 s** (4.7 min) |
| Join + burn subtitles over 10 scenes | ~95 s |
| Narration stem + ducked mix + LUFS normalise | ~12 s |
| Disk, full demo with intermediates | ~1.4 GB |
| Peak RSS | < 1 GB |
| Thermal/CPU: 2 cores at ~100% during encode | expected |

Rule of thumb on this hardware: **≈ 3–4× realtime** for 1080p30 with captions.
A 20-minute video takes roughly an hour. GPU encoding, if you have it, is used
automatically and is ~4–8× faster.

---

## 8. Paid / unavailable components (no surprises)

Nothing in the core pipeline needs money or an account. These are *optional*
upgrades and are **not** installed or configured:

* **Neural TTS** — ElevenLabs, OpenAI, Azure (need API keys); Piper (needs a
  voice model download — model hosts are blocked here).
* **Automatic transcription (ASR)** — `faster-whisper`/Whisper need model
  downloads from huggingface.co, which is unreachable. The code raises a clear
  error rather than inventing timings; supply an SRT/VTT, or drive the pipeline
  from your narration text (which is what the caption engine does by default).
* **Stock footage / stock music libraries**, YouTube Data API upload, and
  AI image/video generation services — all external by nature.
* **Premiere/Resolve-style GUI editors** — not installed; the FFmpeg +
  Remotion path replaces them for automated work.

---

## 9. Tests

```
$ make test
63 passed
```

Coverage includes: FFmpeg codec/filter presence, ffprobe *and* its fallback path,
preset correctness, SRT/VTT/ASS round-trips, caption chunking, music/SFX
synthesis, ducked mixing, loudness normalisation, narration placement at exact
offsets, every graphics generator (asserting pixels are actually drawn), every
scene type, cross-fade duration maths, timeline/caption alignment, and a full
mini render that verifies resolution, fps, audio, duration, and that subtitles
are really burned into the picture (frame-diff test).

---

## 10. Layout

```
bootstrap.sh          install + verify everything
Makefile              make doctor|sample|test|render|…
requirements.txt      python packages
ytstudio/             the production package
remotion-studio/      React/Remotion compositions (intro, titles, end screen)
scripts/              font installer, Remotion asset renderer
projects/             one folder per video (project.yaml + assets + build + output)
fonts/                installed TTFs
tests/                pytest suite
docs/                 TOOLING.md, WORKFLOW.md, REPORT.md
```
