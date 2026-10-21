"use client";

import { useEffect, useRef, useState } from "react";
import NextImage from "next/image";
import type { FaceLandmarker as FaceLandmarkerType, PoseLandmarker as PoseLandmarkerType } from "@mediapipe/tasks-vision";
import type { TrackedArRenderer } from "@/lib/tracked-3d-lenses";
import { drawGrinFilter } from "@/lib/grin-filter";
import { normalizeLipGap, shouldDogTongueBeOpen } from "@/lib/dog-mouth";
import { getQueuedPhotos, removeQueuedPhoto, saveQueuedPhoto } from "@/lib/offline-photo-queue";

type Filter = {
  id: string;
  name: string;
  mood: string;
  symbol: string;
  texture: string;
  style: "makeup" | "transformation";
  tint: string;
  preview?: string;
};

const filters: Filter[] = [
  { id: "dog", name: "Good Dog", mood: "OPEN YOUR MOUTH FOR A SCREEN LICK", symbol: "DOG", texture: "", preview: "/icons/good-dog.webp", style: "transformation", tint: "#9a684a" },
  { id: "clown", name: "The Grin", mood: "RED EYES & A WIDE, TRACKED SMILE", symbol: "GRIN", texture: "", preview: "/icons/the-grin.webp", style: "transformation", tint: "#863f47" },
];
const maxTrackedFaces = 5;
const maxTrackedPoses = 5;
const backgrounds: Filter[] = [
  { id: "none", name: "Camera room", mood: "ORIGINAL BACKGROUND", symbol: "ROOM", texture: "", preview: "/icons/camera-room.webp", style: "makeup", tint: "#000000" },
  { id: "forest", name: "Haunted forest", mood: "FOG & MOONLIGHT", symbol: "FOG", texture: "", preview: "/scenes/haunted-forest.webp", style: "makeup", tint: "#000000" },
  { id: "pumpkin-night", name: "Pumpkin night", mood: "CANDLELIT GLOW", symbol: "EMBER", texture: "", preview: "/scenes/pumpkin-night.webp", style: "makeup", tint: "#000000" },
];
const sceneImageSources: Record<string, string> = {
  forest: "/scenes/haunted-forest.webp",
  "pumpkin-night": "/scenes/pumpkin-night.webp",
};
const costumeTextureSources: Record<string, string> = {
  "witch-velvet": "/costumes/witch-velvet.webp",
  "vampire-brocade": "/costumes/vampire-brocade.webp",
  "aged-bone": "/costumes/aged-bone.webp",
};

const faceTextureSources: Record<string, string> = {
  "ossuary": "/filters/ossuary.webp",
  "ossuary-alt": "/filters/ossuary-alt.webp",
  "fractured-skin": "/filters/fractured-skin.webp",
  "frostbitten": "/filters/frostbitten.webp",
  "stitched": "/filters/stitched.webp",
  "vampire": "/filters/vampire.webp",
  "carnival": "/filters/carnival.webp",
  "hag": "/filters/hag.webp",
};
const dogImageSources = {
  ears: "/filters/dog-ears.png",
  muzzle: "/filters/dog-muzzle-v2.png",
  lick: "/filters/dog-lick.png",
};
type DogEarPhysics = {
  left: number;
  right: number;
  leftVelocity: number;
  rightVelocity: number;
  centerX: number;
  centerY: number;
  headAngle: number;
  lastTime: number;
};

type Landmark = { x: number; y: number; visibility?: number };
type FaceTexture = { image: HTMLImageElement; landmarks: Landmark[] };
const faceOutlineIndices = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

function drawFaceTexture(
  ctx: CanvasRenderingContext2D,
  texture: FaceTexture,
  landmarks: Landmark[],
  width: number,
  height: number,
  sourceWidth: number,
  sourceHeight: number,
  mirrored: boolean,
  filter: Filter,
) {
  if (texture.landmarks.length < 468 || landmarks.length < 468) return;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const offsetX = (sourceWidth * scale - width) / 2;
  const offsetY = (sourceHeight * scale - height) / 2;
  const target = landmarks.map((landmark) => {
    const x = landmark.x * sourceWidth * scale - offsetX;
    return { x: mirrored ? width - x : x, y: landmark.y * sourceHeight * scale - offsetY };
  });
  const sourceEyes = [texture.landmarks[33], texture.landmarks[263]];
  const targetEyes = [target[33], target[263]];
  if (sourceEyes.some((point) => !point) || targetEyes.some((point) => !point)) return;
  const [sourceLeft, sourceRight] = sourceEyes.map((point) => ({ x: point.x * texture.image.naturalWidth, y: point.y * texture.image.naturalHeight }));
  const [targetLeft, targetRight] = targetEyes;
  const sourceAngle = Math.atan2(sourceRight.y - sourceLeft.y, sourceRight.x - sourceLeft.x);
  const sourceCenter = { x: (sourceLeft.x + sourceRight.x) / 2, y: (sourceLeft.y + sourceRight.y) / 2 };
  const targetCenter = { x: (targetLeft.x + targetRight.x) / 2, y: (targetLeft.y + targetRight.y) / 2 };
  const targetEyeDistance = Math.hypot(targetRight.x - targetLeft.x, targetRight.y - targetLeft.y);
  const sourceEyeDistance = Math.hypot(sourceRight.x - sourceLeft.x, sourceRight.y - sourceLeft.y);
  if (!targetEyeDistance || !sourceEyeDistance) return;
  const mirrorScaleX = mirrored ? -1 : 1;
  const adjustedSourceAngle = mirrored ? Math.atan2(sourceRight.y - sourceLeft.y, -(sourceRight.x - sourceLeft.x)) : sourceAngle;
  const tilt = Math.atan2(targetRight.y - targetLeft.y, targetRight.x - targetLeft.x) - adjustedSourceAngle;
  const textureScale = targetEyeDistance / sourceEyeDistance;
  ctx.save();
  ctx.beginPath();
  faceOutlineIndices.forEach((index, pointIndex) => {
    const point = target[index];
    if (!point) return;
    if (pointIndex === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.clip();
  ctx.translate(targetCenter.x, targetCenter.y);
  ctx.rotate(tilt);
  ctx.scale(textureScale * mirrorScaleX, textureScale);
  ctx.translate(-sourceCenter.x, -sourceCenter.y);
  ctx.globalAlpha = filter.style === "makeup" ? 0.36 : 0.86;
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(texture.image, 0, 0);
  ctx.restore();
}

function drawDogImageFilter(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  images: Record<keyof typeof dogImageSources, HTMLImageElement>,
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

function revealTrackedMouth(ctx: CanvasRenderingContext2D, landmarks: Landmark[], width: number, height: number, sourceWidth: number, sourceHeight: number, mirrored: boolean) {
  if (landmarks.length < 468) return;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const offsetX = (sourceWidth * scale - width) / 2;
  const offsetY = (sourceHeight * scale - height) / 2;
  const point = (index: number) => {
    const landmark = landmarks[index];
    const x = landmark.x * sourceWidth * scale - offsetX;
    return { x: mirrored ? width - x : x, y: landmark.y * sourceHeight * scale - offsetY };
  };
  const left = point(61);
  const right = point(291);
  const upperLip = point(13);
  const lowerLip = point(14);
  const mouthWidth = Math.hypot(right.x - left.x, right.y - left.y);
  if (!Number.isFinite(mouthWidth) || mouthWidth < 4) return;
  const opening = Math.hypot(lowerLip.x - upperLip.x, lowerLip.y - upperLip.y);
  const center = { x: (upperLip.x + lowerLip.x) / 2, y: (upperLip.y + lowerLip.y) / 2 };
  const radiusX = mouthWidth * 0.68;
  const radiusY = Math.max(mouthWidth * 0.17, Math.min(opening * 1.35, mouthWidth * 0.42));
  const angle = Math.atan2(right.y - left.y, right.x - left.x);

  // Show the live mouth through the generated portrait. The aperture grows with tracked lip separation.
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);
  ctx.scale(radiusX, radiusY);
  ctx.globalCompositeOperation = "destination-out";
  const feather = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  feather.addColorStop(0, "#000000ff");
  feather.addColorStop(0.76, "#000000f2");
  feather.addColorStop(1, "#00000000");
  ctx.fillStyle = feather;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSceneImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  const cropX = (image.naturalWidth - cropWidth) / 2;
  const cropY = (image.naturalHeight - cropHeight) / 2;
  ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);
}

function drawBodyCostume(ctx: CanvasRenderingContext2D, outfit: string, poses: Landmark[][], width: number, height: number, sourceWidth: number, sourceHeight: number, mirrored: boolean, textures: Record<string, HTMLImageElement>) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const offsetX = (sourceWidth * scale - width) / 2;
  const offsetY = (sourceHeight * scale - height) / 2;
  const textureKey = outfit === "witch-cloak" ? "witch-velvet" : outfit === "vampire-cape" ? "vampire-brocade" : "aged-bone";
  const texture = textures[textureKey];
  const material = texture ? ctx.createPattern(texture, "repeat") : null;
  material?.setTransform({ a: 0.28, b: 0, c: 0, d: 0.28, e: 0, f: 0 });
  for (const pose of poses) {
    if (pose.length < 33) continue;
    const point = (index: number) => {
      const landmark = pose[index];
      const x = landmark.x * sourceWidth * scale - offsetX;
      return { x: mirrored ? width - x : x, y: landmark.y * sourceHeight * scale - offsetY };
    };
    const leftShoulder = point(11); const rightShoulder = point(12);
    const leftElbow = point(13); const rightElbow = point(14);
    const leftWrist = point(15); const rightWrist = point(16);
    const leftHip = point(23); const rightHip = point(24);
    const leftKnee = point(25); const rightKnee = point(26);
    const leftAnkle = point(27); const rightAnkle = point(28);
    const legsVisible = (pose[27].visibility ?? 0) > 0.32 && (pose[28].visibility ?? 0) > 0.32;
    const centerX = (leftShoulder.x + rightShoulder.x) / 2;
    const centerY = (leftShoulder.y + rightShoulder.y) / 2;
    const shoulderWidth = Math.max(28, Math.hypot(rightShoulder.x - leftShoulder.x, rightShoulder.y - leftShoulder.y));
    const hipWidth = Math.max(20, Math.hypot(rightHip.x - leftHip.x, rightHip.y - leftHip.y));
    const torsoHeight = Math.max(35, ((leftHip.y + rightHip.y) - (leftShoulder.y + rightShoulder.y)) / 2);
    ctx.save();
    if (outfit === "skeleton-suit") {
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      const boneLine = (a: { x: number; y: number }, b: { x: number; y: number }, thickness: number) => {
        ctx.strokeStyle = "#171625e8"; ctx.lineWidth = thickness + 5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.save();
        ctx.shadowColor = "#fff1c0a8"; ctx.shadowBlur = thickness * 0.12; ctx.shadowOffsetX = -thickness * 0.045;
        ctx.strokeStyle = material ?? "#d8c8a7"; ctx.lineWidth = thickness; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = "#fff2cf80"; ctx.lineWidth = Math.max(1, thickness * 0.12); ctx.beginPath(); ctx.moveTo(a.x - thickness * 0.08, a.y - thickness * 0.08); ctx.lineTo(b.x - thickness * 0.08, b.y - thickness * 0.08); ctx.stroke();
      };
      boneLine(leftShoulder, rightShoulder, shoulderWidth * 0.095);
      boneLine(leftShoulder, leftHip, shoulderWidth * 0.1); boneLine(rightShoulder, rightHip, shoulderWidth * 0.1); boneLine(leftHip, rightHip, shoulderWidth * 0.09);
      boneLine(leftShoulder, leftElbow, shoulderWidth * 0.07); boneLine(leftElbow, leftWrist, shoulderWidth * 0.06);
      boneLine(rightShoulder, rightElbow, shoulderWidth * 0.07); boneLine(rightElbow, rightWrist, shoulderWidth * 0.06);
      if (legsVisible) {
        boneLine(leftHip, leftKnee, shoulderWidth * 0.075); boneLine(leftKnee, leftAnkle, shoulderWidth * 0.07);
        boneLine(rightHip, rightKnee, shoulderWidth * 0.075); boneLine(rightKnee, rightAnkle, shoulderWidth * 0.07);
        boneLine(leftKnee, rightKnee, shoulderWidth * 0.05);
      }
      for (let rib = 1; rib <= 4; rib++) {
        const y = centerY + torsoHeight * (0.18 + rib * 0.11);
        const t = rib / 6;
        const left = { x: leftShoulder.x + (leftHip.x - leftShoulder.x) * t, y };
        const right = { x: rightShoulder.x + (rightHip.x - rightShoulder.x) * t, y };
        boneLine(left, right, shoulderWidth * 0.045);
      }
      const neck = { x: centerX, y: centerY + torsoHeight * 0.1 };
      boneLine(neck, { x: centerX, y: leftHip.y + torsoHeight * 0.1 }, shoulderWidth * 0.065);
      for (const joint of [leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist, leftHip, rightHip]) {
        const radius = shoulderWidth * 0.055;
        const jointShade = ctx.createRadialGradient(joint.x - radius * 0.3, joint.y - radius * 0.4, 1, joint.x, joint.y, radius);
        jointShade.addColorStop(0, "#fff8dd"); jointShade.addColorStop(1, "#d5c8ac");
        ctx.fillStyle = jointShade; ctx.beginPath(); ctx.arc(joint.x, joint.y, radius, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      const vampire = outfit === "vampire-cape";
      const gradient = ctx.createLinearGradient(centerX - shoulderWidth, centerY, centerX + shoulderWidth, centerY + torsoHeight);
      if (vampire) {
        gradient.addColorStop(0, "#1c1730ed"); gradient.addColorStop(0.48, "#671d3aeF"); gradient.addColorStop(1, "#21172ff5");
      } else {
        gradient.addColorStop(0, "#261b43ed"); gradient.addColorStop(0.5, "#563878f2"); gradient.addColorStop(1, "#16162df7");
      }
      const capePoint = { x: centerX, y: centerY + torsoHeight * 0.75 };
      ctx.shadowColor = vampire ? "#d9285560" : "#a571ff65"; ctx.shadowBlur = shoulderWidth * 0.18;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      if (vampire) {
        ctx.moveTo(leftShoulder.x - shoulderWidth * 0.14, leftShoulder.y);
        ctx.quadraticCurveTo(centerX, centerY - shoulderWidth * 0.3, rightShoulder.x + shoulderWidth * 0.14, rightShoulder.y);
        ctx.lineTo(rightElbow.x + shoulderWidth * 0.14, rightElbow.y);
        ctx.lineTo(rightWrist.x + shoulderWidth * 0.08, rightWrist.y);
        ctx.lineTo(rightHip.x, rightHip.y + torsoHeight * 0.24);
        ctx.lineTo(capePoint.x, capePoint.y + torsoHeight * 0.26);
        ctx.lineTo(leftHip.x, leftHip.y + torsoHeight * 0.24);
        ctx.lineTo(leftWrist.x - shoulderWidth * 0.08, leftWrist.y);
        ctx.lineTo(leftElbow.x - shoulderWidth * 0.14, leftElbow.y);
      } else {
        ctx.moveTo(leftShoulder.x - shoulderWidth * 0.1, leftShoulder.y);
        ctx.quadraticCurveTo(centerX, centerY - shoulderWidth * 0.18, rightShoulder.x + shoulderWidth * 0.1, rightShoulder.y);
        ctx.lineTo(rightElbow.x + shoulderWidth * 0.1, rightElbow.y);
        ctx.lineTo(rightWrist.x, rightWrist.y);
        ctx.lineTo(rightHip.x + hipWidth * 0.12, rightHip.y + torsoHeight * 0.18);
        ctx.lineTo(leftHip.x - hipWidth * 0.12, leftHip.y + torsoHeight * 0.18);
        ctx.lineTo(leftWrist.x, leftWrist.y);
        ctx.lineTo(leftElbow.x - shoulderWidth * 0.1, leftElbow.y);
      }
      ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
      if (material) { ctx.globalAlpha = 0.86; ctx.fillStyle = material; ctx.fill(); ctx.globalAlpha = 1; }
      const clothSheen = ctx.createLinearGradient(centerX - shoulderWidth, centerY, centerX + shoulderWidth * 0.8, centerY + torsoHeight);
      clothSheen.addColorStop(0, "#ffffff14"); clothSheen.addColorStop(0.35, "#ffffff00"); clothSheen.addColorStop(0.72, "#00000035"); clothSheen.addColorStop(1, "#0000007a");
      ctx.fillStyle = clothSheen; ctx.fill();
      ctx.save();
      ctx.clip();
      for (let fold = -2; fold <= 2; fold++) {
        const startX = centerX + fold * shoulderWidth * 0.2;
        const endX = centerX + fold * hipWidth * 0.31;
        const foldShade = ctx.createLinearGradient(startX - shoulderWidth * 0.06, centerY, startX + shoulderWidth * 0.06, centerY + torsoHeight);
        foldShade.addColorStop(0, "#ffffff00"); foldShade.addColorStop(0.42, fold % 2 ? "#f6d6b415" : "#00000034"); foldShade.addColorStop(1, "#00000000");
        ctx.strokeStyle = foldShade;
        ctx.lineWidth = shoulderWidth * 0.11;
        ctx.beginPath(); ctx.moveTo(startX, centerY - shoulderWidth * 0.18); ctx.bezierCurveTo(startX - fold * shoulderWidth * 0.08, centerY + torsoHeight * 0.32, endX + fold * hipWidth * 0.04, leftHip.y, endX, leftHip.y + torsoHeight * 0.2); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = "#090910a8"; ctx.lineWidth = Math.max(1.2, shoulderWidth * 0.012); ctx.stroke();
      if (legsVisible) {
        const lowerGarment = ctx.createLinearGradient(centerX - hipWidth, leftHip.y, centerX + hipWidth, Math.max(leftAnkle.y, rightAnkle.y));
        if (vampire) { lowerGarment.addColorStop(0, "#24172fed"); lowerGarment.addColorStop(0.5, "#7b1e3cea"); lowerGarment.addColorStop(1, "#21172ff7"); }
        else { lowerGarment.addColorStop(0, "#251b40f0"); lowerGarment.addColorStop(0.5, "#65428bf0"); lowerGarment.addColorStop(1, "#211b39fa"); }
        ctx.fillStyle = lowerGarment;
        ctx.beginPath();
        ctx.moveTo(leftHip.x, leftHip.y - 2);
        ctx.lineTo(leftKnee.x - hipWidth * 0.16, leftKnee.y);
        ctx.lineTo(leftAnkle.x - hipWidth * 0.22, leftAnkle.y);
        ctx.quadraticCurveTo(centerX, Math.max(leftAnkle.y, rightAnkle.y) + torsoHeight * (vampire ? 0.22 : 0.09), rightAnkle.x + hipWidth * 0.22, rightAnkle.y);
        ctx.lineTo(rightKnee.x + hipWidth * 0.16, rightKnee.y);
        ctx.lineTo(rightHip.x, rightHip.y - 2);
        ctx.closePath(); ctx.fill();
        if (material) { ctx.globalAlpha = 0.86; ctx.fillStyle = material; ctx.fill(); ctx.globalAlpha = 1; }
        ctx.fillStyle = lowerGarment;
        ctx.globalAlpha = 0.3;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#090910a8"; ctx.lineWidth = Math.max(1.2, shoulderWidth * 0.012); ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function drawBat(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x - size * 0.35, y - size * 0.45, x - size, y - size * 0.25);
  ctx.quadraticCurveTo(x - size * 0.8, y + size * 0.15, x - size * 0.58, y + size * 0.38);
  ctx.quadraticCurveTo(x - size * 0.35, y + size * 0.2, x, y + size * 0.48);
  ctx.quadraticCurveTo(x + size * 0.35, y + size * 0.2, x + size * 0.58, y + size * 0.38);
  ctx.quadraticCurveTo(x + size * 0.8, y + size * 0.15, x + size, y - size * 0.25);
  ctx.quadraticCurveTo(x + size * 0.35, y - size * 0.45, x, y);
  ctx.fill();
}

function drawHorrorMakeup(ctx: CanvasRenderingContext2D, effect: string, localPoint: (index: number) => { x: number; y: number }, eyeDistance: number, faceWidth: number) {
  const contour = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
  const leftEye = localPoint(33);
  const rightEye = localPoint(263);
  const nose = localPoint(1);
  const mouth = localPoint(13);
  const mouthLeft = localPoint(61);
  const mouthRight = localPoint(291);
  const eyeY = (leftEye.y + rightEye.y) / 2;
  const cheekY = (eyeY + mouth.y) / 2;
  const color = effect === "vampire" ? "#48202c" : effect === "frostbite" ? "#9eb8be" : effect === "plague" ? "#777953" : effect === "stitched" ? "#875451" : "#3b2a43";

  ctx.save();
  ctx.beginPath();
  contour.forEach((index, position) => {
    const p = localPoint(index);
    if (position === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.clip();

  // Blend pigment into the live face instead of laying an opaque decal over it.
  ctx.globalCompositeOperation = "multiply";
  const wash = ctx.createRadialGradient(0, eyeY, eyeDistance * 0.12, 0, cheekY, faceWidth * 0.75);
  wash.addColorStop(0, `${color}72`);
  wash.addColorStop(0.62, `${color}48`);
  wash.addColorStop(1, "#17131900");
  ctx.fillStyle = wash;
  ctx.fillRect(-faceWidth, -eyeDistance * 1.05, faceWidth * 2, eyeDistance * 2.5);

  const socket = (eye: { x: number; y: number }, side: number) => {
    const radius = eyeDistance * 0.29;
    const shade = ctx.createRadialGradient(eye.x, eye.y, radius * 0.22, eye.x, eye.y, radius * 1.65);
    shade.addColorStop(0, effect === "vampire" ? "#160b13ed" : "#100e17ed");
    shade.addColorStop(0.64, effect === "frostbite" ? "#334a55ad" : "#261722bf");
    shade.addColorStop(1, "#29162000");
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(eye.x + side * eyeDistance * 0.035, eye.y, radius * 1.55, radius * 1.2, side * -0.08, 0, Math.PI * 2);
    ctx.fill();
  };
  socket(leftEye, -1);
  socket(rightEye, 1);

  if (effect === "vampire") {
    ctx.globalCompositeOperation = "multiply";
    const blood = ctx.createLinearGradient(0, mouth.y - eyeDistance * 0.05, 0, mouth.y + eyeDistance * 0.68);
    blood.addColorStop(0, "#711b2d55"); blood.addColorStop(0.35, "#8f152aaf"); blood.addColorStop(1, "#3a101c00");
    ctx.fillStyle = blood; ctx.beginPath(); ctx.moveTo(mouthRight.x, mouthRight.y); ctx.quadraticCurveTo(0, mouth.y + eyeDistance * 0.2, mouthLeft.x, mouthLeft.y); ctx.quadraticCurveTo(-faceWidth * 0.32, mouth.y + eyeDistance * 0.42, -faceWidth * 0.23, mouth.y + eyeDistance * 0.19); ctx.quadraticCurveTo(0, mouth.y + eyeDistance * 0.55, faceWidth * 0.22, mouth.y + eyeDistance * 0.24); ctx.quadraticCurveTo(faceWidth * 0.34, mouth.y + eyeDistance * 0.46, mouthRight.x, mouthRight.y); ctx.fill();
  } else if (effect === "stitched") {
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = "#3b171b"; ctx.lineWidth = eyeDistance * 0.055; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(mouthLeft.x - eyeDistance * 0.2, mouth.y - eyeDistance * 0.02); ctx.quadraticCurveTo(0, mouth.y + eyeDistance * 0.19, mouthRight.x + eyeDistance * 0.2, mouth.y - eyeDistance * 0.08); ctx.stroke();
    ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = 0.65;
    ctx.strokeStyle = "#c79585"; ctx.lineWidth = eyeDistance * 0.018;
    for (let i = -4; i <= 4; i++) { const x = i * eyeDistance * 0.15; ctx.beginPath(); ctx.moveTo(x - eyeDistance * 0.045, mouth.y - eyeDistance * 0.12); ctx.lineTo(x + eyeDistance * 0.045, mouth.y + eyeDistance * 0.11); ctx.stroke(); }
  } else if (effect === "possessed") {
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.76;
    ctx.strokeStyle = "#17101c"; ctx.lineWidth = eyeDistance * 0.028; ctx.lineCap = "round";
    for (const side of [-1, 1]) {
      const eye = side < 0 ? leftEye : rightEye;
      for (let branch = 0; branch < 3; branch++) {
        const startX = eye.x + side * eyeDistance * (0.18 + branch * 0.07);
        const startY = eye.y + eyeDistance * 0.1;
        ctx.beginPath(); ctx.moveTo(startX, startY); ctx.bezierCurveTo(startX + side * eyeDistance * 0.15, startY + eyeDistance * 0.22, startX - side * eyeDistance * 0.1, startY + eyeDistance * 0.38, startX + side * eyeDistance * 0.11, startY + eyeDistance * 0.58); ctx.stroke();
      }
    }
  } else if (effect === "frostbite" || effect === "plague") {
    ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = effect === "frostbite" ? 0.5 : 0.64;
    for (const side of [-1, 1]) {
      const cheek = localPoint(side < 0 ? 234 : 454);
      const bruise = ctx.createRadialGradient(cheek.x, cheek.y, 1, cheek.x, cheek.y, eyeDistance * 0.62);
      bruise.addColorStop(0, effect === "frostbite" ? "#77969eaa" : "#465034ae"); bruise.addColorStop(1, "#55434400");
      ctx.fillStyle = bruise; ctx.beginPath(); ctx.ellipse(cheek.x, cheek.y, eyeDistance * 0.55, eyeDistance * 0.34, side * 0.16, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Small, repeatable pigment fractures add material detail without a flat graphic edge.
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = effect === "frostbite" ? "#e5f3f2" : "#241b20";
  ctx.lineWidth = Math.max(0.7, eyeDistance * 0.008);
  for (let i = 0; i < 9; i++) {
    const seed = (i * 73 + 19) % 101;
    const x = (seed / 101 - 0.5) * faceWidth * 1.45;
    const y = -eyeDistance * 0.3 + ((i * 47 + 13) % 89) / 89 * eyeDistance * 1.42;
    const length = eyeDistance * (0.08 + (i % 4) * 0.035);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + length * 0.33, y - length * 0.2); ctx.lineTo(x + length * 0.58, y + length * 0.15); ctx.lineTo(x + length, y - length * 0.1); ctx.stroke();
  }
  ctx.restore();
}

function drawTrackedFilter(ctx: CanvasRenderingContext2D, filter: Filter, landmarks: Landmark[], width: number, height: number, sourceWidth: number, sourceHeight: number, mirrored: boolean, textureReady: boolean) {
  if (landmarks.length < 468) return;
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
  const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  if (!Number.isFinite(eyeDistance) || eyeDistance < 10) return;
  const center = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };
  const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

  ctx.save();
  ctx.beginPath();
  faceOutlineIndices.forEach((index, position) => {
    const vertex = point(index);
    if (position === 0) ctx.moveTo(vertex.x, vertex.y);
    else ctx.lineTo(vertex.x, vertex.y);
  });
  ctx.closePath();
  ctx.clip();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);

  if (!textureReady) {
    // Landmark-based pigment is the fallback while the generated look loads.
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.48;
    const wash = ctx.createRadialGradient(0, eyeDistance * 0.38, eyeDistance * 0.12, 0, eyeDistance * 0.42, eyeDistance * 1.45);
    wash.addColorStop(0, filter.tint + "a0");
    wash.addColorStop(0.64, filter.tint + "68");
    wash.addColorStop(1, filter.tint + "00");
    ctx.fillStyle = wash;
    ctx.beginPath();
    ctx.ellipse(0, eyeDistance * 0.43, eyeDistance * 1.22, eyeDistance * 1.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalAlpha = 0.75;
    for (const eye of [leftEye, rightEye]) {
      const eyeX = eye.x - center.x;
      const eyeY = eye.y - center.y;
      const shadow = ctx.createRadialGradient(eyeX, eyeY, eyeDistance * 0.05, eyeX, eyeY, eyeDistance * 0.48);
      shadow.addColorStop(0, "#100c16f2");
      shadow.addColorStop(0.52, filter.tint + "dd");
      shadow.addColorStop(1, filter.tint + "00");
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY, eyeDistance * 0.47, eyeDistance * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const mouth = point(13);
  const mouthLeft = point(61);
  const mouthRight = point(291);
  if (["vampire", "devil", "clown"].includes(filter.id)) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = filter.id === "clown" ? "#651f2bb8" : "#641826a8";
    ctx.beginPath();
    ctx.ellipse(mouth.x - center.x, mouth.y - center.y, eyeDistance * 0.35, eyeDistance * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (["stitched", "spider"].includes(filter.id)) {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = filter.id === "spider" ? "#23172dbb" : "#321c1acc";
    ctx.lineWidth = Math.max(1.5, eyeDistance * 0.027);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(mouthLeft.x - center.x - eyeDistance * 0.22, mouthLeft.y - center.y - eyeDistance * 0.12);
    ctx.quadraticCurveTo(0, mouth.y - center.y + eyeDistance * 0.05, mouthRight.x - center.x + eyeDistance * 0.22, mouthRight.y - center.y - eyeDistance * 0.12);
    ctx.stroke();
    if (filter.id === "stitched") {
      ctx.strokeStyle = "#d0b7a5cc";
      ctx.lineWidth = Math.max(1, eyeDistance * 0.012);
      for (let i = -4; i <= 4; i++) {
        const x = i * eyeDistance * 0.13;
        ctx.beginPath(); ctx.moveTo(x - eyeDistance * 0.035, mouth.y - center.y - eyeDistance * 0.015); ctx.lineTo(x + eyeDistance * 0.035, mouth.y - center.y + eyeDistance * 0.075); ctx.stroke();
      }
    }
  }
  if (["frostbite", "ice", "ghost"].includes(filter.id)) {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = "#d8eef4";
    ctx.lineWidth = Math.max(1, eyeDistance * 0.012);
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(side * eyeDistance * 0.48, eyeDistance * 0.05); ctx.lineTo(side * eyeDistance * 0.82, eyeDistance * 0.34); ctx.lineTo(side * eyeDistance * 0.58, eyeDistance * 0.64); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

const mediaPipeCpuInfo = "INFO: Created TensorFlow Lite XNNPACK delegate for CPU.";
function detectFaceForVideo(detector: FaceLandmarkerType, video: HTMLVideoElement, timestamp: number) {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith(mediaPipeCpuInfo)) return;
    originalError.apply(console, args);
  };
  try {
    return detector.detectForVideo(video, timestamp);
  } finally {
    console.error = originalError;
  }
}

function drawFaceEffect(ctx: CanvasRenderingContext2D, effect: string, landmarks: Landmark[], width: number, height: number, sourceWidth: number, sourceHeight: number, mirrored: boolean, time: number, textureReady = false) {
  if (!landmarks.length) return;
  const trackedFilter = filters.find((filter) => filter.id === effect);
  if (trackedFilter) {
    drawTrackedFilter(ctx, trackedFilter, landmarks, width, height, sourceWidth, sourceHeight, mirrored, textureReady);
    return;
  }
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
  const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  if (!Number.isFinite(eyeDistance) || eyeDistance < 10) return;
  const center = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };
  const screenLeftEye = leftEye.x < rightEye.x ? leftEye : rightEye;
  const screenRightEye = leftEye.x < rightEye.x ? rightEye : leftEye;
  const angle = Math.atan2(screenRightEye.y - screenLeftEye.y, screenRightEye.x - screenLeftEye.x);
  const localPoint = (index: number) => {
    const current = point(index);
    const dx = current.x - center.x;
    const dy = current.y - center.y;
    return {
      x: dx * Math.cos(angle) + dy * Math.sin(angle),
      y: -dx * Math.sin(angle) + dy * Math.cos(angle),
    };
  };
  const faceWidth = eyeDistance * 2.15;
  const top = localPoint(10).y - eyeDistance * 0.24;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);

  if (["possessed", "vampire", "stitched", "frostbite", "plague"].includes(effect)) {
    drawHorrorMakeup(ctx, effect, localPoint, eyeDistance, faceWidth);
    ctx.restore();
    return;
  }

  if (effect !== "ghost") {
    for (let i = 0; i < 3; i++) {
      const phase = time * 1.4 + i * (Math.PI * 2 / 3);
      const x = Math.cos(phase) * eyeDistance * (1.22 + 0.08 * Math.sin(phase * 0.5));
      const y = Math.sin(phase * 1.3) * eyeDistance * 0.78 - eyeDistance * 0.12;
      const radius = eyeDistance * (0.035 + (Math.sin(phase) + 1) * 0.012);
      const mote = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.35, radius * 0.08, x, y, radius * 1.8);
      mote.addColorStop(0, "#ffffffee");
      mote.addColorStop(0.28, i === 1 ? "#f2c6ffbd" : "#b9eaffbd");
      mote.addColorStop(1, "#d8c8ff00");
      ctx.fillStyle = mote;
      ctx.beginPath(); ctx.arc(x, y, radius * 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffffffc9";
      ctx.beginPath(); ctx.arc(x - radius * 0.24, y - radius * 0.28, radius * 0.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  if (effect === "ice") {
    ctx.strokeStyle = "#d8f5ff";
    ctx.lineWidth = Math.max(1.5, eyeDistance * 0.035);
    ctx.lineCap = "round";
    ctx.shadowColor = "#86dfff";
    ctx.shadowBlur = eyeDistance * 0.12;
    const branch = (sx: number, sy: number, ex: number, ey: number, flip: number) => {
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo((sx + ex) / 2 + flip * eyeDistance * 0.08, (sy + ey) / 2, ex, ey); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + (ex - sx) * 0.45, sy + (ey - sy) * 0.45); ctx.lineTo(sx + (ex - sx) * 0.42 + flip * eyeDistance * 0.19, sy + (ey - sy) * 0.28); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + (ex - sx) * 0.67, sy + (ey - sy) * 0.67); ctx.lineTo(sx + (ex - sx) * 0.76 - flip * eyeDistance * 0.17, sy + (ey - sy) * 0.5); ctx.stroke();
    };
    branch(-eyeDistance * 0.12, -eyeDistance * 0.16, -eyeDistance * 0.82, eyeDistance * 0.52, -1);
    branch(eyeDistance * 0.12, -eyeDistance * 0.16, eyeDistance * 0.82, eyeDistance * 0.52, 1);
    branch(-eyeDistance * 0.06, 0, -eyeDistance * 0.43, eyeDistance * 0.72, -1);
    branch(eyeDistance * 0.06, 0, eyeDistance * 0.43, eyeDistance * 0.72, 1);
    ctx.fillStyle = "#fff";
    for (const [x, y] of [[-eyeDistance * 0.6, eyeDistance * 0.2], [eyeDistance * 0.55, eyeDistance * 0.34], [0, -eyeDistance * 0.12]]) {
      ctx.beginPath(); ctx.arc(x, y, eyeDistance * 0.035, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (effect === "clown") {
    const left = localPoint(33);
    const right = localPoint(263);
    const mouth = localPoint(13);
    ctx.lineCap = "round";
    ctx.strokeStyle = "#e73652";
    ctx.lineWidth = eyeDistance * 0.105;
    ctx.beginPath(); ctx.moveTo(left.x - eyeDistance * 0.18, left.y - eyeDistance * 0.28); ctx.quadraticCurveTo(left.x, left.y - eyeDistance * 0.43, left.x + eyeDistance * 0.15, left.y - eyeDistance * 0.28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(right.x - eyeDistance * 0.15, right.y - eyeDistance * 0.28); ctx.quadraticCurveTo(right.x, right.y - eyeDistance * 0.43, right.x + eyeDistance * 0.18, right.y - eyeDistance * 0.28); ctx.stroke();
    ctx.fillStyle = "#26c9dd";
    for (const eye of [left, right]) {
      ctx.beginPath(); ctx.moveTo(eye.x, eye.y + eyeDistance * 0.16); ctx.lineTo(eye.x - eyeDistance * 0.17, eye.y + eyeDistance * 0.62); ctx.quadraticCurveTo(eye.x, eye.y + eyeDistance * 0.52, eye.x + eyeDistance * 0.17, eye.y + eyeDistance * 0.16); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = "#f0314c";
    ctx.beginPath(); ctx.ellipse(0, eyeDistance * 0.35, eyeDistance * 0.15, eyeDistance * 0.11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#e73652"; ctx.lineWidth = eyeDistance * 0.11;
    ctx.beginPath(); ctx.moveTo(-faceWidth * 0.39, mouth.y + eyeDistance * 0.06); ctx.quadraticCurveTo(0, mouth.y + eyeDistance * 0.43, faceWidth * 0.39, mouth.y + eyeDistance * 0.06); ctx.stroke();
    ctx.restore();
    return;
  }

  if (effect === "boo" || effect === "batgirl") {
    const pink = effect === "boo";
    ctx.fillStyle = pink ? "#ff62ae" : "#21192e";
    ctx.strokeStyle = pink ? "#b52f79" : "#100d18";
    ctx.lineWidth = Math.max(2, eyeDistance * 0.045);
    ctx.beginPath(); ctx.arc(0, top + eyeDistance * 0.22, eyeDistance * 0.9, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      if (pink) {
        ctx.moveTo(side * eyeDistance * 0.42, top + eyeDistance * 0.2);
        ctx.quadraticCurveTo(side * eyeDistance * 0.52, top - eyeDistance * 0.7, side * eyeDistance * 0.9, top - eyeDistance * 0.58);
        ctx.quadraticCurveTo(side * eyeDistance * 1.05, top - eyeDistance * 0.08, side * eyeDistance * 0.7, top + eyeDistance * 0.23);
      } else {
        ctx.moveTo(side * eyeDistance * 0.43, top + eyeDistance * 0.19);
        ctx.lineTo(side * eyeDistance * 0.7, top - eyeDistance * 0.68);
        ctx.quadraticCurveTo(side * eyeDistance * 0.93, top - eyeDistance * 0.12, side * eyeDistance * 0.8, top + eyeDistance * 0.2);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (pink) {
      ctx.fillStyle = "#ee3b91";
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(side * eyeDistance * 1.04, eyeDistance * 0.06, eyeDistance * 0.19, eyeDistance * 0.29, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ff9bd0"; ctx.beginPath(); ctx.ellipse(side * eyeDistance * 1.04, eyeDistance * 0.06, eyeDistance * 0.11, eyeDistance * 0.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ee3b91";
      }
    } else {
      ctx.fillStyle = "#21192e";
      drawBat(ctx, -faceWidth * 0.56, top + eyeDistance * 0.48, eyeDistance * 0.17);
      drawBat(ctx, faceWidth * 0.56, top + eyeDistance * 0.48, eyeDistance * 0.17);
    }
    ctx.restore();
    return;
  }

  if (effect === "beret") {
    ctx.fillStyle = "#e788bd";
    ctx.strokeStyle = "#a8477e";
    ctx.lineWidth = Math.max(2, eyeDistance * 0.04);
    ctx.beginPath(); ctx.ellipse(-eyeDistance * 0.06, top - eyeDistance * 0.18, eyeDistance * 0.92, eyeDistance * 0.35, -0.12, Math.PI, Math.PI * 2); ctx.lineTo(eyeDistance * 0.8, top + eyeDistance * 0.04); ctx.quadraticCurveTo(0, top + eyeDistance * 0.19, -eyeDistance * 0.86, top + eyeDistance * 0.03); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (let i = -2; i <= 2; i++) {
      ctx.fillStyle = ["#fed45e", "#8bd3d2", "#ef6e94", "#c39af2", "#fed45e"][i + 2];
      ctx.beginPath(); ctx.arc(i * eyeDistance * 0.25, top - eyeDistance * 0.12, eyeDistance * 0.085, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (effect === "cat") {
    ctx.fillStyle = "#34223f"; ctx.strokeStyle = "#150f1d"; ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(side * eyeDistance * 0.42, top + eyeDistance * 0.18); ctx.lineTo(side * eyeDistance * 0.63, top - eyeDistance * 0.55); ctx.lineTo(side * eyeDistance * 0.97, top + eyeDistance * 0.16); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#49364f"; ctx.lineWidth = Math.max(1.5, eyeDistance * 0.018);
      for (let whisker = 0; whisker < 3; whisker++) {
        ctx.beginPath(); ctx.moveTo(side * eyeDistance * 0.2, eyeDistance * (0.35 + whisker * 0.05)); ctx.lineTo(side * eyeDistance * 0.83, eyeDistance * (0.25 + whisker * 0.15)); ctx.stroke();
      }
    }
    ctx.fillStyle = "#e77b9c";
    ctx.beginPath(); ctx.moveTo(-eyeDistance * 0.13, eyeDistance * 0.27); ctx.lineTo(eyeDistance * 0.13, eyeDistance * 0.27); ctx.lineTo(0, eyeDistance * 0.43); ctx.closePath(); ctx.fill();
    ctx.restore();
    return;
  }

  if (effect === "witch") {
    ctx.fillStyle = "#5d337d"; ctx.strokeStyle = "#2a1a3a"; ctx.lineWidth = Math.max(2, eyeDistance * 0.04);
    ctx.beginPath(); ctx.moveTo(-eyeDistance * 0.83, top + eyeDistance * 0.08); ctx.quadraticCurveTo(-eyeDistance * 0.22, top - eyeDistance * 0.04, 0, top - eyeDistance * 0.93); ctx.quadraticCurveTo(eyeDistance * 0.18, top - eyeDistance * 0.13, eyeDistance * 0.74, top + eyeDistance * 0.08); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, top + eyeDistance * 0.1, eyeDistance * 0.92, eyeDistance * 0.16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#f7cf68"; ctx.lineWidth = Math.max(1, eyeDistance * 0.025);
    ctx.beginPath(); ctx.moveTo(-eyeDistance * 0.43, top + eyeDistance * 0.02); ctx.quadraticCurveTo(0, top - eyeDistance * 0.11, eyeDistance * 0.4, top + eyeDistance * 0.02); ctx.stroke();
    ctx.restore();
    return;
  }

  if (effect === "devil") {
    const horn = (x: number) => {
      ctx.save(); ctx.translate(x, top + eyeDistance * 0.05);
      ctx.fillStyle = "#f05a62"; ctx.strokeStyle = "#711f37"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-eyeDistance * 0.18, eyeDistance * 0.14); ctx.quadraticCurveTo(-eyeDistance * 0.22, -eyeDistance * 0.16, 0, -eyeDistance * 0.43); ctx.quadraticCurveTo(eyeDistance * 0.02, -eyeDistance * 0.09, eyeDistance * 0.2, eyeDistance * 0.14); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    };
    horn(-eyeDistance * 0.55); horn(eyeDistance * 0.55);
    ctx.fillStyle = "#fb5864";
    ctx.font = `${eyeDistance * 0.22}px serif`;
    ctx.fillText("♥", -faceWidth * 0.48, eyeDistance * 0.5);
    ctx.restore();
    return;
  }

  if (effect === "pumpkin") {
    ctx.font = `${eyeDistance * 0.76}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#ffb149"; ctx.shadowBlur = eyeDistance * 0.18;
    ctx.fillText("🎃", -eyeDistance * 0.56, top - eyeDistance * 0.27);
    ctx.fillText("🎃", eyeDistance * 0.56, top - eyeDistance * 0.27);
    ctx.restore();
    return;
  }

  if (effect === "bats") {
    ctx.fillStyle = "#241931";
    drawBat(ctx, -eyeDistance * 0.65, top - eyeDistance * 0.2, eyeDistance * 0.23);
    drawBat(ctx, eyeDistance * 0.7, top - eyeDistance * 0.5, eyeDistance * 0.16);
    drawBat(ctx, 0, top - eyeDistance * 0.58, eyeDistance * 0.19);
    ctx.restore();
    return;
  }

  if (effect === "spider") {
    ctx.strokeStyle = "#e8d8f5"; ctx.lineWidth = Math.max(1, eyeDistance * 0.012); ctx.globalAlpha = 0.88;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(0, top - eyeDistance * 0.45); ctx.lineTo(i * eyeDistance * 0.32, top + eyeDistance * 0.4); ctx.stroke();
    }
    for (let ring = 1; ring <= 3; ring++) {
      ctx.beginPath(); ctx.ellipse(0, top, eyeDistance * ring * 0.19, eyeDistance * ring * 0.2, 0, Math.PI, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.fillStyle = "#211827";
    ctx.beginPath(); ctx.arc(0, top + eyeDistance * 0.15, eyeDistance * 0.075, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#211827"; ctx.lineWidth = Math.max(1, eyeDistance * 0.015);
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(side * eyeDistance * 0.05, top + eyeDistance * 0.15 + i * 2); ctx.lineTo(side * eyeDistance * (0.14 + i * 0.035), top + eyeDistance * (0.12 + i * 0.09)); ctx.stroke();
    }
  }

  if (effect === "ghost") {
    const side = center.x + faceWidth * 0.75 + eyeDistance * 0.48 < width ? 1 : -1;
    const bob = Math.sin(time * 2.2) * eyeDistance * 0.09;
    const sway = Math.sin(time * 1.5) * 0.055;
    const ghostWidth = eyeDistance * 0.66;
    const ghostHeight = eyeDistance * 0.82;
    ctx.save();
    ctx.translate(side * eyeDistance * 1.43, eyeDistance * 1.48 + bob);
    ctx.rotate(sway);
    ctx.scale(0.96 + Math.sin(time * 2.5) * 0.035, 1);

    const shadow = ctx.createRadialGradient(0, ghostHeight * 0.62, 1, 0, ghostHeight * 0.62, ghostWidth * 0.9);
    shadow.addColorStop(0, "#21183362"); shadow.addColorStop(1, "#21183300");
    ctx.fillStyle = shadow; ctx.beginPath(); ctx.ellipse(0, ghostHeight * 0.62, ghostWidth * 0.9, ghostHeight * 0.19, 0, 0, Math.PI * 2); ctx.fill();

    ctx.translate(0, -ghostHeight * 0.45);
    ctx.scale(side, 1);
    ctx.fillStyle = "#9884c9aa";
    ctx.beginPath(); ctx.moveTo(-ghostWidth * 0.48, ghostHeight * 0.77); ctx.bezierCurveTo(-ghostWidth * 0.6, ghostHeight * 0.25, -ghostWidth * 0.5, 0, 0, 0); ctx.bezierCurveTo(ghostWidth * 0.48, 0, ghostWidth * 0.58, ghostHeight * 0.35, ghostWidth * 0.48, ghostHeight * 0.77); ctx.quadraticCurveTo(ghostWidth * 0.28, ghostHeight * 0.66, ghostWidth * 0.1, ghostHeight * 0.81); ctx.quadraticCurveTo(-ghostWidth * 0.12, ghostHeight * 0.67, -ghostWidth * 0.28, ghostHeight * 0.82); ctx.closePath(); ctx.fill();

    const body = ctx.createLinearGradient(-ghostWidth * 0.55, 0, ghostWidth * 0.52, ghostHeight * 0.85);
    body.addColorStop(0, "#fffffffa"); body.addColorStop(0.32, "#e8f5ffff"); body.addColorStop(0.72, "#b7c7e9f5"); body.addColorStop(1, "#8c82bce8");
    ctx.fillStyle = body;
    ctx.shadowColor = "#c8dcffbd"; ctx.shadowBlur = eyeDistance * 0.22;
    ctx.beginPath(); ctx.moveTo(-ghostWidth * 0.47, ghostHeight * 0.72); ctx.bezierCurveTo(-ghostWidth * 0.59, ghostHeight * 0.25, -ghostWidth * 0.48, 0, 0, 0); ctx.bezierCurveTo(ghostWidth * 0.48, 0, ghostWidth * 0.58, ghostHeight * 0.3, ghostWidth * 0.47, ghostHeight * 0.72); ctx.quadraticCurveTo(ghostWidth * 0.27, ghostHeight * 0.62, ghostWidth * 0.1, ghostHeight * 0.77); ctx.quadraticCurveTo(-ghostWidth * 0.1, ghostHeight * 0.64, -ghostWidth * 0.3, ghostHeight * 0.78); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffffffd9"; ctx.lineWidth = Math.max(1.5, eyeDistance * 0.025); ctx.stroke();

    const highlight = ctx.createRadialGradient(-ghostWidth * 0.22, ghostHeight * 0.18, 1, -ghostWidth * 0.2, ghostHeight * 0.2, ghostWidth * 0.56);
    highlight.addColorStop(0, "#ffffffce"); highlight.addColorStop(1, "#ffffff00");
    ctx.fillStyle = highlight; ctx.beginPath(); ctx.ellipse(-ghostWidth * 0.2, ghostHeight * 0.27, ghostWidth * 0.31, ghostHeight * 0.35, -0.24, 0, Math.PI * 2); ctx.fill();

    for (const eyeX of [-ghostWidth * 0.17, ghostWidth * 0.17]) {
      const eye = ctx.createRadialGradient(eyeX - 2, ghostHeight * 0.3 - 2, 1, eyeX, ghostHeight * 0.3, ghostWidth * 0.12);
      eye.addColorStop(0, "#171425"); eye.addColorStop(0.72, "#302044"); eye.addColorStop(1, "#67456d");
      ctx.fillStyle = eye; ctx.beginPath(); ctx.ellipse(eyeX, ghostHeight * 0.3, ghostWidth * 0.105, ghostHeight * 0.085, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffffffed"; ctx.beginPath(); ctx.arc(eyeX - ghostWidth * 0.025, ghostHeight * 0.27, ghostWidth * 0.025, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = "#805b93"; ctx.lineWidth = Math.max(1.4, eyeDistance * 0.02); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-ghostWidth * 0.07, ghostHeight * 0.43); ctx.quadraticCurveTo(0, ghostHeight * 0.49, ghostWidth * 0.07, ghostHeight * 0.43); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arCanvasRef = useRef<HTMLCanvasElement>(null);
  const arRendererRef = useRef<TrackedArRenderer | null>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const videoLandmarkerRef = useRef<FaceLandmarkerType | null>(null);
  const imageLandmarkerRef = useRef<FaceLandmarkerType | null>(null);
  const videoLandmarkerPromiseRef = useRef<Promise<FaceLandmarkerType> | null>(null);
  const videoFaceCpuFallbackRef = useRef(false);
  const imageLandmarkerPromiseRef = useRef<Promise<FaceLandmarkerType> | null>(null);
  const videoPoseLandmarkerRef = useRef<PoseLandmarkerType | null>(null);
  const imagePoseLandmarkerRef = useRef<PoseLandmarkerType | null>(null);
  const videoPosePromiseRef = useRef<Promise<PoseLandmarkerType> | null>(null);
  const videoPoseCpuFallbackRef = useRef(false);
  const imagePosePromiseRef = useRef<Promise<PoseLandmarkerType> | null>(null);
  const landmarksRef = useRef<Landmark[][]>([]);
  const faceOpennessRef = useRef<number[]>([]);
  const faceTexturesRef = useRef<Record<string, FaceTexture>>({});
  const dogImagesRef = useRef<Partial<Record<keyof typeof dogImageSources, HTMLImageElement>>>({});
  const grinIrisRef = useRef<HTMLImageElement | null>(null);
  const grinFrameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dogTongueStatesRef = useRef<Array<{ isOpen: boolean; openedAt: number }>>([]);
  const dogEarPhysicsRef = useRef<DogEarPhysics[]>([]);
  const sceneImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const costumeTexturesRef = useRef<Record<string, HTMLImageElement>>({});
  const posesRef = useRef<Landmark[][]>([]);
  const poseMaskCanvasRef = useRef<HTMLCanvasElement>(null);
  const poseMaskOutputCanvasRef = useRef<HTMLCanvasElement>(null);
  const poseMaskReadyRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);
  const lastDetectionRef = useRef(0);
  const lastPoseDetectionRef = useRef(0);
  const lastCanvasPaintRef = useRef(0);
  const syncQueueRef = useRef<() => void>(() => {});
  const beginCountdownRef = useRef<() => void>(() => {});
  const currentQueueIdRef = useRef("");
  const countdownIntervalRef = useRef<number | null>(null);
  const countdownValueRef = useRef<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<Filter | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [qrCountdown, setQrCountdown] = useState<number | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [reviewingPhoto, setReviewingPhoto] = useState(false);
  const [queuedPhotoCount, setQueuedPhotoCount] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [tracking, setTracking] = useState("Loading face tracking…");
  const [bodyEffectsReady, setBodyEffectsReady] = useState(false);
  const [effectCategory, setEffectCategory] = useState<"face" | "background">("face");
  const [activeBackground, setActiveBackground] = useState("none");
  const activeCostume = "none";
  const needsBodyTracking = activeBackground !== "none";
  const visibleOptions = effectCategory === "face" ? filters : backgrounds;
  const selectedOptionId = effectCategory === "face" ? activeFilter?.id ?? "none" : activeBackground;
  const activeIndex = visibleOptions.findIndex((option) => option.id === selectedOptionId);
  const selectedLens = visibleOptions.find((option) => option.id === selectedOptionId);

  async function ensureFaceTracker(mode: "IMAGE" | "VIDEO") {
    const detectorRef = mode === "VIDEO" ? videoLandmarkerRef : imageLandmarkerRef;
    const promiseRef = mode === "VIDEO" ? videoLandmarkerPromiseRef : imageLandmarkerPromiseRef;
    if (detectorRef.current) return detectorRef.current;
    if (promiseRef.current) return promiseRef.current;
    promiseRef.current = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      try {
        return await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate: "GPU" },
          runningMode: mode,
          numFaces: maxTrackedFaces,
          outputFaceBlendshapes: true,
        });
      } catch {
        return FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate: "CPU" },
          runningMode: mode,
          numFaces: maxTrackedFaces,
          outputFaceBlendshapes: true,
        });
      }
    })();
    try {
      const detector = await promiseRef.current;
      detectorRef.current = detector;
      setTracking("Face tracking ready");
      return detector;
    } finally {
      promiseRef.current = null;
    }
  }

  async function switchVideoFaceTrackerToCpu() {
    videoLandmarkerRef.current?.close();
    videoLandmarkerRef.current = null;
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    videoLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate: "CPU" },
      runningMode: "VIDEO",
      numFaces: maxTrackedFaces,
      outputFaceBlendshapes: true,
    });
    setTracking("Face tracking ready");
  }

  useEffect(() => {
    let cancelled = false;
    for (const [scene, source] of Object.entries(sceneImageSources)) {
      const image = new Image();
      image.onload = () => {
        if (!cancelled) sceneImagesRef.current[scene] = image;
      };
      image.src = source;
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    for (const [name, source] of Object.entries(dogImageSources) as [keyof typeof dogImageSources, string][]) {
      const image = new Image();
      image.onload = () => {
        if (!cancelled) dogImagesRef.current[name] = image;
      };
      image.src = source;
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const iris = new Image();
    iris.onload = () => {
      if (!cancelled) grinIrisRef.current = iris;
    };
    iris.src = "/filters/grin-red-iris.png";
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const canvas = arCanvasRef.current;
    if (!canvas) return;
    void import("@/lib/tracked-3d-lenses").then(({ createTrackedArRenderer }) => {
      if (cancelled) return;
      try {
        arRendererRef.current = createTrackedArRenderer(canvas);
      } catch {
        // Keep the 2D face effects available if the browser cannot create a WebGL context.
      }
    });
    return () => {
      cancelled = true;
      arRendererRef.current?.dispose();
      arRendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    for (const [texture, source] of Object.entries(costumeTextureSources)) {
      const image = new Image();
      image.onload = () => {
        if (!cancelled) costumeTexturesRef.current[texture] = image;
      };
      image.src = source;
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const detector = await ensureFaceTracker("IMAGE");
        const textureNames = [...new Set(filters.map((filter) => filter.texture))];
        const loaded = await Promise.all(textureNames.map(async (name) => {
          const source = faceTextureSources[name];
          if (!source) return null;
          const image = new Image();
          image.src = source;
          await image.decode();
          const result = detector.detect(image);
          const face = result.faceLandmarks[0] as Landmark[] | undefined;
          if (!face || face.length < 468) return null;
          return [name, { image, landmarks: face }] as const;
        }));
        if (cancelled) return;
        const textureMap: Record<string, FaceTexture> = {};
        for (const entry of loaded) if (entry) textureMap[entry[0]] = entry[1];
        faceTexturesRef.current = textureMap;
        setTracking(`Live mesh ready · ${Object.keys(faceTexturesRef.current).length} generated looks`);
      } catch {
        if (!cancelled) setTracking("Face texture loading · retrying");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function ensurePoseTracker(mode: "IMAGE" | "VIDEO") {
    const detectorRef = mode === "VIDEO" ? videoPoseLandmarkerRef : imagePoseLandmarkerRef;
    const promiseRef = mode === "VIDEO" ? videoPosePromiseRef : imagePosePromiseRef;
    if (detectorRef.current) return detectorRef.current;
    if (promiseRef.current) return promiseRef.current;
    promiseRef.current = (async () => {
      const { PoseLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      try {
        return await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "/models/pose_landmarker_lite.task", delegate: "GPU" },
          runningMode: mode,
          numPoses: maxTrackedPoses,
          outputSegmentationMasks: true,
        });
      } catch {
        return PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "/models/pose_landmarker_lite.task", delegate: "CPU" },
          runningMode: mode,
          numPoses: maxTrackedPoses,
          outputSegmentationMasks: true,
        });
      }
    })();
    try {
      const detector = await promiseRef.current;
      detectorRef.current = detector;
      return detector;
    } finally {
      promiseRef.current = null;
    }
  }

  async function switchVideoPoseTrackerToCpu() {
    videoPoseLandmarkerRef.current?.close();
    videoPoseLandmarkerRef.current = null;
    const { PoseLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    videoPoseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: "/models/pose_landmarker_lite.task", delegate: "CPU" },
      runningMode: "VIDEO",
      numPoses: maxTrackedPoses,
      outputSegmentationMasks: true,
    });
    setBodyEffectsReady(true);
  }

  function storePoseResult(result: ReturnType<PoseLandmarkerType["detectForVideo"]>, mirrored: boolean) {
    posesRef.current = result.landmarks as Landmark[][];
    const masks = result.segmentationMasks ?? [];
    const target = poseMaskCanvasRef.current;
    const output = poseMaskOutputCanvasRef.current;
    const first = masks[0];
    if (!target || !output || !first || masks.length === 0) {
      poseMaskReadyRef.current = false;
      setBodyEffectsReady(false);
      return;
    }
    const maskWidth = first.width;
    const maskHeight = first.height;
    if (target.width !== maskWidth || target.height !== maskHeight) {
      target.width = maskWidth;
      target.height = maskHeight;
    }
    const ctx = target.getContext("2d");
    if (!ctx) return;
    const imageData = ctx.createImageData(maskWidth, maskHeight);
    const maskArrays = masks.map((mask) => mask.hasFloat32Array() ? mask.getAsFloat32Array() : mask.getAsUint8Array());
    for (let y = 0; y < maskHeight; y++) {
      for (let x = 0; x < maskWidth; x++) {
        const sourceIndex = y * maskWidth + x;
        let confidence = 0;
        for (let maskIndex = 0; maskIndex < maskArrays.length; maskIndex++) {
          const array = maskArrays[maskIndex];
          const raw = array[sourceIndex] ?? 0;
          const value = array instanceof Uint8Array ? raw / 255 : raw;
          confidence = Math.max(confidence, value);
        }
        // Raise the cutout edge slightly to reject the low-confidence halo around hair
        // and shoulders while keeping a smooth transition at the person boundary.
        const edge = Math.max(0, Math.min(1, (confidence - 0.24) / 0.54));
        const alpha = Math.round(edge * edge * (3 - 2 * edge) * 255);
        const screenX = mirrored ? maskWidth - 1 - x : x;
        const index = (y * maskWidth + screenX) * 4;
        imageData.data[index] = 255;
        imageData.data[index + 1] = 255;
        imageData.data[index + 2] = 255;
        imageData.data[index + 3] = alpha;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    const outputScale = Math.min(4, 1600 / Math.max(maskWidth, maskHeight));
    const outputWidth = Math.max(maskWidth, Math.round(maskWidth * outputScale));
    const outputHeight = Math.max(maskHeight, Math.round(maskHeight * outputScale));
    if (output.width !== outputWidth || output.height !== outputHeight) {
      output.width = outputWidth;
      output.height = outputHeight;
    }
    const outputContext = output.getContext("2d");
    if (outputContext) {
      outputContext.clearRect(0, 0, outputWidth, outputHeight);
      outputContext.imageSmoothingEnabled = true;
      outputContext.imageSmoothingQuality = "high";
      outputContext.filter = "blur(1.1px)";
      outputContext.drawImage(target, 0, 0, outputWidth, outputHeight);
      outputContext.filter = "none";
    }
    for (const mask of masks) mask.close();
    poseMaskReadyRef.current = true;
    setBodyEffectsReady(true);
  }

  useEffect(() => () => {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    videoLandmarkerRef.current?.close();
    imageLandmarkerRef.current?.close();
    videoPoseLandmarkerRef.current?.close();
    imagePoseLandmarkerRef.current?.close();
    if (countdownIntervalRef.current !== null) window.clearInterval(countdownIntervalRef.current);
  }, []);

  useEffect(() => {
    if (!qrDataUrl || !shareUrl || !photoUrl) return;
    let remaining = 10;
    const timer = window.setInterval(() => {
      remaining -= 1;
      setQrCountdown(remaining);
      if (remaining <= 0) {
        window.clearInterval(timer);
        setQrCountdown(null);
        currentQueueIdRef.current = "";
        URL.revokeObjectURL(photoUrl);
        setPhotoUrl(null);
        setCapturedBlob(null);
        setQrDataUrl(null);
        setShareUrl(null);
        setMessage("");
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [qrDataUrl, shareUrl, photoUrl]);

  useEffect(() => {
    let animation = 0;
    let cancelled = false;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const paint = (sourceWidth: number, sourceHeight: number, mirrored: boolean, frameSource: CanvasImageSource | null) => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const width = bounds.width;
      const height = bounds.height;
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const now = performance.now() / 1000;
      let grinFrame: HTMLCanvasElement | null = null;
      if (activeFilter?.id === "clown" && frameSource && sourceWidth > 0 && sourceHeight > 0) {
        grinFrame = grinFrameCanvasRef.current ?? document.createElement("canvas");
        grinFrameCanvasRef.current = grinFrame;
        grinFrame.width = Math.max(1, Math.round(width));
        grinFrame.height = Math.max(1, Math.round(height));
        const frameCtx = grinFrame.getContext("2d");
        if (frameCtx) {
          const scale = Math.max(width / sourceWidth, height / sourceHeight);
          const cropWidth = width / scale;
          const cropHeight = height / scale;
          const cropX = (sourceWidth - cropWidth) / 2;
          const cropY = (sourceHeight - cropHeight) / 2;
          frameCtx.clearRect(0, 0, grinFrame.width, grinFrame.height);
          frameCtx.save();
          if (mirrored) {
            frameCtx.translate(grinFrame.width, 0);
            frameCtx.scale(-1, 1);
          }
          frameCtx.drawImage(frameSource, cropX, cropY, cropWidth, cropHeight, 0, 0, grinFrame.width, grinFrame.height);
          frameCtx.restore();
        }
      }
      const poseMask = poseMaskOutputCanvasRef.current;
      const sceneImage = sceneImagesRef.current[activeBackground];
      if (activeBackground !== "none" && sceneImage && poseMaskReadyRef.current && poseMask?.width && poseMask.height) {
        drawSceneImage(ctx, sceneImage, width, height);
        const scale = Math.max(width / sourceWidth, height / sourceHeight);
        const cropWidth = width / scale;
        const cropHeight = height / scale;
        const cropX = (sourceWidth - cropWidth) / 2;
        const cropY = (sourceHeight - cropHeight) / 2;
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(
          poseMask,
          (cropX / sourceWidth) * poseMask.width,
          (cropY / sourceHeight) * poseMask.height,
          (cropWidth / sourceWidth) * poseMask.width,
          (cropHeight / sourceHeight) * poseMask.height,
          0, 0, width, height,
        );
        ctx.restore();
      }
      if (activeCostume !== "none" && posesRef.current.length) {
        drawBodyCostume(ctx, activeCostume, posesRef.current, width, height, sourceWidth, sourceHeight, mirrored, costumeTexturesRef.current);
      }
      for (const [faceIndex, faceLandmarks] of landmarksRef.current.entries()) {
        if (!activeFilter) continue;
        if (activeFilter.id === "dog") {
          const lipTop = faceLandmarks[13];
          const lipBottom = faceLandmarks[14];
          const leftEye = faceLandmarks[33];
          const rightEye = faceLandmarks[263];
          const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
          const lipGap = eyeDistance > 0 ? Math.hypot((lipBottom.x - lipTop.x) * sourceWidth, (lipBottom.y - lipTop.y) * sourceHeight) / Math.hypot((rightEye.x - leftEye.x) * sourceWidth, (rightEye.y - leftEye.y) * sourceHeight) : 0;
          const openness = faceOpennessRef.current[faceIndex] ?? normalizeLipGap(lipGap);
          const tongueState = dogTongueStatesRef.current[faceIndex] ?? { isOpen: false, openedAt: 0 };
          dogTongueStatesRef.current[faceIndex] = tongueState;
          const wasOpen = tongueState.isOpen;
          tongueState.isOpen = shouldDogTongueBeOpen(openness, wasOpen);
          if (!wasOpen && tongueState.isOpen) tongueState.openedAt = now;
          const images = dogImagesRef.current;
          if (images.ears && images.muzzle) {
            const earPhysics = dogEarPhysicsRef.current[faceIndex] ?? { left: 0, right: 0, leftVelocity: 0, rightVelocity: 0, centerX: 0, centerY: 0, headAngle: 0, lastTime: 0 };
            dogEarPhysicsRef.current[faceIndex] = earPhysics;
            drawDogImageFilter(ctx, faceLandmarks, images as Record<keyof typeof dogImageSources, HTMLImageElement>, width, height, sourceWidth, sourceHeight, mirrored, earPhysics, now, tongueState.isOpen);
          }
          continue;
        }
        if (activeFilter.id === "clown") {
          if (grinFrame) drawGrinFilter(ctx, grinFrame, faceLandmarks, grinIrisRef.current, width, height, sourceWidth, sourceHeight, mirrored);
          continue;
        }
        const texture = faceTexturesRef.current[activeFilter.texture];
        if (texture) {
          drawFaceTexture(ctx, texture, faceLandmarks, width, height, sourceWidth, sourceHeight, mirrored, activeFilter);
          revealTrackedMouth(ctx, faceLandmarks, width, height, sourceWidth, sourceHeight, mirrored);
        }
        drawFaceEffect(ctx, activeFilter.id, faceLandmarks, width, height, sourceWidth, sourceHeight, mirrored, now, Boolean(texture));
      }
      arRendererRef.current?.update({
        faces: landmarksRef.current,
        width,
        height,
        sourceWidth,
        sourceHeight,
        mirrored,
        lensId: activeFilter?.id ?? "none",
        tongueOpen: dogTongueStatesRef.current.slice(0, landmarksRef.current.length).map((state) => state.isOpen),
      });
      // Drop states for faces that disappeared so a new face at that index
      // cannot inherit the previous person's open-mouth tongue state.
      dogTongueStatesRef.current.length = landmarksRef.current.length;
    };

    if (!cameraOn || !video) {
      landmarksRef.current = [];
      posesRef.current = [];
      poseMaskReadyRef.current = false;
      paint(1, 1, false, null);
      return;
    }

    if (needsBodyTracking) {
      void ensurePoseTracker("VIDEO").catch(() => setTracking("Body effects unavailable · try another browser"));
    } else {
      posesRef.current = [];
    }

    const touchCamera = window.matchMedia("(pointer: coarse)").matches;
    const faceDetectionInterval = touchCamera ? 70 : 40;
    const canvasPaintInterval = touchCamera ? 42 : 33;
    const render = () => {
      if (cancelled) return;
      if (video.videoWidth && video.videoHeight) {
        const now = performance.now();
        if (videoLandmarkerRef.current && video.currentTime !== lastVideoTimeRef.current && now - lastDetectionRef.current > faceDetectionInterval) {
          try {
            const result = detectFaceForVideo(videoLandmarkerRef.current, video, now);
            landmarksRef.current = result.faceLandmarks as Landmark[][];
            faceOpennessRef.current = (result.faceBlendshapes ?? []).map((shape) => shape.categories.find((category) => category.categoryName === "jawOpen")?.score ?? 0);
            setTracking(landmarksRef.current.length ? `${landmarksRef.current.length} ${landmarksRef.current.length === 1 ? "face" : "faces"} found · effects follow you` : "Move into the frame");
          } catch {
            landmarksRef.current = [];
            videoLandmarkerRef.current.close();
            videoLandmarkerRef.current = null;
            if (!videoFaceCpuFallbackRef.current) {
              videoFaceCpuFallbackRef.current = true;
              setTracking("Switching to compatible face tracking...");
              void switchVideoFaceTrackerToCpu().catch(() => setTracking("Face tracking unavailable on this device"));
            } else {
              setTracking("Face tracking unavailable on this device");
            }
            setTracking("Face tracking failed · restart the camera");
          }
          lastVideoTimeRef.current = video.currentTime;
          lastDetectionRef.current = now;
        }
        if (needsBodyTracking && videoPoseLandmarkerRef.current && video.currentTime !== lastPoseDetectionRef.current && now - lastPoseDetectionRef.current > 240) {
          try {
            const result = videoPoseLandmarkerRef.current.detectForVideo(video, now);
            storePoseResult(result, facing === "user");
          } catch {
            posesRef.current = [];
            setBodyEffectsReady(false);
            if (!videoPoseCpuFallbackRef.current) {
              videoPoseCpuFallbackRef.current = true;
              void switchVideoPoseTrackerToCpu().catch(() => setTracking("Background tracking unavailable on this device"));
            }
          }
          lastPoseDetectionRef.current = video.currentTime;
        }
        if (now - lastCanvasPaintRef.current >= canvasPaintInterval) {
          paint(video.videoWidth, video.videoHeight, facing === "user", video);
          lastCanvasPaintRef.current = now;
        }
      }
      animation = requestAnimationFrame(render);
    };
    animation = requestAnimationFrame(render);
    return () => { cancelled = true; cancelAnimationFrame(animation); };
  }, [activeBackground, activeCostume, activeFilter, cameraOn, facing, needsBodyTracking]);

  async function startCamera(nextFacing = facing) {
    const requestId = ++cameraRequestRef.current;
    setMessage("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("Camera access needs a secure browser connection. Try uploading a photo instead.");
      return;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    try {
      const mobileCamera = window.matchMedia("(pointer: coarse)").matches;
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: nextFacing },
            width: { ideal: mobileCamera ? 720 : 1280 },
            height: { ideal: mobileCamera ? 1280 : 1600 },
            frameRate: { ideal: 30, max: 30 },
          },
        });
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        if (!["OverconstrainedError", "TypeError"].includes(name)) throw error;
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: nextFacing } } });
      }
      if (requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      setCameraOn(true);
      videoFaceCpuFallbackRef.current = false;
      videoPoseCpuFallbackRef.current = false;
      setPhotoUrl(null);
      setCapturedBlob(null);
      setReviewingPhoto(false);
      setQrDataUrl(null);
      setShareUrl(null);
      setMessage("");
      landmarksRef.current = [];
      posesRef.current = [];
      poseMaskReadyRef.current = false;
      setBodyEffectsReady(false);
      lastVideoTimeRef.current = -1;
      lastPoseDetectionRef.current = 0;
      lastCanvasPaintRef.current = 0;
      setTracking("Loading face tracking…");
      void ensureFaceTracker("VIDEO").catch(() => setTracking("Face tracking unavailable"));
    } catch {
      if (requestId === cameraRequestRef.current) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setMessage("We couldn’t open your camera. Check your browser permissions and allow camera access.");
      }
    }
  }

  const cameraStartRef = useRef<(nextFacing?: "user" | "environment") => Promise<void>>(startCamera);

  useEffect(() => {
    void cameraStartRef.current("user");
  }, []);

  useEffect(() => {
    void getQueuedPhotos().then((photos) => setQueuedPhotoCount(photos.length)).catch(() => {});
    const onOnline = () => syncQueueRef.current();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  useEffect(() => {
    syncQueueRef.current = () => { void syncQueuedPhotos(); };
  });
  useEffect(() => { syncQueueRef.current(); }, []);

  function stopCamera() {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  function toggleCamera() {
    const nextFacing = facing === "user" ? "environment" : "user";
    setFacing(nextFacing);
    if (cameraOn) void startCamera(nextFacing);
  }

  async function syncQueuedPhotos() {
    try {
      const queued = await getQueuedPhotos();
      setQueuedPhotoCount(queued.length);
      if (!navigator.onLine || queued.length === 0) return;
      for (const item of queued) {
        const form = new FormData();
        form.append("photo", item.blob, `afterglow-${item.filterId}.png`);
        form.append("photoId", item.id);
        let result: { error?: string; qrDataUrl?: string; shareUrl?: string };
        try {
          const response = await fetch("/api/photos", { method: "POST", body: form });
          result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Upload failed.");
        } catch {
          if (currentQueueIdRef.current === item.id) setMessage("Photo saved on this booth. It will retry when the connection returns.");
          break;
        }
        await removeQueuedPhoto(item.id);
        if (currentQueueIdRef.current === item.id) {
          setQrDataUrl(result.qrDataUrl ?? null);
          setShareUrl(result.shareUrl ?? null);
          if (result.qrDataUrl && result.shareUrl) setQrCountdown(10);
          setMessage("Photo synced. Scan the QR code to open it on another device.");
        }
      }
      const remaining = await getQueuedPhotos();
      setQueuedPhotoCount(remaining.length);
    } catch {
      setMessage("The local photo queue is unavailable in this browser.");
    }
  }

  async function keepPhoto() {
    if (!capturedBlob) return;
    const id = crypto.randomUUID();
    currentQueueIdRef.current = id;
    setSavingPhoto(true);
    setReviewingPhoto(false);
    setQrDataUrl(null);
    setShareUrl(null);
    try {
      await saveQueuedPhoto({ id, filterId: activeFilter?.id ?? activeBackground ?? "none", createdAt: Date.now(), blob: capturedBlob });
      setCapturedBlob(null);
      setMessage(navigator.onLine ? "Photo saved on this booth. Uploading and creating its QR code…" : "Photo saved on this booth. It will sync when the connection returns.");
      await syncQueuedPhotos();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this photo on the booth.");
    } finally {
      setSavingPhoto(false);
    }
  }

  function retakePhoto() {
    currentQueueIdRef.current = "";
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    setCapturedBlob(null);
    setReviewingPhoto(false);
    setQrDataUrl(null);
    setShareUrl(null);
    setMessage("");
  }

  function capture() {
    const canvas = photoCanvasRef.current;
    const overlay = canvasRef.current;
    const arOverlay = arCanvasRef.current;
    const video = videoRef.current;
    const draw = (image: CanvasImageSource, sourceWidth: number, sourceHeight: number) => {
      if (!canvas) return;
      const frame = canvas.closest(".camera-frame");
      const frameBounds = frame?.getBoundingClientRect();
      const frameAspect = frameBounds && frameBounds.height > 0 ? frameBounds.width / frameBounds.height : 0.82;
      let cropX = 0;
      let cropY = 0;
      let cropWidth = sourceWidth;
      let cropHeight = sourceHeight;
      if (sourceWidth / sourceHeight > frameAspect) {
        cropWidth = sourceHeight * frameAspect;
        cropX = (sourceWidth - cropWidth) / 2;
      } else {
        cropHeight = sourceWidth / frameAspect;
        cropY = (sourceHeight - cropHeight) / 2;
      }
      const width = Math.round(cropWidth);
      const height = Math.round(cropHeight);
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.save();
      const mirrorCapture = facing === "user";
      if (mirrorCapture) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);
      ctx.restore();
      if (overlay) ctx.drawImage(overlay, 0, 0, width, height);
      if (arOverlay) ctx.drawImage(arOverlay, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) return;
        currentQueueIdRef.current = "";
        if (photoUrl) URL.revokeObjectURL(photoUrl);
        const localPhotoUrl = URL.createObjectURL(blob);
        setPhotoUrl(localPhotoUrl);
        setCapturedBlob(blob);
        setReviewingPhoto(true);
        setQrDataUrl(null);
        setShareUrl(null);
        setMessage("Review this shot. Keep it to upload and make a share QR, or retake it.");
      }, "image/png");
    };
    if (video?.videoWidth && video.videoHeight) {
      draw(video, video.videoWidth, video.videoHeight);
    } else {
      setMessage("Start your camera before taking a picture.");
    }
  }

  function beginCountdown() {
    if (reviewingPhoto) return;
    if (countdownValueRef.current !== null) return;
    if (!cameraOn) {
      void startCamera();
      return;
    }
    countdownValueRef.current = 3;
    setCountdown(3);
    countdownIntervalRef.current = window.setInterval(() => {
      const current = countdownValueRef.current;
      if (current === null) return;
      if (current <= 1) {
        if (countdownIntervalRef.current !== null) window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        countdownValueRef.current = null;
        setCountdown(null);
        capture();
        return;
      }
      countdownValueRef.current = current - 1;
      setCountdown(current - 1);
    }, 1000);
  }
  useEffect(() => {
    beginCountdownRef.current = beginCountdown;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || !cameraOn) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      beginCountdownRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cameraOn]);

  function selectLens(option: Filter) {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null); setQrDataUrl(null); setShareUrl(null); setMessage("");
    if (effectCategory === "face") {
      setActiveFilter(option);
      dogTongueStatesRef.current = [];
    } else {
      setActiveBackground(option.id);
    }
  }

  return (
    <main className="booth-shell">
      <section className="booth-layout" id="studio">
        <section className="camera-column" aria-label="Live camera booth">
          <div className="camera-heading">
            <span className="camera-live-label"><span className={cameraOn ? "rec-dot recording" : "rec-dot"} />{reviewingPhoto ? "PHOTO REVIEW" : cameraOn ? "LIVE PREVIEW" : "WAITING FOR CAMERA"}</span>
            <button className="flip-button" onClick={toggleCamera} aria-label="Switch camera" title="Switch camera">FLIP</button>
          </div>
          <div className="camera-frame">
            <video ref={videoRef} className={`camera-feed ${facing === "user" ? "mirrored" : ""} ${reviewingPhoto ? "inactive" : ""}`} autoPlay playsInline muted />
            {reviewingPhoto && photoUrl && <NextImage className="camera-feed captured-photo" src={photoUrl} width={820} height={1000} unoptimized alt="Review your captured photo" />}
            <canvas ref={canvasRef} className={`effect-canvas ${reviewingPhoto ? "inactive" : ""}`} aria-hidden="true" />
            <canvas ref={arCanvasRef} className={`ar-three-canvas ${reviewingPhoto ? "inactive" : ""}`} aria-hidden="true" />
            {!cameraOn && !reviewingPhoto && <div className="camera-placeholder"><span className="placeholder-ring" /><div><strong>CAMERA STANDBY</strong><span>Allow camera access in your browser to begin</span></div></div>}
            <div className="frame-shade" />
            {countdown !== null && <div className="countdown-overlay" aria-live="assertive" aria-label={`Photo in ${countdown}`}><span>{countdown}</span></div>}
          </div>

          {reviewingPhoto ? <div className="review-controls">
            <button className="secondary-button" onClick={retakePhoto}>RETAKE</button>
            <button className="primary-button" onClick={() => void keepPhoto()} disabled={savingPhoto}>{savingPhoto ? "SAVING…" : "KEEP & CREATE QR"}</button>
          </div> : <div className="camera-controls">
            <button className="shutter" onClick={beginCountdown} aria-label="Take a photo"><span className="shutter-inner" /></button>
            <button className="save-placeholder" onClick={cameraOn ? beginCountdown : () => void startCamera()}>{cameraOn ? "TAKE PHOTO" : "ENABLE CAMERA"}</button>
          </div>}
          {message && <p className="camera-message" role="status">{message}</p>}
          <div className="permission-note">{tracking}</div>
          <canvas ref={photoCanvasRef} className="hidden-canvas" />
          <canvas ref={poseMaskCanvasRef} className="hidden-canvas" />
          <canvas ref={poseMaskOutputCanvasRef} className="hidden-canvas" />

          {photoUrl && !reviewingPhoto && !(qrDataUrl && shareUrl) && <section className="share-card" aria-live="polite">
            <div className="share-card-heading"><div><div className="eyebrow">YOUR PHOTO</div><h2>{savingPhoto ? "Syncing" : qrDataUrl ? "Ready to share" : "Saved on this booth"}</h2></div><span className="share-count">{savingPhoto ? "SYNCING" : qrDataUrl ? "QR READY" : queuedPhotoCount ? "QUEUED" : "LOCAL"}</span></div>
            <div className="share-preview"><NextImage src={photoUrl} width={820} height={1000} unoptimized alt="Captured Halloween photo" />{qrDataUrl && shareUrl ? <a className="qr-link" href={shareUrl} target="_blank" rel="noreferrer"><NextImage className="qr-image" src={qrDataUrl} width={560} height={560} unoptimized alt="QR code to open the photo" /></a> : <div className="qr-pending">{queuedPhotoCount ? "QR will appear after sync" : "Confirm the photo to make a QR"}</div>}</div>
            {shareUrl && <a className="share-url" href={shareUrl} target="_blank" rel="noreferrer">OPEN SHARE PAGE ↗</a>}
            <a className="share-download" href={photoUrl} download={`afterglow-${activeFilter?.id ?? "photo"}.png`}>DOWNLOAD PHOTO ↓</a>
          </section>}
        </section>

        <aside className="filter-panel">
          <div className="filter-panel-heading"><div><div className="eyebrow">THE COLLECTION</div><h2>{selectedLens?.name ?? "No filter"}</h2></div><span className="filter-count">{activeIndex >= 0 ? String(activeIndex + 1).padStart(2, "0") : "—"}<br /><i>OF {visibleOptions.length}</i></span></div>
          <div className="lens-description"><span className="lens-pulse" /><p><strong>{effectCategory === "face" ? activeFilter ? activeFilter.style === "makeup" ? "REALISTIC MAKEUP" : "FULL-FACE TRANSFORMATION" : "NO FACE FILTER SELECTED" : "TRACKED SCENE"}</strong><br />{selectedLens?.mood ?? "The camera is clear until you choose a look."}</p></div>
          <div className="effect-tabs lens-tabs lens-tabs-two" role="tablist" aria-label="Filter category">
            <button role="tab" aria-selected={effectCategory === "face"} className={effectCategory === "face" ? "active" : ""} onClick={() => setEffectCategory("face")}>FACE LOOKS</button>
            <button role="tab" aria-selected={effectCategory === "background"} className={effectCategory === "background" ? "active" : ""} onClick={() => setEffectCategory("background")}>SCENES</button>
          </div>
          {needsBodyTracking && !bodyEffectsReady && <p className="body-status" role="status">Preparing body tracking. Keep your shoulders and upper body in view.</p>}
          <div className={`filter-list ${effectCategory === "background" ? "scene-list" : ""}`} role="radiogroup" aria-label={effectCategory === "face" ? "Face filters" : "Background scenes"}>
            {visibleOptions.map((option) => {
              const isScene = effectCategory === "background";
              return <button key={option.id} className={`filter-card ${isScene ? "filter-card-scene" : ""} ${selectedOptionId === option.id ? "selected" : ""}`} onClick={() => selectLens(option)} role="radio" aria-checked={selectedOptionId === option.id} title={`${option.name} — ${option.mood}`}>
                <span className={`filter-swatch ${isScene ? "scene-card-visual" : ""} swatch-${option.id}`}>
                  {(option.preview || option.texture) && <NextImage src={option.preview ?? faceTextureSources[option.texture]} fill sizes={isScene ? "(max-width: 560px) 45vw, 260px" : "96px"} alt="" loading="lazy" />}
                  {!isScene && <span>{option.symbol}</span>}
                  {selectedOptionId === option.id && <i aria-hidden="true" />}
                </span>
                <span className="filter-name-wrap"><strong>{option.name}</strong><small>{isScene ? option.mood : option.style.toUpperCase()}</small></span>
                <span className="filter-arrow" aria-hidden="true">↗</span>
              </button>;
            })}
          </div>
          <div className="filter-tip"><span className="tip-mark">AR</span><p><strong>Move naturally</strong><br />3D pieces follow your face position, size, tilt, and turn. Tracking runs on this device.</p></div>
        </aside>
      </section>

      {qrCountdown !== null && qrDataUrl && shareUrl && photoUrl && <section className="qr-takeover" role="dialog" aria-modal="true" aria-labelledby="qr-takeover-title">
        <div className="qr-takeover-card">
          <div className="qr-takeover-heading"><p className="eyebrow">YOUR PHOTO IS READY</p><span>RETURNING IN {qrCountdown}s</span></div>
          <h1 id="qr-takeover-title">Scan to get your photo</h1>
          <div className="qr-takeover-content">
            <NextImage className="qr-takeover-photo" src={photoUrl} width={820} height={1000} unoptimized alt="Your captured Halloween photo" />
            <a className="qr-takeover-link" href={shareUrl} target="_blank" rel="noreferrer" aria-label="Open your shared photo page">
              <NextImage className="qr-takeover-code" src={qrDataUrl} width={560} height={560} unoptimized alt="Scan this QR code to open your photo" />
              <span>SCAN WITH YOUR PHONE</span>
            </a>
          </div>
          <p className="qr-takeover-note">Your photo page lets you download the image and optionally sign up for email updates.</p>
          <div className="qr-takeover-progress" aria-hidden="true"><span style={{ animationDuration: "10s" }} /></div>
        </div>
      </section>}

    </main>
  );
}
