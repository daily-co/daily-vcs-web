export const calculateViewportSize = (
  element: HTMLElement,
  aspectRatio: number
): { w: number; h: number } => {
  if (!element || !aspectRatio || aspectRatio === 0) return { w: 0, h: 0 };

  const { width, height } = element.getBoundingClientRect();
  const originalAspectRatio = width / height;

  return originalAspectRatio > aspectRatio
    ? { w: Math.floor(height * aspectRatio), h: height }
    : { w: width, h: Math.floor(width / aspectRatio) };
};
