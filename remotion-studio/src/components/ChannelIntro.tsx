import React from 'react';
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Sequence,
} from 'remotion';
import {Background} from './Background';
import {COLORS, FONT_STACK, useBundledFonts} from '../theme';

export type ChannelIntroProps = {
  channel: string;
  tagline: string;
  accent: string;
};

/**
 * 3-second channel ident: mark draws in, wordmark slides up, tagline fades,
 * then a light sweep. Intended to open every long-form video.
 */
export const ChannelIntro: React.FC<ChannelIntroProps> = ({
  channel,
  tagline,
  accent,
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const ready = useBundledFonts();

  const mark = spring({frame, fps, config: {damping: 200, mass: 0.6}});
  const ringScale = interpolate(frame, [0, fps * 0.9], [0.6, 1], {
    extrapolateRight: 'clamp',
  });
  const sweep = interpolate(frame, [fps * 1.1, fps * 1.8], [-40, 140], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exit = interpolate(frame, [fps * 2.4, fps * 3], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const base = Math.min(width, height);

  return (
    <AbsoluteFill style={{opacity: ready ? exit : 0}}>
      <Background accent={accent} seed={11} />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          fontFamily: FONT_STACK,
          gap: base * 0.02,
        }}
      >
        <div
          style={{
            width: base * 0.17,
            height: base * 0.17,
            borderRadius: base * 0.05,
            transform: `scale(${ringScale}) rotate(${interpolate(
              mark,
              [0, 1],
              [-12, 0],
            )}deg)`,
            background: `linear-gradient(135deg, ${accent}, ${COLORS.accent2})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 ${base * 0.02}px ${base * 0.08}px ${accent}44`,
            opacity: mark,
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderTop: `${base * 0.035}px solid transparent`,
              borderBottom: `${base * 0.035}px solid transparent`,
              borderLeft: `${base * 0.055}px solid #0a0e1a`,
              marginLeft: base * 0.008,
            }}
          />
        </div>

        <div
          style={{
            marginTop: base * 0.05,
            overflow: 'hidden',
            display: 'flex',
          }}
        >
          <div
            style={{
              transform: `translateY(${interpolate(mark, [0, 1], [80, 0])}px)`,
              fontSize: base * 0.085,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: COLORS.text,
            }}
          >
            {channel}
          </div>
        </div>

        <Sequence from={Math.round(fps * 0.8)} layout="none">
          <div
            style={{
              fontSize: base * 0.026,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              color: COLORS.muted,
              opacity: interpolate(frame - fps * 0.8, [0, fps * 0.5], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {tagline}
          </div>
        </Sequence>
      </AbsoluteFill>

      {/* light sweep across the frame */}
      <AbsoluteFill
        style={{
          transform: `translateX(${sweep}%) skewX(-12deg)`,
          background: `linear-gradient(90deg, transparent, ${accent}22, transparent)`,
          width: '40%',
        }}
      />
    </AbsoluteFill>
  );
};
