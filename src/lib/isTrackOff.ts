import { DailyTrackState } from '../types';

export const isTrackOff = (state: DailyTrackState): boolean => {
  return ['off', 'blocked'].includes(state);
};
