import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {COLORS, FONT_STACK, useBundledFonts} from '../theme';

export type LowerThirdProps = {
  name: string;
  role: string;
  accent: string;
};

/** Transparent-friendly lower third (render with --codec h264 + alpha or over B-roll). */
export const LowerThird: React.FC<LowerThirdProps> = ({name, role, accent}) => {
  const frame = useCurrentFrame();
  const {fps, height} = useVideoConfig();
  const ready = useBundledFonts();
  const base = height;

  const enter = spring({frame, fps, config: {damping: 18, mass: 0.7}});
  const rule = interpolate(frame, [fps * 0.4, fps * 0.9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exit = interpolate(frame, [fps * 3.2, fps * 3.7], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{fontFamily: FONT_STACK, opacity: ready ? 1 - exit : 0}}>
      <div
        style={{
          position: 'absolute',
          left: base * 0.06,
          bottom: base * 0.12,
          display: 'flex',
          alignItems: 'stretch',
          transform: `translateX(${interpolate(enter, [0, 1], [-60, 0])}px)`,
          opacity: enter,
        }}
      >
        <div style={{width: base * 0.010, background: accent, borderRadius: 4}} />
        <div
          style={{
            marginLeft: base * 0.018,
            background: COLORS.panel,
            backdropFilter: 'blur(12px)',
            border: `2px solid ${accent}55`,
            borderRadius: base * 0.016,
            padding: `${base * 0.018}px ${base * 0.030}px`,
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          }}
        >
          <div
            style={{
              fontSize: base * 0.045,
              fontWeight: 800,
              color: COLORS.text,
              letterSpacing: '-0.01em',
            }}
          >
            {name}
          </div>
          <div
            style={{
              height: 2,
              width: `${rule * 100}%`,
              background: accent,
              margin: `${base * 0.010}px 0`,
              borderRadius: 2,
            }}
          />
          <div
            style={{
              fontSize: base * 0.024,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: COLORS.accent2,
            }}
          >
            {role}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
