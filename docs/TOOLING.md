# Tooling: what was installed, how, and what failed

This is the raw engineering record of Step 1–2 of the brief: system inspection,
installation, configuration, and capability testing. Everything below was executed
in this container, not copied from a tutorial.

## 1. System inspection (measured)

| property | value |
|---|---|
| OS | Debian GNU/Linux 12 (bookworm), kernel 6.1.158+ x86_64 |
| CPU | 2 vCPU, Intel Xeon @ 2.60 GHz |
| RAM | 3.8 GiB total, no swap |
| Disk | 20 GiB (≈16 GiB free at start) |
| GPU | none — no `nvidia-smi`, no `/dev/dri`, no VAAPI device |
| Python | 3.11.2 (`/usr/bin/python3`), pip 23.0.1, venv module available |
| Node.js | v22.22.3, npm 10.9.8, yarn present |
| FFmpeg | **absent** at start |
| Chromium/Chrome | **absent** at start |
| Fonts | **zero** system fonts (`fc-list` returned 0) |
| Package managers | apt (with sudo) — but mirrors unreachable |
| Network reachable | pypi.org, registry.npmjs.org, github.com |
| Network blocked | deb.debian.org, release-assets.githubusercontent.com (GitHub release binaries), huggingface.co, storage.googleapis.com |
| Existing video tooling | none |

Two constraints drove every decision: **apt is unusable** and **model/binary
download hosts are blocked**. PyPI and npm are the only sources of executables.

## 2. Installation matrix

| component | status | source | notes |
|---|---|---|---|
| FFmpeg 7.0.2 | **installed** | `imageio-ffmpeg` wheel → `.tools/ffmpeg` | full static build; libx264, libx265, libvpx, libaom, libass, freetype, fribidi, harfbuzz, loudnorm, rubberband |
| ffprobe 4.0.2 | **installed** | `ffprobe-static` (npm) → `.tools/ffprobe` | newer-but-static; the code falls back to FFmpeg stderr parsing if absent |
| Python venv + 20 packages | **installed** | PyPI | see `requirements.txt` |
| Node/npm | already present | system | v22.22.3 / 10.9.8 |
| Remotion 4.0.538 + React 19 | **installed** | npm | renders successfully |
| Headless Chromium 153 | **installed** | `@sparticuz/chromium` tarball → `.tools/chromium` | see §3 |
| NSS/NSPR/expat shared libs | **installed** | same package (`al2023.tar.br`) → `.tools/chromium/lib` | needed by that Chromium |
| Fonts (23 TTF) | **installed** | `@fontsource/*` npm → WOFF→TTF via fontTools | see §4 |
| espeak-ng (offline TTS) | **installed** | `espeakng-loader` wheel (lib + voice data) | driven via ctypes |
| libass / fontconfig setup | **configured** | generated `fonts.conf` in `.tools/fontconfig` | without it libass renders boxes |
| Remotion Chrome Headless Shell | **failed** | downloads from a blocked host | replaced by the npm-bundled Chromium |
| `apt-get install ffmpeg` | **failed** | mirrors unreachable | replaced by the wheel binary |
| Piper TTS | **not installed** | needs voice `.onnx` from a blocked host | hook present, `YTV_PIPER_MODEL` |
| faster-whisper / Whisper | **not installed** | model download blocked | clear runtime error, not fake output |
| ImageMagick | not installed | not needed | Pillow covers it |
| Blender / NLE GUIs | not installed | not needed / no display | FFmpeg+Remotion path replaces them |
| GPU encoders (NVENC/VAAPI/QSV) | **unavailable** | no hardware | auto-detected, CPU fallback used |

## 3. How Chromium was made to work

Remotion normally calls `npx remotion browser ensure`, which downloads Chrome
Headless Shell. Both `storage.googleapis.com` and GitHub release assets are
blocked, so that step fails.

`@sparticuz/chromium` (used for AWS Lambda) ships the browser *inside its npm
tarball* as Brotli-compressed blobs:

```
node_modules/@sparticuz/chromium/bin/chromium.br     # 67 MB → 199 MB binary
node_modules/@sparticuz/chromium/bin/al2023.tar.br   # NSS/NSPR/expat libs
```

`bootstrap.sh` decompresses them into `.tools/chromium/`, and because that
Chromium is linked against NSS (which Debian's minimal image lacks) the bundled
libraries are put on `LD_LIBRARY_PATH`. Remotion is then pointed at it with
`--browser-executable` (also set in `remotion.config.ts`).

Verified:

```
$ .tools/chromium/chromium --version
Chromium 153.0.8010.0
$ npx remotion render src/index.ts ChannelIntro out.mp4
+ out.mp4  1.1 MB
```

## 4. How fonts were solved

libass (burning subtitles) and Remotion both need real font files. This image has
none, which silently produces `□□□` boxes instead of text.

Fontsource publishes each weight as an npm package, so `scripts/install_fonts.py`
runs `npm pack @fontsource/inter` (etc.), pulls the WOFF, and converts it to TTF
with `fontTools` (`font.flavor = None`). FreeType cannot read WOFF, which is why
the conversion step exists.

A private fontconfig file (`.tools/fontconfig/fonts.conf`) points libass,
`drawtext` and any other fontconfig consumer at `fonts/`, and `graphics.find_font()`
falls back to the DejaVu faces that matplotlib always ships.

## 5. How audio without TTS models was solved

`espeakng-loader` (PyPI) ships `libespeak-ng.so` **and** the `espeak-ng-data`
voice directory — no system package, no root, no model download. `ytstudio/tts_espeak.py`
drives it through `ctypes` (synth callback → PCM buffer → WAV), then FFmpeg
resamples to 48 kHz stereo.

Output quality: intelligible, clearly synthetic. It is used for the demo and for
scratch timing passes. `ytstudio.audio.tts()` prefers Piper → espeak-ng →
ElevenLabs → OpenAI when configured, so dropping in a key or a voice model
upgrades narration without touching the pipeline.

## 6. Audio: what the mixing chain actually does

```
narration (placed at exact scene offsets, adelay + amix)
        │
        ├─ asplit ─► sidechain key
music (looped to length, level = music_gain_db, fade in/out)
        │
        └─ sidechaincompress (threshold, ratio 8, attack 20 ms, release 450 ms)
                │
                └─► amix(voice, ducked music, normalize=0) ─► alimiter 0.97
                                                                  │
                                              two-pass loudnorm I=-14 TP=-1.5
```

Measured on the demo: narration stem −17.6 LUFS, music bed ≈ −30 dB RMS under
speech, final master −14.9 → −14.0 LUFS. Music drops ~12 dB while the voice is
speaking and returns between sentences.

The music bed itself is *generated* (NumPy additive synthesis: chord pads, sub,
arpeggio, optional pulse, convolution reverb) so there is never a copyright
question. Styles: `calm`, `uplifting`, `cinematic`, `focus`.

## 7. Rendering optimisation, given no GPU

* One FFmpeg process per scene, one filtergraph — measured **~2× faster** than
  the two-pass (base clip → overlay) approach it replaced.
* Intermediates are encoded with `veryfast`/CRF 12 (near-lossless, cheap), the
  final master with the preset's `medium`/CRF 18.
* `zoompan` is fed a single still frame with `d=frames` instead of `-loop 1 -t`,
  which removes sub-pixel jitter and wasted decode work.
* Scene parallelism is *not* used: 2 vCPUs means serial x264 is faster than
  two threads fighting for the same cores. Batching is used for very long
  videos (>16 scenes) to keep single filtergraphs a sane size.
* Scene-level caching by content fingerprint makes re-runs (script edit, colour
  change) cost only the scenes that changed.
* `--draft` renders at 720p/CRF 26/veryfast for iteration, then the final pass
  re-encodes at delivery quality.
* Hardware paths (NVENC/VAAPI/QSV/VideoToolbox/AMF) are probed and used when
  present; `presets.hardware_variant()` returns the matching twin preset.

## 8. Reproducing from scratch

```bash
rm -rf .venv .tools fonts node_modules remotion-studio/node_modules
./bootstrap.sh            # ~3 minutes on this hardware
make test                 # 64 tests
make sample               # full demo render
```

`bootstrap.sh` is idempotent and skips anything already present (`--force` to
reinstall). On a normal machine with apt and internet, the same script simply
picks up the system FFmpeg/Chromium instead of the fallback copies.
