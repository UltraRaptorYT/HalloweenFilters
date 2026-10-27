export type VampireAssets = { ribbon: HTMLImageElement; fangs: HTMLImageElement };
export const vampireImageSources: Record<keyof VampireAssets, string> = {
  ribbon: "/filters/vampire-ribbon.png",
  fangs: "/filters/vampire-fangs.png",
};

type Landmark = { x: number; y: number; z?: number; visibility?: number };
export function drawVampireRibbon(ctx: CanvasRenderingContext2D, face: Landmark[], pose: Landmark[] | undefined, ribbon: HTMLImageElement | undefined, width: number, height: number, sourceWidth: number, sourceHeight: number, mirrored: boolean) {
  if (!ribbon?.complete || !ribbon.naturalWidth || face.length < 468) return;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const offsetX = (sourceWidth * scale - width) / 2;
  const offsetY = (sourceHeight * scale - height) / 2;
  const point = (landmark: Landmark) => {
    const x = landmark.x * sourceWidth * scale - offsetX;
    return { x: mirrored ? width - x : x, y: landmark.y * sourceHeight * scale - offsetY };
  };
  const leftEye = point(face[33]);
  const rightEye = point(face[263]);
  const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  const chin = point(face[152]);
  let center = { x: chin.x, y: chin.y + eyeDistance * 0.22 };
  let accessoryWidth = eyeDistance * 0.62;
  let angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  if (pose?.length && (pose[11].visibility ?? 0) > 0.18 && (pose[12].visibility ?? 0) > 0.18) {
    const shoulders = [point(pose[11]), point(pose[12])].sort((a, b) => a.x - b.x);
    const shoulderWidth = Math.hypot(shoulders[1].x - shoulders[0].x, shoulders[1].y - shoulders[0].y);
    center = { x: (shoulders[0].x + shoulders[1].x) / 2, y: chin.y + (shoulders[0].y + shoulders[1].y - 2 * chin.y) * 0.54 };
    accessoryWidth = Math.min(shoulderWidth * 0.42, eyeDistance * 0.9);
    angle = Math.atan2(shoulders[1].y - shoulders[0].y, shoulders[1].x - shoulders[0].x);
  }
  const accessoryHeight = accessoryWidth * ribbon.naturalHeight / ribbon.naturalWidth;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);
  ctx.drawImage(ribbon, -accessoryWidth / 2, -accessoryHeight / 2, accessoryWidth, accessoryHeight);
  ctx.restore();
}

export function drawVampireFangs(ctx: CanvasRenderingContext2D, face: Landmark[], fangs: HTMLImageElement | undefined, width: number, height: number, sourceWidth: number, sourceHeight: number, mirrored: boolean) {
  if (!fangs?.complete || !fangs.naturalWidth || face.length < 468) return;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const offsetX = (sourceWidth * scale - width) / 2;
  const offsetY = (sourceHeight * scale - height) / 2;
  const point = (index: number) => {
    const landmark = face[index];
    const x = landmark.x * sourceWidth * scale - offsetX;
    return { x: mirrored ? width - x : x, y: landmark.y * sourceHeight * scale - offsetY };
  };
  const corners = [point(61), point(291)].sort((a, b) => a.x - b.x);
  const mouthWidth = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
  const upperLip = point(13);
  const leftEye = point(33);
  const rightEye = point(263);
  const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  if (mouthWidth < 5 || eyeDistance < 8) return;

  const center = { x: (corners[0].x + corners[1].x) / 2, y: upperLip.y };
  const angle = Math.atan2(corners[1].y - corners[0].y, corners[1].x - corners[0].x);
  const fangWidth = Math.min(mouthWidth * 0.62, eyeDistance * 0.42);
  const fangHeight = fangWidth * fangs.naturalHeight / fangs.naturalWidth;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);
  ctx.drawImage(fangs, -fangWidth / 2, -fangHeight * 0.08, fangWidth, fangHeight);
  ctx.restore();
}

