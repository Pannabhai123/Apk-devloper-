/**
 * Shared design tokens + font loading.
 *
 * Fonts are bundled locally (fonts/ is copied into public/fonts by the build
 * script) instead of @remotion/google-fonts, because this environment cannot
 * reach Google's font CDN.
 */

import {staticFile} from 'remotion';
import {useEffect, useState} from 'react';

export const COLORS = {
  bgTop: '#0a0e1a',
  bgBottom: '#162848',
  accent: '#ffb03b',
  accent2: '#56ccf2',
  text: '#f5f7fc',
  muted: '#a6b2c8',
  panel: 'rgba(16,22,38,0.86)',
};

export const FONT_STACK =
  '"Inter", "DejaVu Sans", system-ui, -apple-system, "Segoe UI", sans-serif';

let fontsInjected = false;

/** Inject @font-face rules pointing at the bundled font files (idempotent). */
export const useBundledFonts = () => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!fontsInjected) {
      fontsInjected = true;
      const faces = [
        {weight: '400', file: 'Inter-Regular.ttf'},
        {weight: '600', file: 'Inter-SemiBold.ttf'},
        {weight: '700', file: 'Inter-Bold.ttf'},
        {weight: '900', file: 'Inter-Black.ttf'},
      ];
      const css = faces
        .map(
          (f) => `@font-face{font-family:"Inter";font-style:normal;font-weight:${f.weight};
                  src:url(${staticFile(`fonts/${f.file}`)}) format("truetype");
                  font-display:block;}`,
        )
        .join('\n');
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    }
    // wait for the faces to be usable before the first frame is captured
    const load = async () => {
      try {
        await Promise.all([
          document.fonts.load('700 100px Inter'),
          document.fonts.load('900 100px Inter'),
          document.fonts.load('400 100px Inter'),
        ]);
        await document.fonts.ready;
      } catch {
        /* fall back to the system stack */
      }
      setReady(true);
    };
    load();
  }, []);
  return ready;
};

/** Deterministic pseudo-random generator so renders are reproducible. */
export const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
