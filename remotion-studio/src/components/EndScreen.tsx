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

export type EndScreenProps = {
  channel: string;
  nextVideo: string;
  accent: string;
  subscribeText: string;
};

/**
 * Animated YouTube end screen.
 *
 * Kept inside the 5% safe margins YouTube overlays its own click targets on,
 * and stays fully static for the last 5 seconds (YouTube requires the elements
 * to be present for at least 5 s to keep them clickable/editable).
 */
export const EndScreen: React.FC<EndScreenProps> = ({
  channel,
  nextVideo,
  accent,
  subscribeText,
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const ready = useBundledFonts();
  const base = Math.min(width, height);

  const appear = (delay: number) =>
    spring({frame: frame - fps * delay, fps, config: {damping: 200, mass: 0.8}});

  const boxW = width * 0.33;
  const boxH = height * 0.28;
  const pop = appear(0.5);
  const pulse = 1 + Math.sin(frame / 12) * 0.012;

  const Zone: React.FC<{
    x: number;
    y: number;
    delay: number;
    children: React.ReactNode;
    highlight?: boolean;
  }> = ({x, y, delay, children, highlight}) => (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: boxW,
        height: boxH,
        borderRadius: base * 0.022,
        border: `3px solid ${highlight ? accent : 'rgba(255,255,255,0.22)'}`,
        background: highlight ? `${accent}14` : 'rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: base * 0.014,
        transform: `scale(${interpolate(appear(delay), [0, 1], [0.88, 1])})`,
        opacity: appear(delay),
        backdropFilter: 'blur(8px)',
      }}
    >
      {children}
    </div>
  );

  return (
    <AbsoluteFill style={{fontFamily: FONT_STACK, opacity: ready ? 1 : 0}}>
      <Background accent={accent} seed={23} />
      <AbsoluteFill
        style={{
          opacity: interpolate(frame, [fps * 4.8, fps * 5.2], [1, 1]), // hold steady
        }}
      >
        <Zone x={width * 0.09} y={height * 0.20} delay={0.2} highlight>
          <div
            style={{
              fontSize: base * 0.06,
              color: accent,
              transform: `scale(${pulse})`,
            }}
          >
            ▶
          </div>
          <div
            style={{
              fontSize: base * 0.026,
              letterSpacing: '0.18em',
              color: COLORS.text,
              textTransform: 'uppercase',
            }}
          >
            {subscribeText}
          </div>
        </Zone>

        <Zone x={width * 0.58} y={height * 0.20} delay={0.45}>
          <div
            style={{
              width: '82%',
              height: '52%',
              borderRadius: base * 0.012,
              background: `linear-gradient(120deg, ${COLORS.accent2}33, ${accent}33)`,
              border: '1px dashed rgba(255,255,255,0.30)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: COLORS.muted,
              fontSize: base * 0.020,
              letterSpacing: '0.12em',
            }}
          >
            NEXT VIDEO
          </div>
          <div style={{fontSize: base * 0.024, color: COLORS.text}}>
            {nextVideo}
          </div>
        </Zone>

        <div
          style={{
            position: 'absolute',
            width: '100%',
            top: height * 0.62,
            textAlign: 'center',
            fontSize: base * 0.070,
            fontWeight: 900,
            letterSpacing: '-0.02em',
            color: COLORS.text,
            opacity: appear(0.15),
            transform: `translateY(${interpolate(pop, [0, 1], [26, 0])}px)`,
          }}
        >
          {channel}
        </div>
        <div
          style={{
            position: 'absolute',
            width: '100%',
            top: height * 0.72,
            textAlign: 'center',
            fontSize: base * 0.026,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: COLORS.accent2,
            opacity: appear(0.7),
          }}
        >
          thanks for watching
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
