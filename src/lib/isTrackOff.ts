import { DailyTrackState } from '@daily-co/daily-js';

export const isTrackOff = (state: DailyTrackState['state']): boolean => {
  return ['off', 'blocked'].includes(state);
};
