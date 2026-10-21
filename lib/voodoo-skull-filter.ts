export type VoodooSkullImages = {
  iris: HTMLImageElement;
  whiteEye: HTMLImageElement;
  nose: HTMLImageElement;
  triangle: HTMLImageElement;
  tears: HTMLImageElement;
};

type Landmark = { x: number; y: number };
type Point = { x: number; y: number };
type TrackedEye = { center: Point; iris: Point; corners: Point[]; width: number };

const eyeOutlines = [
  { indices: [33, 160, 158, 133, 153, 144], irisIndex: 468 },
  { indices: [362, 385, 387, 263, 373, 380], irisIndex: 473 },
];

function imageReady(image: HTMLImageElement) {
  return image.complete && image.naturalWidth > 0;
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
  const eyes: TrackedEye[] = eyeOutlines.map(({ indices, irisIndex }) => {
    const corners = indices.map(point);
    return {
      center: midpoint(corners[0], corners[3]),
      iris: landmarks[irisIndex] ? point(irisIndex) : midpoint(corners[1], corners[5]),
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
  const upperLip = local(point(13));
  const lowerLip = local(point(14));
  const mouthWidth = Math.hypot(mouthRight.x - mouthLeft.x, mouthRight.y - mouthLeft.y);
  const mouthCenterX = (mouthLeft.x + mouthRight.x) / 2;
  const mouthAngle = Math.atan2(mouthRight.y - mouthLeft.y, mouthRight.x - mouthLeft.x);

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);

  // Build soft, blurred pigment around each eye with radial shading. The eye
  // openings are removed afterward so the live eye remains clear underneath.
  ctx.save();
  ctx.filter = `blur(${Math.max(7, eyeDistance * 0.2)}px)`;
  for (const eye of localEyes) {
    const radius = eyeDistance * 0.74;
    const shadow = ctx.createRadialGradient(eye.center.x, eye.center.y, eyeDistance * 0.06, eye.center.x, eye.center.y, radius);
    shadow.addColorStop(0, "rgba(8, 7, 10, 0.88)");
    shadow.addColorStop(0.38, "rgba(18, 12, 17, 0.78)");
    shadow.addColorStop(0.66, "rgba(82, 31, 42, 0.42)");
    shadow.addColorStop(0.88, "rgba(108, 45, 55, 0.14)");
    shadow.addColorStop(1, "rgba(108, 45, 55, 0)");
    ctx.fillStyle = shadow;
    ctx.fillRect(eye.center.x - radius, eye.center.y - radius, radius * 2, radius * 2);
  }
  ctx.restore();

  // Reuse one tear shape for both brows so they share the same orientation.
  // Mirror the second mark across the face, flip both vertically, and keep
  // them behind the live eye openings and eye decals.
  if (images.tears && imageReady(images.tears)) {
    const sourceMidX = images.tears.naturalWidth / 2;
    const browPairs = [[70, 107], [300, 336]] as const;
    const markWidth = eyeDistance * 0.6;
    const markHeight = markWidth * images.tears.naturalHeight / sourceMidX;
    for (const [index, eye] of localEyes.entries()) {
      const [outerBrowIndex, innerBrowIndex] = browPairs[index];
      const outerBrow = local(point(outerBrowIndex));
      const innerBrow = local(point(innerBrowIndex));
      ctx.save();
      ctx.translate(eye.center.x, eye.center.y - eyeDistance * 0.35);
      ctx.scale(index === 0 ? -1 : 1, -1);
      ctx.drawImage(
        images.tears,
        0, 0, sourceMidX, images.tears.naturalHeight,
        -markWidth / 2 + 10, -markHeight / 2, markWidth, markHeight,
      );
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

  // Follow The Grin's eye rendering: clip generated eye art to the live eyelids
  // and anchor it to the tracked iris center. Red stays on screen-left; white on right.
  for (const [index, eye] of localEyes.entries()) {
    if (eye.width < 4) continue;
    ctx.save();
    ctx.beginPath();
    eye.corners.forEach((p, cornerIndex) => cornerIndex === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.clip();
    if (index === 0 && images.iris && imageReady(images.iris)) {
      const diameter = eye.width * 0.58;
      ctx.drawImage(images.iris, eye.iris.x - diameter / 2, eye.iris.y - diameter / 2, diameter, diameter);
    } else if (index === 1 && images.whiteEye && imageReady(images.whiteEye)) {
      const eyeWidth = eye.width * 1.06;
      const eyeHeight = eyeWidth * images.whiteEye.naturalHeight / images.whiteEye.naturalWidth;
      ctx.drawImage(images.whiteEye, eye.iris.x - eyeWidth / 2, eye.iris.y - eyeHeight / 2, eyeWidth, eyeHeight);
    }
    ctx.restore();
  }

  // Layer a soft charcoal trace under a fine upper-lid edge so the liner
  // blends into the smoky pigment instead of reading as a hard graphic stroke.
  ctx.strokeStyle = "rgba(5, 4, 7, 0.94)";
  ctx.lineWidth = Math.max(1.5, eyeDistance * 0.024);
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
  ctx.lineWidth = Math.max(1, eyeDistance * 0.012);
  ctx.globalAlpha = 0.82;
  for (const eye of localEyes) {
    const upper = eye.corners.slice(0, 4);
    ctx.beginPath();
    ctx.moveTo(upper[0].x, upper[0].y);
    ctx.quadraticCurveTo(upper[1].x, upper[1].y, upper[2].x, upper[2].y);
    ctx.quadraticCurveTo(upper[2].x, upper[2].y, upper[3].x, upper[3].y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  if (images.nose && imageReady(images.nose)) {
    const nose = local(point(1));
    const noseWidth = eyeDistance * 0.36;
    const noseHeight = noseWidth * images.nose.naturalHeight / images.nose.naturalWidth;
    ctx.drawImage(images.nose, nose.x - noseWidth / 2, nose.y - noseHeight * 0.78 - eyeDistance * 0.12, noseWidth, noseHeight);
  }
  if (images.tears && imageReady(images.tears)) {
    const tearWidth = eyeDistance * 1.5;
    const tearHeight = tearWidth * images.tears.naturalHeight / images.tears.naturalWidth;
    ctx.drawImage(images.tears, -tearWidth / 2, eyeDistance * 0, tearWidth, tearHeight);
  }

  // Apply individual raster triangles along both lip edges. The lower row uses
  // the same marks flipped upward, and each row follows its live lip landmarks.
  if (mouthWidth > 4 && images.triangle && imageReady(images.triangle)) {
    const triangleWidth = mouthWidth * 0.2;
    const triangleHeight = triangleWidth * images.triangle.naturalHeight / images.triangle.naturalWidth;
    const cornerY = (mouthLeft.y + mouthRight.y) / 2;
    const lipRows = [
      { y: upperLip.y, flip: false },
      { y: lowerLip.y, flip: true },
    ];
    for (const { y: lipY, flip } of lipRows) {
      for (let mark = 0; mark < 10; mark += 1) {
        const t = -0.12 + mark * (1.24 / 9);
        const x = mouthLeft.x + (mouthRight.x - mouthLeft.x) * t;
        const lipT = Math.max(0, Math.min(1, t));
        const curve = 4 * lipT * (1 - lipT);
        const y = cornerY + (lipY - cornerY) * curve;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(mouthAngle);
        if (flip) ctx.scale(1, -1);
        ctx.globalAlpha = 0.9;
        ctx.drawImage(images.triangle, -triangleWidth / 2, -triangleHeight / 2, triangleWidth, triangleHeight);
        ctx.restore();
      }
    }
  }

  ctx.restore();
}
