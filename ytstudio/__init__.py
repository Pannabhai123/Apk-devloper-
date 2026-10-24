"""ytstudio — a complete, offline-first YouTube long-form video production system.

Built around three ideas:

* **FFmpeg does the heavy lifting.** Composition, motion, transitions, mixing
  and encoding all happen in one or two FFmpeg passes, so rendering stays fast
  on CPU-only machines (no GPU / no browser required for the main path).
* **Resumable by construction.** Every scene renders to its own file with a
  content fingerprint; a crashed 40-minute render resumes where it stopped.
* **Honest about what is available.** Capabilities are probed, never assumed.

Quick start
-----------
    ./bootstrap.sh
    .venv/bin/python -m ytstudio doctor
    .venv/bin/python -m ytstudio sample
    .venv/bin/python -m ytstudio init "My Topic" && ... && \
    .venv/bin/python -m ytstudio render projects/my-topic
"""

__version__ = "1.0.0"

from .engine import Project, VideoFactory, scaffold_project  # noqa: F401
from .presets import PRESETS, get_preset  # noqa: F401
from .scenes import Scene  # noqa: F401

__all__ = ["Project", "VideoFactory", "Scene", "PRESETS", "get_preset",
           "scaffold_project", "__version__"]
