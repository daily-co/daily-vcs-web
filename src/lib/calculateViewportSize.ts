export const calculateViewportSize = (
  element: HTMLElement,
  aspectRatio: number
): { w: number; h: number } => {
  let size = { w: 0, h: 0 };

  if (!element || !aspectRatio || aspectRatio === 0) return size;

  const { width, height } = element.getBoundingClientRect();
  const originalAspectRatio = width / height;

  if (originalAspectRatio > aspectRatio) {
    size = { w: Math.floor(height * aspectRatio), h: height };
  } else size = { w: width, h: Math.floor(width / aspectRatio) };

  return size;
};
