import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {Background} from './Background';
import {COLORS, FONT_STACK, useBundledFonts} from '../theme';

export type KineticProps = {
  lines: string[];
  accent: string;
  highlight: string;
};

/**
 * Kinetic typography block: each line snaps in, keywords are highlighted,
 * and the whole stack drifts slowly so the frame never feels frozen.
 */
export const KineticTitle: React.FC<KineticProps> = ({
  lines,
  accent,
  highlight,
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const ready = useBundledFonts();
  const base = Math.min(width, height);
  const words = highlight.toLowerCase().split(/\s+/).filter(Boolean);

  return (
    <AbsoluteFill style={{opacity: ready ? 1 : 0}}>
      <Background accent={accent} seed={17} />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          padding: `0 ${base * 0.10}px`,
          fontFamily: FONT_STACK,
          transform: `scale(${1 + frame * 0.00018})`,
        }}
      >
        {lines.map((line, li) => {
          const enter = spring({
            frame: frame - li * 8,
            fps,
            config: {damping: 20, mass: 0.7},
          });
          return (
            <div
              key={li}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: `${base * 0.008}px ${base * 0.018}px`,
                fontSize: base * 0.070,
                fontWeight: li === 0 ? 900 : 700,
                lineHeight: 1.12,
                color: li === 0 ? COLORS.text : COLORS.muted,
                opacity: enter,
                transform: `translateX(${interpolate(enter, [0, 1], [-70, 0])}px)`,
              }}
            >
              {line.split(' ').map((w, wi) => {
                const isHi = words.includes(w.toLowerCase().replace(/[^\w]/g, ''));
                return (
                  <span
                    key={wi}
                    style={{
                      color: isHi
                        ? accent
                        : li === 0
                          ? COLORS.text
                          : COLORS.muted,
                      borderBottom: isHi ? `4px solid ${accent}` : undefined,
                    }}
                  >
                    {w}
                  </span>
                );
              })}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
