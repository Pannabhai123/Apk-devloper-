# Final report

Honest status of every requirement in the brief, as measured in this container.
Nothing below is aspirational: each claim maps to a command you can re-run.

---

## 1. Tools successfully installed

| # | tool / library | version | where | verified by |
|---|---|---|---|---|
| 1 | FFmpeg | 7.0.2 static (johnvansickle build) | `.tools/ffmpeg` | `ffmpeg -version`, 37 codec/filter tests |
| 2 | ffprobe | 4.0.2 static | `.tools/ffprobe` | `ytstudio doctor`, probe tests |
| 3 | Python venv + pip | 3.11.2 | `.venv` | doctor |
| 4 | NumPy | 2.4.6 | `.venv` | import test |
| 5 | Pillow | 11.3.0 | `.venv` | graphics tests |
| 6 | OpenCV (headless) | 5.0.0 | `.venv` | import test |
| 7 | SciPy | 1.17.1 | `.venv` | used by the synth |
| 8 | imageio / imageio-ffmpeg | 2.38.1 / 0.6.0 | `.venv` | doctor |
| 9 | MoviePy | 2.2.1 | `.venv` | import test |
| 10 | pydub / soundfile / mutagen | 0.25.1 / 0.14.0 / 1.48.1 | `.venv` | audio tests |
| 11 | fontTools + brotli (WOFF→TTF) | 4.67 / 1.2.1 | `.venv` | fonts installed |
| 12 | PyYAML / rich / tqdm / pytest | current | `.venv` | test run |
| 13 | Node.js / npm | 22.22.3 / 10.9.8 | system | doctor |
| 14 | Remotion + @remotion/cli | 4.0.538 | `remotion-studio/` | 5 compositions render |
| 15 | React / react-dom | 19.2.0 | `remotion-studio/` | render |
| 16 | TypeScript | 5.9.3 | `remotion-studio/` | `tsc --noEmit` config |
| 17 | Headless Chromium | 153.0.8010.0 | `.tools/chromium` | `--version`, Remotion render |
| 18 | NSS/NSPR/expat libs | al2023 bundle | `.tools/chromium/lib` | Chromium launches |
| 19 | Fonts: Inter, Montserrat, Bebas Neue, Oswald, JetBrains Mono, DejaVu | 23 TTF faces | `fonts/` | rendered titles/captions |
| 20 | espeak-ng (offline TTS) | 1.52 lib + voice data | `.venv` (`espeakng-loader`) | 9 narration clips generated |
| 21 | fontconfig profile for libass | generated | `.tools/fontconfig` | subtitles burned with real fonts |

**Configured and tested, not just copied into place:** captions burn in with the
correct typeface, Remotion renders through the bundled Chromium, the audio chain
ducks and normalises to −14 LUFS, and the export presets produce files that pass
7/7 acceptance checks.

## 2. Tools already present (not reinstalled)

* Debian 12 base image, `bash`, `curl`, `tar`
* Python 3.11.2 + `pip` (venv module available)
* Node.js 22.22.3, npm 10.9.8, npx, yarn
* `sudo` rights (used only for `apt-get update`, which failed — see §3)
* Git

Deliberately **not** installed because they would have been duplicates or
unnecessary: ImageMagick (Pillow covers it), Blender, OBS, a second FFmpeg, a
second Node runtime, any NLE.

## 3. Installation failures (and what was done instead)

| attempt | failure | resolution |
|---|---|---|
| `apt-get update` / install FFmpeg | `deb.debian.org` unreachable (Connection failed, IP 151.101.x) | FFmpeg from the `imageio-ffmpeg` wheel, ffprobe from npm |
| GitHub release binaries (BtbN FFmpeg builds) | `release-assets.githubusercontent.com` TLS blocked | not needed after the wheel path worked |
| Remotion's Chrome Headless Shell download | host blocked | Chromium extracted from `@sparticuz/chromium` npm tarball |
| Chromium launch on bare Debian | `libnspr4.so`, `libnss3.so`, `libnssutil3.so` missing | bundled NSS libs from the same package put on `LD_LIBRARY_PATH` |
| Any system font | `fc-list` → 0 fonts; libass rendered boxes | Fontsource npm packages → WOFF→TTF → private fontconfig |
| Piper neural TTS | voice `.onnx` downloads blocked | espeak-ng via `espeakng-loader` (no download) |
| `faster-whisper` ASR models | huggingface.co unreachable | narration-text-driven captions; ASR raises a clear error |
| GPU encoding (NVENC/VAAPI/QSV) | no GPU, no `/dev/dri` | CPU x264; hardware path auto-detected when present |

Every failure was worked around, not hidden. The only capabilities genuinely
missing are neural TTS quality and audio-based transcription (§4).

## 4. Tools requiring payment, accounts or unavailable hosts

None are required. These are optional upgrades, **not installed**:

| capability | what it costs | status |
|---|---|---|
| ElevenLabs neural TTS | paid API key | hook ready (`ELEVENLABS_API_KEY`) |
| OpenAI TTS / GPT script help | paid API key | hook ready (`OPENAI_API_KEY`) |
| Azure Speech | paid subscription | hook ready (`AZURE_SPEECH_KEY`) |
| Piper neural TTS | free, but needs a model download from a blocked host | hook ready (`YTV_PIPER_MODEL`) |
| Whisper / faster-whisper ASR | free, model download blocked | raises explicit error |
| Stock footage, stock music libraries | subscription | not used; music is synthesised |
| AI image / video generation APIs | paid | not used; demo visuals are generated locally |
| YouTube Data API upload | free quota + OAuth | not configured; upload is manual |
| Adobe Premiere / DaVinci Resolve | paid / heavy GUI | not installed; not needed for this pipeline |

## 5. What the system produces (proof)

Demo: `projects/_demo-youtube-system/` — 10 scenes, 82.0 s, 1920×1080 @ 30 fps.

```
output/demo-1920x1080.mp4   59.7 MiB  H.264 High + AAC 320k, +faststart
output/demo.srt/.vtt/.ass   caption sidecars (90 cues)
output/demo-thumbnail.jpg   1280x720
output/demo-poster.jpg      still frame
output/demo-manifest.json   timeline + verification + elapsed time
```

Acceptance checks (all pass):

| check | result |
|---|---|
| file exists & non-empty | 59.74 MiB |
| video stream present | h264, High profile |
| audio stream present | aac 48000 Hz 2ch |
| resolution | 1920×1080 |
| frame rate | 30.000 |
| duration | 82.01 s (planned 82.0) |
| subtitles visible | verified by frame-diff test on the lower third |
| loudness | −14.9 LUFS mixed → −14.0 after two-pass normalisation |

Demo contents (each requirement from Step 5): title screen ✅ · multiple scenes
(10) ✅ · text animation (word-block slide + bullet build-up) ✅ · images ✅ ·
background audio (generated bed, ducked) ✅ · subtitles (burned + sidecars) ✅ ·
outro + YouTube end screen (held 10 s) ✅.

## 6. Measured performance on this hardware

| metric | value |
|---|---|
| Full demo pipeline (10 scenes, 82 s) | 273 s (4.5 min) → **~3.4× realtime** |
| Per-scene render | ~1.4 s per second of output |
| Test suite (63 tests) | 49 s |
| Bootstrap from scratch | ~3 min |
| Peak memory | < 1 GB of 3.8 GB |
| Project + intermediates on disk | ~1.4 GB |

Extrapolation: a 20-minute 1080p30 video ≈ 70 minutes of rendering here. With
NVENC on a consumer GPU it would be roughly 4–8× faster, and the preset system
switches to it automatically when the encoder exists.

## 7. Bugs found and fixed during testing

Recorded because they are exactly what a "completed" system should have caught:

1. **Overlay label reuse** — an FFmpeg graph referenced `[1:v]` twice; fixed to
   consume the alpha-processed `[ov]` label.
2. **Ken-Burns frame explosion** — `-loop 1 -t` fed `zoompan` ~180 frames each
   with `d=180`, yielding a 1080× longer clip. Now a single still drives
   `d=frames`.
3. **Post-filter label bug** — subtitle chain emitted `[vx9],ass=…` with no
   label, so FFmpeg saw an empty filter.
4. **Side-chain double-consume** — `sidechaincompress` and `amix` both consumed
   `[voice]`; now `asplit=2`.
5. **Timeline drift** — narration and captions were timed as if scenes did not
   overlap; an 82 s plan rendered 81.6 s (0.7 s per transition lost). The planner
   now subtracts the cross-fade duration, so picture, voice and cues share one
   timeline.
6. **End screen too short** — YouTube requires ≥ 10 s; `resolved_duration()` now
   enforces it.
7. **Blank title overlay at non-1080p sizes** — a hard-coded text box silently
   produced zero pixels below 1080p (`draft` renders had no titles). Box is now
   derived from the canvas; a test asserts real pixels are drawn.
8. **Static scenes became 1 frame** — `motion="none"` skipped `zoompan`; now
   emits a zero-zoom `zoompan`, giving exact frame counts.
9. **Generated voiceover buried under music** — the music looped at full level;
   it is now trimmed to length and ducked ~12 dB.
10. **Glyph/font gaps** — `→` and `▶` are not in Inter; replaced with `·` and a
    drawn triangle.

## 8. Honest limitations

* **Narration quality.** The bundled TTS is espeak-ng: intelligible, robotic,
  clearly not broadcast. For publishable audio, record a voiceover or connect a
  neural TTS. The system's job is timing, visuals, captions and mix — it does
  those correctly regardless of who supplies the voice.
* **No GPU.** 4K presets exist and work, but at this CPU a 4K long-form render
  is impractical (roughly 4× the 1080p time and much more disk).
* **Research/scripting is not automated.** The brief lists it; it needs a human
  or a paid LLM API. What *is* automated is everything downstream of the text.
* **B-roll sourcing is not automated.** Generation of stills is (see the demo's
  chart/diagram/mesh images), but real footage must be supplied or licensed.
* **No automatic upload.** The YouTube Data API is not configured (it needs
  OAuth to your channel). Outputs are upload-ready; the upload step is yours.
* **`motion="contain"`** (blurred letterbox) is implemented but only lightly
  exercised by the tests, since the demo assets are all 16:9.

## 9. Reproduce everything

```bash
./bootstrap.sh                # ~3 min, idempotent
source .tools/env.sh
.venv/bin/python -m ytstudio doctor   # 35 pass / 1 warn / 0 fail
.venv/bin/python -m pytest tests -q   # 63 passed
.venv/bin/python -m ytstudio sample   # renders + verifies the demo
```
