const openThreshold = 0.24;
const closeThreshold = 0.16;

export function shouldDogTongueBeOpen(openness: number, currentlyOpen: boolean) {
  return currentlyOpen ? openness >= closeThreshold : openness > openThreshold;
}

export function normalizeLipGap(gap: number) {
  return Math.max(0, Math.min(1, (gap - 0.015) / 0.2));
}
