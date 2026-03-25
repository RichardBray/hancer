export interface Dimensions {
  width: number;
  height: number;
}

function roundDimension(value: number): number {
  return Math.max(1, Math.round(value));
}

export function fitPreviewSize(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth = 1920,
  maxHeight = 1080,
): Dimensions {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error(`Invalid source size ${sourceWidth}x${sourceHeight}`);
  }

  const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
  return {
    width: roundDimension(sourceWidth * scale),
    height: roundDimension(sourceHeight * scale),
  };
}
