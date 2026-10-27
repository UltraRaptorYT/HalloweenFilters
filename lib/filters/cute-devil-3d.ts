import * as THREE from "three";
import { addVoodooImagePatch, updateVoodooSurfacePatch, type FaceLandmark, type FaceTriangle, type VoodooPatch } from "./tracked-3d-shared";

export type CuteDevilTextureAssets = { horns: THREE.Texture };

export function addCuteDevilHorns(parent: THREE.Group, texture: THREE.Texture) {
  const horns = addVoodooImagePatch(parent, texture, 20);
  parent.userData.cuteDevilHorns = horns;
  return horns;
}

export function updateCuteDevilHorns(parent: THREE.Group, face: FaceLandmark[], width: number, height: number, sourceWidth: number, sourceHeight: number, mirrored: boolean, faceTriangles: FaceTriangle[]) {
  const patch = parent.userData.cuteDevilHorns as VoodooPatch | undefined;
  if (!patch || face.length < 468) return;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const offsetX = (sourceWidth * scale - width) / 2;
  const offsetY = (sourceHeight * scale - height) / 2;
  const project = (landmark: FaceLandmark) => {
    const rawX = landmark.x * sourceWidth * scale - offsetX;
    const x = mirrored ? width - rawX : rawX;
    const y = landmark.y * sourceHeight * scale - offsetY;
    return new THREE.Vector3(x - width / 2, height / 2 - y, -(landmark.z ?? 0) * sourceWidth * scale);
  };
  const eyes = [project(face[33]), project(face[263])].sort((a, b) => a.x - b.x);
  const eyeCenter = eyes[0].clone().add(eyes[1]).multiplyScalar(0.5);
  const eyeDistance = Math.hypot(eyes[1].x - eyes[0].x, eyes[1].y - eyes[0].y);
  if (!Number.isFinite(eyeDistance) || eyeDistance < 8) return;
  const axisX = new THREE.Vector2(eyes[1].x - eyes[0].x, eyes[1].y - eyes[0].y).normalize();
  const forehead = project(face[10]);
  const axisY = new THREE.Vector2(forehead.x - eyeCenter.x, forehead.y - eyeCenter.y);
  axisY.sub(axisX.clone().multiplyScalar(axisY.dot(axisX))).normalize().negate();
  const centerX = forehead.x - axisY.x * eyeDistance * 0.12;
  const centerY = forehead.y - axisY.y * eyeDistance * 0.12;
  const projectedLandmarks = face.map(project);
  updateVoodooSurfacePatch(patch, centerX, centerY, eyeDistance * 1.5, eyeDistance * 0.75, axisX, axisY, projectedLandmarks, faceTriangles, eyeDistance * 0.035);
}

