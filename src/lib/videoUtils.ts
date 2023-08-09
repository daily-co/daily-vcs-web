import { DailyParticipant } from '@daily-co/daily-js';
import { isTrackOff } from './isTrackOff';

export const createTrackObject = (
  p: DailyParticipant,
  trackName: 'video' | 'screenVideo' | 'rmpVideo' = 'video'
) => ({
  active: true,
  id: p?.tracks?.[trackName]?.track?.id ?? '',
  sessionId: p.session_id,
  displayName: trackName === 'video' ? p.user_name || 'Guest' : '',
  track: p?.tracks?.[trackName]?.persistentTrack,
  type:
    trackName === 'screenVideo'
      ? ('screenshare' as const)
      : ('camera' as const),
});

export const createPeerObject = (p: DailyParticipant) => ({
  id: p.session_id,
  displayName: p.user_name || 'Guest',
  video: {
    id: p?.tracks?.video?.track?.id ?? '',
    paused: isTrackOff(p?.tracks?.video?.state),
  },
  audio: {},
  screenshareVideo: {
    id: p?.tracks?.screenVideo?.track?.id ?? '',
    paused: isTrackOff(p?.tracks?.screenVideo?.state),
  },
  screenshareAudio: {},
});
