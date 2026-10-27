const openThreshold = 0.24;
const closeThreshold = 0.16;

export function shouldDogTongueBeOpen(openness: number, currentlyOpen: boolean) {
  return currentlyOpen ? openness >= closeThreshold : openness > openThreshold;
}

export function normalizeLipGap(gap: number) {
  return Math.max(0, Math.min(1, (gap - 0.015) / 0.2));
}

export function getDogMouthOpenness(landmarks: Array<{ x: number; y: number }>, sourceWidth: number, sourceHeight: number) {
  const lipTop = landmarks[13];
  const lipBottom = landmarks[14];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  if (!lipTop || !lipBottom || !leftEye || !rightEye) return 0;
  const eyeDistance = Math.hypot((rightEye.x - leftEye.x) * sourceWidth, (rightEye.y - leftEye.y) * sourceHeight);
  const lipGap = Math.hypot((lipBottom.x - lipTop.x) * sourceWidth, (lipBottom.y - lipTop.y) * sourceHeight);
  return eyeDistance > 0 ? normalizeLipGap(lipGap / eyeDistance) : 0;
}
