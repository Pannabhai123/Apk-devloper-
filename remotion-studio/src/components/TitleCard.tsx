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

export type TitleCardProps = {
  title: string;
  subtitle: string;
  accent: string;
  kicker: string;
};

/** Animated title card: word-by-word rise with a sweeping accent underline. */
export const TitleCard: React.FC<TitleCardProps> = ({
  title,
  subtitle,
  accent,
  kicker,
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const ready = useBundledFonts();
  const base = Math.min(width, height);
  const words = title.split(/\s+/).filter(Boolean);

  const rule = spring({frame: frame - fps * 0.35, fps, config: {damping: 200}});
  const sub = interpolate(frame, [fps * 0.7, fps * 1.3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{opacity: ready ? 1 : 0}}>
      <Background accent={accent} seed={5} />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          padding: `0 ${base * 0.09}px`,
          fontFamily: FONT_STACK,
          textAlign: 'center',
        }}
      >
        {kicker ? (
          <div
            style={{
              fontSize: base * 0.019,
              letterSpacing: '0.34em',
              textTransform: 'uppercase',
              color: accent,
              marginBottom: base * 0.028,
              opacity: interpolate(frame, [0, fps * 0.4], [0, 1], {
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {kicker}
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: `${base * 0.012}px ${base * 0.022}px`,
            fontSize: base * 0.082,
            fontWeight: 900,
            lineHeight: 1.06,
            letterSpacing: '-0.025em',
            color: COLORS.text,
          }}
        >
          {words.map((w, i) => {
            const a = spring({
              frame: frame - i * 3,
              fps,
              config: {damping: 200, mass: 0.5},
            });
            return (
              <span
                key={`${w}-${i}`}
                style={{
                  display: 'inline-block',
                  opacity: a,
                  transform: `translateY(${interpolate(a, [0, 1], [50, 0])}px)`,
                  textShadow: `0 ${base * 0.006}px ${base * 0.02}px rgba(0,0,0,0.55)`,
                }}
              >
                {w}
              </span>
            );
          })}
        </div>

        <div
          style={{
            height: Math.max(6, base * 0.007),
            width: base * 0.20 * rule,
            background: accent,
            borderRadius: 99,
            marginTop: base * 0.035,
            boxShadow: `0 0 ${base * 0.03}px ${accent}88`,
          }}
        />

        {subtitle ? (
          <div
            style={{
              marginTop: base * 0.03,
              fontSize: base * 0.027,
              color: COLORS.muted,
              opacity: sub,
              transform: `translateY(${interpolate(sub, [0, 1], [16, 0])}px)`,
              maxWidth: base * 0.72,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
