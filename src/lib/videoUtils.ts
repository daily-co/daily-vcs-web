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
  type: trackName === 'video' ? ('camera' as const) : ('screenshare' as const),
});

export const createPeerObject = (
  p: DailyParticipant,
  isRMP: boolean = false
) => ({
  id: p.session_id,
  displayName: p.user_name || 'Guest',
  video: {
    id:
      (isRMP ? p?.tracks?.rmpVideo?.track?.id : p?.tracks?.video?.track?.id) ??
      '',
    paused: isTrackOff(
      isRMP ? p?.tracks?.rmpVideo?.state ?? 'off' : p?.tracks?.video?.state
    ),
  },
  audio: {},
  screenshareVideo: {
    id: p?.tracks?.screenVideo?.track?.id ?? '',
    paused: isTrackOff(p?.tracks?.screenVideo?.state),
  },
  screenshareAudio: {},
});
