import { DailyParticipant } from '@daily-co/daily-js';
import { isTrackOff } from './isTrackOff';

function makeVideoIdForVcs(p: DailyParticipant, isScreenshare: boolean) {
  return `${p.session_id}${isScreenshare ? '_sshare' : ''}`;
}

export const createVideoInputObject = (
  p: DailyParticipant,
  dominant: boolean,
  trackName: 'video' | 'screenVideo' | 'rmpVideo' = 'video'
) => {
  const t = p?.tracks?.[trackName];
  const isScreenshare = trackName === 'screenVideo';
  return {
    id: makeVideoIdForVcs(p, isScreenshare),
    type: isScreenshare ? ('screenshare' as const) : ('camera' as const),
    displayName: isScreenshare ? '' : p.user_name || 'Guest',
    dominant,
    paused: t ? isTrackOff(t?.state) : false,
    pausedByUser: t?.off?.byUser ?? false,
    track: t?.persistentTrack,
  };
};

export const createPeerObject = (
  p: DailyParticipant,
  dominant: boolean,
  isRMP: boolean = false
) => ({
  id: p.session_id,
  displayName: p.user_name || 'Guest',
  video: {
    id: makeVideoIdForVcs(p, false),
    dominant,
    paused: isTrackOff(
      isRMP ? p?.tracks?.rmpVideo?.state ?? 'off' : p?.tracks?.video?.state
    ),
  },
  audio: {},
  screenshareVideo: {
    id: makeVideoIdForVcs(p, true),
    dominant,
    paused: isTrackOff(p?.tracks?.screenVideo?.state),
  },
  screenshareAudio: {},
});
