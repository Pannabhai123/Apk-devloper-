import React from 'react';
import {Composition, Still} from 'remotion';
import {ChannelIntro, ChannelIntroProps} from './components/ChannelIntro';
import {TitleCard, TitleCardProps} from './components/TitleCard';
import {LowerThird, LowerThirdProps} from './components/LowerThird';
import {EndScreen, EndScreenProps} from './components/EndScreen';
import {KineticTitle, KineticProps} from './components/KineticTitle';

/**
 * Compositions exposed to the ytstudio pipeline.
 *
 *   python -m ytstudio remotion --composition ChannelIntro --out output/intro.mp4
 *
 * All are 1920x1080 @ 30fps to match the youtube-1080p30 preset; change the
 * width/height/fps here if you standardise on a different preset.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ChannelIntro"
        component={ChannelIntro}
        durationInFrames={90}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          channel: 'ytstudio',
          tagline: 'build once · publish forever',
          accent: '#ffb03b',
        }}
      />

      <Composition
        id="TitleCard"
        component={TitleCard}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'Build a YouTube Video Machine',
          subtitle: 'script → voice → scenes → master',
          accent: '#ffb03b',
          kicker: 'chapter one',
        }}
      />

      <Composition
        id="LowerThird"
        component={LowerThird}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          name: 'Ada Lovelace',
          role: 'Mathematician',
          accent: '#ffb03b',
        }}
      />

      <Composition
        id="EndScreen"
        component={EndScreen}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          channel: 'ytstudio',
          nextVideo: 'The next build',
          accent: '#ffb03b',
          subscribeText: 'Subscribe',
        }}
      />

      <Composition
        id="KineticTitle"
        component={KineticTitle}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          lines: ['Ship the video,', 'not the pipeline'],
          accent: '#ffb03b',
          highlight: 'ship video',
        }}
      />

      <Still
        id="ThumbnailBase"
        component={TitleCard}
        width={1280}
        height={720}
        defaultProps={{
          title: 'Thumbnail Base',
          subtitle: '',
          accent: '#ffb03b',
          kicker: '',
        }}
      />
    </>
  );
};
