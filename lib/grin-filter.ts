export type GrinLandmark = { x: number; y: number };

type Point = { x: number; y: number };
type Affine = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

function affineFromTriangles(source: Point[], target: Point[]): Affine | null {
  const [p0, p1, p2] = source;
  const [q0, q1, q2] = target;
  const denominator =
    p0.x * (p1.y - p2.y) + p1.x * (p2.y - p0.y) + p2.x * (p0.y - p1.y);
  if (Math.abs(denominator) < 0.001) return null;

  return {
    a:
      (q0.x * (p1.y - p2.y) + q1.x * (p2.y - p0.y) + q2.x * (p0.y - p1.y)) /
      denominator,
    c:
      (q0.x * (p2.x - p1.x) + q1.x * (p0.x - p2.x) + q2.x * (p1.x - p0.x)) /
      denominator,
    e:
      (q0.x * (p1.x * p2.y - p2.x * p1.y) +
        q1.x * (p2.x * p0.y - p0.x * p2.y) +
        q2.x * (p0.x * p1.y - p1.x * p0.y)) /
      denominator,
    b:
      (q0.y * (p1.y - p2.y) + q1.y * (p2.y - p0.y) + q2.y * (p0.y - p1.y)) /
      denominator,
    d:
      (q0.y * (p2.x - p1.x) + q1.y * (p0.x - p2.x) + q2.y * (p1.x - p0.x)) /
      denominator,
    f:
      (q0.y * (p1.x * p2.y - p2.x * p1.y) +
        q1.y * (p2.x * p0.y - p0.x * p2.y) +
        q2.y * (p0.x * p1.y - p1.x * p0.y)) /
      denominator,
  };
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  frame: CanvasImageSource,
  source: Point[],
  target: Point[],
) {
  const transform = affineFromTriangles(source, target);
  if (!transform) return;
  const center = {
    x: (target[0].x + target[1].x + target[2].x) / 3,
    y: (target[0].y + target[1].y + target[2].y) / 3,
  };
  const clipPoints = target.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const length = Math.hypot(dx, dy) || 1;
    // Slightly overlap neighboring mesh cells so antialiasing cannot reveal hairline seams.
    return {
      x: point.x + (dx / length) * 2.5,
      y: point.y + (dy / length) * 2.5,
    };
  });
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(clipPoints[0].x, clipPoints[0].y);
  ctx.lineTo(clipPoints[1].x, clipPoints[1].y);
  ctx.lineTo(clipPoints[2].x, clipPoints[2].y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(
    transform.a,
    transform.b,
    transform.c,
    transform.d,
    transform.e,
    transform.f,
  );
  const left = Math.min(source[0].x, source[1].x, source[2].x);
  const top = Math.min(source[0].y, source[1].y, source[2].y);
  const right = Math.max(source[0].x, source[1].x, source[2].x);
  const bottom = Math.max(source[0].y, source[1].y, source[2].y);
  ctx.drawImage(
    frame,
    left,
    top,
    Math.max(1, right - left),
    Math.max(1, bottom - top),
    left,
    top,
    Math.max(1, right - left),
    Math.max(1, bottom - top),
  );
  ctx.restore();
}

export function drawGrinFilter(
  ctx: CanvasRenderingContext2D,
  frame: CanvasImageSource,
  landmarks: GrinLandmark[],
  irisTexture: HTMLImageElement | null,
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
    return {
      x: mirrored ? width - x : x,
      y: landmark.y * sourceHeight * scale - offsetY,
    };
  };
  const midpoint = (a: Point, b: Point): Point => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });
  const eyeCenterA = midpoint(point(33), point(133));
  const eyeCenterB = midpoint(point(362), point(263));
  const eyeDistance = Math.hypot(
    eyeCenterB.x - eyeCenterA.x,
    eyeCenterB.y - eyeCenterA.y,
  );
  const faceWidth = Math.hypot(
    point(234).x - point(454).x,
    point(234).y - point(454).y,
  );
  if (!Number.isFinite(eyeDistance) || eyeDistance < 8 || faceWidth < 20)
    return;

  const mouthLeft = point(61);
  const mouthRight = point(291);
  const lipCenter = midpoint(point(13), point(14));
  const currentMouthWidth = Math.hypot(
    mouthRight.x - mouthLeft.x,
    mouthRight.y - mouthLeft.y,
  );
  if (currentMouthWidth < 5) return;

  // Keep the forced grin inside each person's cheek width, so it scales with their face.
  const smileWidth = Math.min(
    faceWidth * 0.9,
    Math.max(currentMouthWidth * 2.1, faceWidth * 0.86),
  );
  const expansion = Math.max(
    0,
    Math.min(0.3, smileWidth / currentMouthWidth - 1),
  );
  const axisX = {
    x: (eyeCenterB.x - eyeCenterA.x) / eyeDistance,
    y: (eyeCenterB.y - eyeCenterA.y) / eyeDistance,
  };
  const perpendicularY = { x: -axisX.y, y: axisX.x };
  const chinDirection = {
    x: point(152).x - point(10).x,
    y: point(152).y - point(10).y,
  };
  const axisY =
    perpendicularY.x * chinDirection.x + perpendicularY.y * chinDirection.y < 0
      ? { x: -perpendicularY.x, y: -perpendicularY.y }
      : perpendicularY;
  const grinCenter = {
    x: lipCenter.x - axisY.x * eyeDistance * 0.15,
    y: lipCenter.y - axisY.y * eyeDistance * 0.15,
  };
  const halfPatchWidth = faceWidth * 0.96;
  const halfPatchHeight = eyeDistance * 0.78;
  const columns = 40;
  const rows = 20;
  const edgeBlendAt = (localX: number, localY: number) => {
    const faceEdgeDistance = Math.max(
      Math.abs(localX) / Math.max(faceWidth * 0.52, 1),
      Math.abs(localY) / Math.max(eyeDistance * 0.96, 1),
    );
    const edgeProgress = Math.max(0, Math.min(1, (faceEdgeDistance - 0.68) / 0.32));
    return 1 - edgeProgress * edgeProgress * (3 - 2 * edgeProgress);
  };
  const warpPoint = (source: Point): Point => {
    const offsetX = source.x - grinCenter.x;
    const offsetY = source.y - grinCenter.y;
    const localX = offsetX * axisX.x + offsetY * axisX.y;
    const localY = offsetX * axisY.x + offsetY * axisY.y;
    const xFalloff = localX / Math.max(faceWidth * 0.46, 1);
    // Keep the bridge and tip of the nose stable while carrying the grin across
    // the cheeks and down the lower face. The lower side gets a wider influence.
    const verticalReach = eyeDistance * (localY < 0 ? 0.3 : 0.62);
    const yFalloff = localY / Math.max(verticalReach, 1);
    const edgeBlend = edgeBlendAt(localX, localY);
    const influence = Math.exp(-(xFalloff ** 4) - yFalloff ** 4) * edgeBlend;
    const localDisplacementX = localX * expansion * influence;
    const smilePosition = Math.min(1, Math.abs(localX) / (smileWidth * 0.5));
    // Screen Y increases downward: this parabola drops the middle toward the chin
    // and lifts both ends toward the cheekbones, even when the source mouth is neutral.
    const smileCurve =
      eyeDistance * (0.24 - 0.78 * smilePosition ** 2) * influence;
    return {
      x: source.x + axisX.x * localDisplacementX + axisY.x * smileCurve,
      y: source.y + axisX.y * localDisplacementX + axisY.y * smileCurve,
    };
  };
  const faceContour = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
    378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
    162, 21, 54, 103, 67, 109,
  ].map((index) => warpPoint(point(index)));
  const sourceGrid: Point[][] = [];
  const targetGrid: Point[][] = [];

  for (let row = 0; row <= rows; row++) {
    const sourceLine: Point[] = [];
    const targetLine: Point[] = [];
    const localY = -halfPatchHeight + (2 * halfPatchHeight * row) / rows;
    for (let column = 0; column <= columns; column++) {
      const localX = -halfPatchWidth + (2 * halfPatchWidth * column) / columns;
      const source = {
        x: grinCenter.x + axisX.x * localX + axisY.x * localY,
        y: grinCenter.y + axisX.y * localX + axisY.y * localY,
      };
      sourceLine.push(source);
      targetLine.push(warpPoint(source));
    }
    sourceGrid.push(sourceLine);
    targetGrid.push(targetLine);
  }

  // The source is the raw camera frame; clipping to the deformed face outline prevents
  // its rectangular mouth-to-ear sampling area from painting the room over a new scene.
  ctx.save();
  ctx.beginPath();
  faceContour.forEach((contourPoint, index) => {
    if (index === 0) ctx.moveTo(contourPoint.x, contourPoint.y);
    else ctx.lineTo(contourPoint.x, contourPoint.y);
  });
  ctx.closePath();
  ctx.clip();
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const source00 = sourceGrid[row][column];
      const source10 = sourceGrid[row][column + 1];
      const source01 = sourceGrid[row + 1][column];
      const source11 = sourceGrid[row + 1][column + 1];
      const target00 = targetGrid[row][column];
      const target10 = targetGrid[row][column + 1];
      const target01 = targetGrid[row + 1][column];
      const target11 = targetGrid[row + 1][column + 1];
      const motion = Math.max(
        Math.hypot(target00.x - source00.x, target00.y - source00.y),
        Math.hypot(target10.x - source10.x, target10.y - source10.y),
        Math.hypot(target01.x - source01.x, target01.y - source01.y),
        Math.hypot(target11.x - source11.x, target11.y - source11.y),
      );
      if (motion < 0.12) continue;
      drawTriangle(
        ctx,
        frame,
        [source00, source10, source11],
        [target00, target10, target11],
      );
      drawTriangle(
        ctx,
        frame,
        [source00, source11, source01],
        [target00, target11, target01],
      );
    }
  }
  ctx.restore();

  if (!irisTexture?.complete || !irisTexture.naturalWidth) return;
  const eyes = [
    {
      center: landmarks[468] ? point(468) : eyeCenterA,
      corners: [33, 160, 158, 133, 153, 144],
    },
    {
      center: landmarks[473] ? point(473) : eyeCenterB,
      corners: [362, 385, 387, 263, 373, 380],
    },
  ];
  for (const eye of eyes) {
    const corners = eye.corners.map(point);
    const eyeWidth = Math.hypot(
      point(eye.corners[0]).x - point(eye.corners[3]).x,
      point(eye.corners[0]).y - point(eye.corners[3]).y,
    );
    const diameter = eyeWidth * 0.58;
    if (diameter < 4) continue;
    ctx.save();
    ctx.beginPath();
    corners.forEach((corner, index) =>
      index === 0
        ? ctx.moveTo(corner.x, corner.y)
        : ctx.lineTo(corner.x, corner.y),
    );
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(
      irisTexture,
      eye.center.x - diameter / 2,
      eye.center.y - diameter / 2,
      diameter,
      diameter,
    );
    ctx.restore();
  }
}
