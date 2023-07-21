import { calculateViewportSize } from '../../src/lib/calculateViewportSize';

test('should return correct viewport size for valid element and aspectRatio', () => {
  const element = {
    getBoundingClientRect: () => ({
      width: 800,
      height: 600,
    }),
  };
  const aspectRatio = 1.5;
  const result = calculateViewportSize(element as HTMLElement, aspectRatio);
  // The calculated aspect ratio is 1.5, so w: 800 and h: 800/1.5 ≈ 533
  expect(result).toEqual({ w: 800, h: 533 });
});

test('should return { w: 0, h: 0 } for invalid aspectRatio', () => {
  const element = {
    getBoundingClientRect: () => ({
      width: 800,
      height: 600,
    }),
  };
  const aspectRatio = 0;
  const result = calculateViewportSize(element as HTMLElement, aspectRatio);
  expect(result).toEqual({ w: 0, h: 0 });
});

test('should return { w: 0, h: 0 } for aspectRatio equal to NaN', () => {
  const element = {
    getBoundingClientRect: () => ({
      width: 800,
      height: 600,
    }),
  };
  const aspectRatio = NaN;
  const result = calculateViewportSize(element as HTMLElement, aspectRatio);
  expect(result).toEqual({ w: 0, h: 0 });
});
