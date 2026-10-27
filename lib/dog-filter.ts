export const dogImageSources = {
  ears: "/filters/dog-ears.png",
  muzzle: "/filters/dog-muzzle-v2.png",
  lick: "/filters/dog-lick.png",
};

export type DogEarPhysics = {
  left: number;
  right: number;
  leftVelocity: number;
  rightVelocity: number;
  centerX: number;
  centerY: number;
  headAngle: number;
  lastTime: number;
};

type Landmark = { x: number; y: number; z?: number; visibility?: number };

export type DogImages = Record<keyof typeof dogImageSources, HTMLImageElement>;

export function drawDogImageFilter(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  images: DogImages,
  width: number,
  height: number,
  sourceWidth: number,
  sourceHeight: number,
  mirrored: boolean,
  earPhysics: DogEarPhysics,
  now: number,
  tongueOpen: boolean,
) {
  if (landmarks.length < 468 || !images.ears.complete || !images.muzzle.complete) return;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const offsetX = (sourceWidth * scale - width) / 2;
  const offsetY = (sourceHeight * scale - height) / 2;
  const point = (index: number) => {
    const landmark = landmarks[index];
    const x = landmark.x * sourceWidth * scale - offsetX;
    return { x: mirrored ? width - x : x, y: landmark.y * sourceHeight * scale - offsetY };
  };
  const leftEye = point(33);
  const rightEye = point(263);
  const nose = point(1);
  const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  if (!Number.isFinite(eyeDistance) || eyeDistance < 10) return;
  let angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  if (Math.abs(angle) > Math.PI / 2) angle += angle > 0 ? -Math.PI : Math.PI;
  const center = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };

  const dt = earPhysics.lastTime ? Math.min(0.05, Math.max(0.001, now - earPhysics.lastTime)) : 1 / 30;
  let horizontalVelocity = 0;
  let verticalVelocity = 0;
  let rollVelocity = 0;
  if (earPhysics.lastTime) {
    horizontalVelocity = (center.x - earPhysics.centerX) / eyeDistance / dt;
    verticalVelocity = (center.y - earPhysics.centerY) / eyeDistance / dt;
    let angleDelta = angle - earPhysics.headAngle;
    if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
    if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
    rollVelocity = angleDelta / dt;
  }
  const lateralLag = Math.max(-0.48, Math.min(0.48, -horizontalVelocity * 0.2 - rollVelocity * 0.035));
  const verticalLag = Math.max(-0.18, Math.min(0.18, -verticalVelocity * 0.14));
  const earTargets = [lateralLag + verticalLag, -lateralLag + verticalLag];
  earPhysics.leftVelocity += ((earTargets[0] - earPhysics.left) * 32 - earPhysics.leftVelocity * 7) * dt;
  earPhysics.rightVelocity += ((earTargets[1] - earPhysics.right) * 32 - earPhysics.rightVelocity * 7) * dt;
  earPhysics.left += earPhysics.leftVelocity * dt;
  earPhysics.right += earPhysics.rightVelocity * dt;
  earPhysics.centerX = center.x;
  earPhysics.centerY = center.y;
  earPhysics.headAngle = angle;
  earPhysics.lastTime = now;

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const earWidth = eyeDistance * 2.8;
  const halfWidth = earWidth / 2;
  const earHeight = earWidth * images.ears.naturalHeight / images.ears.naturalWidth;
  const hingeY = -eyeDistance * 1.12;
  const hingeOffsetY = -earHeight * 0.2;
  ctx.save();
  ctx.translate(-eyeDistance * 0.44, hingeY);
  ctx.rotate(earPhysics.left);
  ctx.drawImage(images.ears, 0, 0, images.ears.naturalWidth / 2, images.ears.naturalHeight, -halfWidth * 0.84, hingeOffsetY, halfWidth, earHeight);
  ctx.restore();
  ctx.save();
  ctx.translate(eyeDistance * 0.44, hingeY);
  ctx.rotate(earPhysics.right);
  ctx.drawImage(images.ears, images.ears.naturalWidth / 2, 0, images.ears.naturalWidth / 2, images.ears.naturalHeight, -halfWidth * 0.16, hingeOffsetY, halfWidth, earHeight);
  ctx.restore();
  ctx.restore();

  ctx.save();
  ctx.translate(nose.x, nose.y);
  ctx.rotate(angle);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const muzzleWidth = eyeDistance * 1.8;
  const closedHeight = muzzleWidth * images.muzzle.naturalHeight / images.muzzle.naturalWidth;
  ctx.drawImage(images.muzzle, -muzzleWidth / 2, -closedHeight * 0.5, muzzleWidth, closedHeight);
  ctx.restore();

  if (tongueOpen) {
    const leftMouth = point(61);
    const rightMouth = point(291);
    const upperLip = point(13);
    const lowerLip = point(14);
    const mouthWidth = Math.hypot(rightMouth.x - leftMouth.x, rightMouth.y - leftMouth.y);
    const mouthCenter = { x: (upperLip.x + lowerLip.x) / 2, y: (upperLip.y + lowerLip.y) / 2 };
    const mouthAngle = Math.atan2(rightMouth.y - leftMouth.y, rightMouth.x - leftMouth.x);
    const opening = Math.hypot(lowerLip.x - upperLip.x, lowerLip.y - upperLip.y);
    const radiusX = mouthWidth * 0.34;
    const radiusY = Math.max(opening * 0.5, mouthWidth * 0.075);
    ctx.save();
    ctx.translate(mouthCenter.x, mouthCenter.y);
    ctx.rotate(mouthAngle);
    const cavity = ctx.createRadialGradient(0, 0, radiusY * 0.15, 0, 0, radiusX);
    cavity.addColorStop(0, "rgba(18, 2, 8, 0.46)");
    cavity.addColorStop(0.55, "rgba(49, 8, 17, 0.3)");
    cavity.addColorStop(1, "rgba(90, 21, 28, 0)");
    ctx.fillStyle = cavity;
    ctx.beginPath();
    ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

