import { DailyParticipant } from '@daily-co/daily-js';
import { isTrackOff } from './isTrackOff';

export const createVideoObject = (p: DailyParticipant) => ({
  active: true,
  id: p?.tracks?.video?.track?.id ?? '',
  sessionId: p.session_id,
  displayName: p.user_name || 'Guest',
  track: p?.tracks?.video?.persistentTrack,
  type: 'camera' as const,
});

export const createScreenshareObject = (p: DailyParticipant) => ({
  active: true,
  id: p?.tracks?.screenVideo?.track?.id ?? '',
  sessionId: p.session_id,
  displayName: '',
  track: p?.tracks?.screenVideo?.persistentTrack,
  type: 'screenshare' as const,
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
