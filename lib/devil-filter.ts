export type DevilAssets = { horns: HTMLImageElement; wings: HTMLImageElement };
export const devilImageSources: Record<keyof DevilAssets, string> = {
  horns: "/filters/devil-horns.png",
  wings: "/filters/devil-wings.png",
};

type Landmark = { x: number; y: number; z?: number; visibility?: number };
export function drawDevilHorns(ctx: CanvasRenderingContext2D, face: Landmark[], horns: HTMLImageElement | undefined, width: number, height: number, sourceWidth: number, sourceHeight: number, mirrored: boolean) {
  if (!horns?.complete || !horns.naturalWidth || face.length < 468) return;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const offsetX = (sourceWidth * scale - width) / 2;
  const offsetY = (sourceHeight * scale - height) / 2;
  const point = (index: number) => {
    const landmark = face[index];
    const x = landmark.x * sourceWidth * scale - offsetX;
    return { x: mirrored ? width - x : x, y: landmark.y * sourceHeight * scale - offsetY };
  };
  const eyeCorners = [point(33), point(263)].sort((a, b) => a.x - b.x);
  const eyeDistance = Math.hypot(eyeCorners[1].x - eyeCorners[0].x, eyeCorners[1].y - eyeCorners[0].y);
  if (eyeDistance < 8) return;
  let angle = Math.atan2(eyeCorners[1].y - eyeCorners[0].y, eyeCorners[1].x - eyeCorners[0].x);
  if (Math.abs(angle) > Math.PI / 2) angle += angle > 0 ? -Math.PI : Math.PI;
  const center = { x: (eyeCorners[0].x + eyeCorners[1].x) / 2, y: (eyeCorners[0].y + eyeCorners[1].y) / 2 - eyeDistance * 0.72 };
  const propWidth = eyeDistance * 2.5;
  const propHeight = propWidth * horns.naturalHeight / horns.naturalWidth;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(horns, -propWidth / 2, -propHeight / 2, propWidth, propHeight);
  ctx.restore();
}

export function drawDevilBackProps(ctx: CanvasRenderingContext2D, poses: Landmark[][], assets: Partial<DevilAssets>, mask: HTMLCanvasElement | null, width: number, height: number, sourceWidth: number, sourceHeight: number, mirrored: boolean) {
  const wings = assets.wings;
  if (!mask?.width || !mask.height || !wings?.complete || !wings.naturalWidth) return;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const offsetX = (sourceWidth * scale - width) / 2;
  const offsetY = (sourceHeight * scale - height) / 2;
  const point = (landmark: Landmark) => {
    const x = landmark.x * sourceWidth * scale - offsetX;
    return { x: mirrored ? width - x : x, y: landmark.y * sourceHeight * scale - offsetY };
  };
  poses.forEach((pose) => {
    if (pose.length < 25) return;
    const shoulders = [point(pose[11]), point(pose[12])].sort((a, b) => a.x - b.x);
    const shoulderWidth = Math.hypot(shoulders[1].x - shoulders[0].x, shoulders[1].y - shoulders[0].y);
    if (shoulderWidth < 12) return;
    const center = { x: (shoulders[0].x + shoulders[1].x) / 2, y: (shoulders[0].y + shoulders[1].y) / 2 };
    const angle = Math.atan2(shoulders[1].y - shoulders[0].y, shoulders[1].x - shoulders[0].x);
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(angle);
    if (wings?.complete && wings.naturalWidth) {
      const propWidth = shoulderWidth * 2.25;
      const propHeight = propWidth * wings.naturalHeight / wings.naturalWidth;
      ctx.drawImage(wings, -propWidth / 2, -propHeight * 0.56, propWidth, propHeight);
    }
    ctx.restore();
  });

  const cropWidth = width / scale;
  const cropHeight = height / scale;
  const cropX = (sourceWidth - cropWidth) / 2;
  const cropY = (sourceHeight - cropHeight) / 2;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(mask, (cropX / sourceWidth) * mask.width, (cropY / sourceHeight) * mask.height, (cropWidth / sourceWidth) * mask.width, (cropHeight / sourceHeight) * mask.height, 0, 0, width, height);
  ctx.restore();
}

