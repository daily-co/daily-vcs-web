import { DailyTrackState } from '@daily-co/daily-js';

export const isTrackOff = (state: DailyTrackState['state']): boolean =>
  ['off', 'blocked'].includes(state);
