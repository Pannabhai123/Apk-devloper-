import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';
import {COLORS, mulberry32} from '../theme';

/**
 * Layered animated background: gradient + drifting aurora blobs + film grain.
 * Pure CSS/canvas-free, so it renders identically in headless Chromium.
 */
export const Background: React.FC<{
  accent?: string;
  seed?: number;
  grain?: boolean;
}> = ({accent = COLORS.accent, seed = 3, grain = true}) => {
  const frame = useCurrentFrame();
  const rnd = mulberry32(seed);
  const blobs = new Array(4).fill(0).map(() => ({
    x: 10 + rnd() * 80,
    y: 10 + rnd() * 80,
    size: 30 + rnd() * 45,
    speed: 0.15 + rnd() * 0.5,
    phase: rnd() * Math.PI * 2,
    color: rnd() > 0.5 ? accent : COLORS.accent2,
    opacity: 0.10 + rnd() * 0.16,
  }));

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(115deg, ${COLORS.bgTop} 0%, #0f1c33 45%, ${COLORS.bgBottom} 100%)`,
        overflow: 'hidden',
      }}
    >
      {blobs.map((b, i) => {
        const dx = Math.sin(frame / 90 * b.speed * 10 + b.phase) * 4;
        const dy = Math.cos(frame / 110 * b.speed * 10 + b.phase) * 3;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${b.x + dx}%`,
              top: `${b.y + dy}%`,
              width: `${b.size}vmax`,
              height: `${b.size}vmax`,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${b.color} 0%, transparent 65%)`,
              opacity: b.opacity,
              filter: 'blur(30px)',
            }}
          />
        );
      })}
      {/* vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(4,6,12,0.55) 100%)',
        }}
      />
      {grain ? (
        <AbsoluteFill
          style={{
            opacity: 0.05,
            mixBlendMode: 'overlay',
            backgroundImage:
              'url(data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3"/></filter><rect width="120" height="120" filter="url(%23n)" opacity="0.6"/></svg>)',
            transform: `translate(${interpolate(frame % 30, [0, 30], [0, -6])}px, 0)`,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
