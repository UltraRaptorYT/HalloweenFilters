export type VoodooSkullImages = {
  triangle: HTMLImageElement;
  tears: HTMLImageElement;
  redIris: HTMLImageElement;
  whiteIris: HTMLImageElement;
};

export const voodooSkullImageSources: Record<keyof VoodooSkullImages, string> = {
  triangle: "/filters/voodoo-triangle.png",
  tears: "/filters/voodoo-tears.webp",
  redIris: "/filters/voodoo-iris.webp",
  whiteIris: "/filters/voodoo-white-iris.png",
};

type Landmark = { x: number; y: number };
type Point = { x: number; y: number };
type TrackedEye = { center: Point; iris: Point; corners: Point[]; width: number };

const eyeOutlines = [
  { indices: [33, 160, 158, 133, 153, 144] },
  { indices: [362, 385, 387, 263, 373, 380] },
];

function imageReady(image: HTMLImageElement | undefined): image is HTMLImageElement {
  return Boolean(image?.complete && image.naturalWidth > 0);
}

export function drawVoodooSkullFilter(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  images: Partial<VoodooSkullImages>,
  width: number,
  height: number,
  sourceWidth: number,
  sourceHeight: number,
  mirrored: boolean,
) {
  if (landmarks.length < 468 || sourceWidth <= 0 || sourceHeight <= 0) return;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const offsetX = (sourceWidth * scale - width) / 2;
  const offsetY = (sourceHeight * scale - height) / 2;
  const point = (index: number): Point => {
    const landmark = landmarks[index];
    const x = landmark.x * sourceWidth * scale - offsetX;
    return { x: mirrored ? width - x : x, y: landmark.y * sourceHeight * scale - offsetY };
  };
  const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  // Always define the tracking frame from screen-left to screen-right. Landmark
  // indices swap sides in a mirrored selfie camera; their raw order can turn art over.
  const eyes: TrackedEye[] = eyeOutlines.map(({ indices }, eyeIndex) => {
    const corners = indices.map(point);
    const irisIndex = eyeIndex === 0 ? 468 : 473;
    return {
      center: midpoint(corners[0], corners[3]),
      iris: landmarks[irisIndex] ? point(irisIndex) : midpoint(corners[0], corners[3]),
      corners,
      width: Math.hypot(corners[0].x - corners[3].x, corners[0].y - corners[3].y),
    };
  }).sort((a, b) => a.center.x - b.center.x);
  const screenLeftEye = eyes[0];
  const screenRightEye = eyes[1];
  const center = midpoint(screenLeftEye.center, screenRightEye.center);
  const eyeDistance = Math.hypot(screenRightEye.center.x - screenLeftEye.center.x, screenRightEye.center.y - screenLeftEye.center.y);
  if (!Number.isFinite(eyeDistance) || eyeDistance < 10) return;
  const angle = Math.atan2(screenRightEye.center.y - screenLeftEye.center.y, screenRightEye.center.x - screenLeftEye.center.x);
  const local = (p: Point) => {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    return { x: dx * Math.cos(angle) + dy * Math.sin(angle), y: -dx * Math.sin(angle) + dy * Math.cos(angle) };
  };
  const localEyes = eyes.map((eye) => ({
    center: local(eye.center),
    iris: local(eye.iris),
    corners: eye.corners.map(local),
    width: eye.width,
  }));
  const mouthLeft = local(point(61));
  const mouthRight = local(point(291));
  const mouthWidth = Math.hypot(mouthRight.x - mouthLeft.x, mouthRight.y - mouthLeft.y);

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);

  // Build soft, blurred pigment around each eye with radial shading. The eye
  // openings are removed afterward so the live eye remains clear underneath.
  ctx.save();
  ctx.filter = `blur(${Math.max(7, eyeDistance * 0.14)}px)`;
  for (const eye of localEyes) {
    const radius = eyeDistance * 0.56;
    const shadow = ctx.createRadialGradient(eye.center.x, eye.center.y, eyeDistance * 0.08, eye.center.x, eye.center.y, radius);
    shadow.addColorStop(0, "rgba(7, 5, 9, 0.94)");
    shadow.addColorStop(0.42, "rgba(20, 7, 13, 0.92)");
    shadow.addColorStop(0.68, "rgba(139, 31, 43, 0.72)");
    shadow.addColorStop(0.88, "rgba(164, 47, 55, 0.34)");
    shadow.addColorStop(1, "rgba(164, 47, 55, 0)");
    ctx.fillStyle = shadow;
    ctx.fillRect(eye.center.x - radius, eye.center.y - radius, radius * 2, radius * 2);
  }
  ctx.restore();

  if (imageReady(images.tears)) {
    const sourceMidX = images.tears.naturalWidth / 2;
    const markWidth = eyeDistance * 0.13;
    const markHeight = eyeDistance * 0.42;
    for (const [index, eye] of localEyes.entries()) {
      ctx.save();
      ctx.translate(eye.center.x, eye.center.y - eyeDistance * 0.59);
      ctx.scale(index === 0 ? -1 : 1, -1);
      ctx.drawImage(images.tears, 0, 0, sourceMidX, images.tears.naturalHeight, -markWidth / 2, -markHeight / 2, markWidth, markHeight);
      ctx.restore();
    }
  }

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  for (const eye of localEyes) {
    ctx.beginPath();
    eye.corners.forEach((p, index) => index === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  if (imageReady(images.tears)) {
    const halfWidth = images.tears.naturalWidth / 2;
    const streakWidth = eyeDistance * 0.14;
    const streakHeight = eyeDistance * 0.38;
    for (const [index, eye] of localEyes.entries()) {
      ctx.save();
      ctx.translate(eye.center.x, eye.center.y + eyeDistance * 0.29);
      ctx.scale(index === 0 ? -1 : 1, 1);
      ctx.drawImage(images.tears, 0, 0, halfWidth, images.tears.naturalHeight, -streakWidth / 2, -streakHeight / 2, streakWidth, streakHeight);
      ctx.restore();
    }
  }

  // Frame each live eye with a soft charcoal rim and a crisp, tracked lid line.
  ctx.strokeStyle = "rgba(5, 4, 7, 0.94)";
  ctx.lineWidth = Math.max(1.5, eyeDistance * 0.04);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.save();
  ctx.filter = `blur(${Math.max(1, eyeDistance * 0.018)}px)`;
  ctx.globalAlpha = 0.55;
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = eyeDistance * 0.018;
  for (const eye of localEyes) {
    const upper = eye.corners.slice(0, 4);
    ctx.beginPath();
    ctx.moveTo(upper[0].x, upper[0].y);
    ctx.quadraticCurveTo(upper[1].x, upper[1].y, upper[2].x, upper[2].y);
    ctx.quadraticCurveTo(upper[2].x, upper[2].y, upper[3].x, upper[3].y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = Math.max(1, eyeDistance * 0.022);
  ctx.globalAlpha = 0.82;
  for (const eye of localEyes) {
    const upper = eye.corners.slice(0, 4);
    ctx.beginPath();
    ctx.moveTo(upper[0].x, upper[0].y);
    ctx.quadraticCurveTo(upper[1].x, upper[1].y, upper[2].x, upper[2].y);
    ctx.quadraticCurveTo(upper[2].x, upper[2].y, upper[3].x, upper[3].y);
    ctx.stroke();

    const lower = [eye.corners[3], eye.corners[4], eye.corners[5], eye.corners[0]];
    ctx.beginPath();
    ctx.moveTo(lower[0].x, lower[0].y);
    ctx.quadraticCurveTo(lower[1].x, lower[1].y, lower[2].x, lower[2].y);
    ctx.quadraticCurveTo(lower[2].x, lower[2].y, lower[3].x, lower[3].y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // Match the Grin filter: preserve the iris image's shape and clip it to the live eye.
  for (const [index, eye] of localEyes.entries()) {
    const image = index === 0 ? images.redIris : images.whiteIris;
    if (!imageReady(image)) continue;
    const diameter = eye.width * 0.58;
    if (diameter < 4) continue;
    ctx.save();
    ctx.beginPath();
    eye.corners.forEach((corner, cornerIndex) => cornerIndex === 0 ? ctx.moveTo(corner.x, corner.y) : ctx.lineTo(corner.x, corner.y));
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(image, eye.iris.x - diameter / 2, eye.iris.y - diameter / 2, diameter, diameter);
    ctx.restore();
  }

  if (mouthWidth > 4 && imageReady(images.triangle)) {
    const upperLip = local(point(13));
    const lowerLip = local(point(14));
    const seamY = (upperLip.y + lowerLip.y) / 2;
    const seamCenter = { x: (mouthLeft.x + mouthRight.x) / 2, y: seamY };
    const seamCurve = (t: number) => ({
      x: mouthLeft.x + (mouthRight.x - mouthLeft.x) * t,
      y: mouthLeft.y * (1 - t) ** 2 + 2 * seamCenter.y * t * (1 - t) + mouthRight.y * t ** 2,
    });

    ctx.strokeStyle = "rgba(10, 8, 10, 0.9)";
    ctx.lineWidth = Math.max(1.5, eyeDistance * 0.018);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(mouthLeft.x, mouthLeft.y);
    ctx.quadraticCurveTo(seamCenter.x, seamCenter.y, mouthRight.x, mouthRight.y);
    ctx.stroke();

    const stitchWidth = mouthWidth * 0.026;
    const stitchHeight = stitchWidth * images.triangle.naturalHeight / images.triangle.naturalWidth;
    for (let stitch = 0; stitch < 9; stitch += 1) {
      const t = 0.08 + stitch * 0.105;
      const position = seamCurve(t);
      const before = seamCurve(Math.max(0, t - 0.01));
      const after = seamCurve(Math.min(1, t + 0.01));
      const tangent = Math.atan2(after.y - before.y, after.x - before.x);
      ctx.save();
      ctx.translate(position.x, position.y);
      ctx.rotate(tangent + Math.PI / 2);
      ctx.drawImage(images.triangle, -stitchWidth / 2, -stitchHeight / 2, stitchWidth, stitchHeight);
      ctx.restore();
    }
  }

  ctx.restore();
}
