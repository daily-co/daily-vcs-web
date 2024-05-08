import { DailyParticipant } from '@daily-co/daily-js';
import { isTrackOff } from './isTrackOff';

function makeVideoIdForVcs(p: DailyParticipant, isScreenshare: boolean) {
  return `${p.session_id}${isScreenshare ? '_sshare' : ''}`;
}

export const createVideoInputObject = (
  p: DailyParticipant,
  trackName: 'video' | 'screenVideo' | 'rmpVideo' = 'video'
) => {
  const t = p?.tracks?.[trackName];
  const isScreenshare = trackName === 'screenVideo';
  return {
    paused: t ? isTrackOff(t?.state) : false,
    pausedByUser: t?.off?.byUser ?? false,
    id: makeVideoIdForVcs(p, isScreenshare),
    displayName: isScreenshare ? '' : p.user_name || 'Guest',
    track: t?.persistentTrack,
    type: isScreenshare ? ('screenshare' as const) : ('camera' as const),
  };
};

export const createPeerObject = (
  p: DailyParticipant,
  isRMP: boolean = false
) => ({
  id: p.session_id,
  displayName: p.user_name || 'Guest',
  video: {
    id: makeVideoIdForVcs(p, false),
    paused: isTrackOff(
      isRMP ? p?.tracks?.rmpVideo?.state ?? 'off' : p?.tracks?.video?.state
    ),
  },
  audio: {},
  screenshareVideo: {
    id: makeVideoIdForVcs(p, true),
    paused: isTrackOff(p?.tracks?.screenVideo?.state),
  },
  screenshareAudio: {},
});
