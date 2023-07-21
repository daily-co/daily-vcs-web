import { DailyTrackState } from '@daily-co/daily-js';
import { isTrackOff } from '../../src/lib/isTrackOff';

test('should return true when state is "off"', () => {
  const state: DailyTrackState['state'] = 'off';
  const result = isTrackOff(state);
  expect(result).toBe(true);
});

test('should return true when state is "blocked"', () => {
  const state: DailyTrackState['state'] = 'blocked';
  const result = isTrackOff(state);
  expect(result).toBe(true);
});

test('should return false when state is "sendable"', () => {
  const state: DailyTrackState['state'] = 'sendable';
  const result = isTrackOff(state);
  expect(result).toBe(false);
});

test('should return false when state is "loading"', () => {
  const state: DailyTrackState['state'] = 'loading';
  const result = isTrackOff(state);
  expect(result).toBe(false);
});

test('should return false when state is "interrupted"', () => {
  const state: DailyTrackState['state'] = 'interrupted';
  const result = isTrackOff(state);
  expect(result).toBe(false);
});

test('should return false when state is "playable"', () => {
  const state: DailyTrackState['state'] = 'playable';
  const result = isTrackOff(state);
  expect(result).toBe(false);
});
