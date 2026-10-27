import * as THREE from "three";
import { addVoodooImagePatch, cubicPoint3, faceSurfaceDepth, updateVoodooSurfacePatch, type FaceLandmark, type FaceTriangle, type VoodooPatch } from "./tracked-3d-shared";

export type VoodooTextureAssets = { nose: THREE.Texture; mouthLine: THREE.Texture };
const voodooLineSegments = 48;

export function addVoodooFaceImages(parent: THREE.Group, textures: VoodooTextureAssets) {
  const nose = addVoodooImagePatch(parent, textures.nose);
  parent.userData.voodooFaceImagePatches = { nose };
}

export function updateVoodooFaceImages(parent: THREE.Group, face: FaceLandmark[], width: number, height: number, sourceWidth: number, sourceHeight: number, mirrored: boolean, faceTriangles: FaceTriangle[]) {
  const patches = parent.userData.voodooFaceImagePatches as { nose: VoodooPatch } | undefined;
  if (!patches || face.length < 468) return;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const offsetX = (sourceWidth * scale - width) / 2;
  const offsetY = (sourceHeight * scale - height) / 2;
  const project = (landmark: FaceLandmark) => {
    const rawX = landmark.x * sourceWidth * scale - offsetX;
    const x = mirrored ? width - rawX : rawX;
    const y = landmark.y * sourceHeight * scale - offsetY;
    return new THREE.Vector3(x - width / 2, height / 2 - y, -(landmark.z ?? 0) * sourceWidth * scale);
  };
  const projectedLandmarks = face.map(project);
  const leftEye = project(face[33]);
  const rightEye = project(face[263]);
  const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  const noseSides = [project(face[98] ?? face[1]), project(face[327] ?? face[1])].sort((a, b) => a.x - b.x);
  const noseLeft = noseSides[0];
  const noseRight = noseSides[1];
  const noseBridge = project(face[168] ?? face[1]);
  const noseBase = project(face[2] ?? face[1]);
  const measuredNoseWidth = Math.hypot(noseRight.x - noseLeft.x, noseRight.y - noseLeft.y);
  const measuredNoseHeight = Math.hypot(noseBridge.x - noseBase.x, noseBridge.y - noseBase.y);
  const noseWidth = measuredNoseWidth > 4 ? measuredNoseWidth : eyeDistance * 0.36;
  const noseHeight = measuredNoseHeight > 4 ? measuredNoseHeight : noseWidth * (663 / 584);
  const noseCenterX = (noseLeft.x + noseRight.x + noseBridge.x + noseBase.x) / 4;
  const noseCenterY = (noseLeft.y + noseRight.y + noseBridge.y + noseBase.y) / 4;
  const noseAxisX = new THREE.Vector2(noseRight.x - noseLeft.x, noseRight.y - noseLeft.y).normalize();
  const noseAxisY = new THREE.Vector2(noseBase.x - noseBridge.x, noseBase.y - noseBridge.y);
  noseAxisY.sub(noseAxisX.clone().multiplyScalar(noseAxisY.dot(noseAxisX))).normalize();
  updateVoodooSurfacePatch(patches.nose, noseCenterX, noseCenterY, noseWidth, noseHeight, noseAxisX, noseAxisY, projectedLandmarks, faceTriangles, eyeDistance * 0.012);
}

export function addVoodooMouthLines(parent: THREE.Group, texture: THREE.Texture) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.02,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const lines = Array.from({ length: 2 }, () => {
    const positions = new Float32Array((voodooLineSegments + 1) * 2 * 3);
    const uvs = new Float32Array((voodooLineSegments + 1) * 2 * 2);
    const indices: number[] = [];
    for (let row = 0; row <= voodooLineSegments; row += 1) {
      const u = row / voodooLineSegments;
      const vertex = row * 2;
      uvs.set([u, 0, u, 1], row * 4);
      if (row < voodooLineSegments) indices.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;
    parent.add(mesh);
    return mesh;
  });
  parent.userData.voodooMouthLines = lines;
}

export function updateVoodooMouthLines(
  parent: THREE.Group,
  face: FaceLandmark[],
  width: number,
  height: number,
  sourceWidth: number,
  sourceHeight: number,
  mirrored: boolean,
) {
  const lines = parent.userData.voodooMouthLines as THREE.Mesh[] | undefined;
  if (!lines || face.length < 468) return;

  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const offsetX = (sourceWidth * scale - width) / 2;
  const offsetY = (sourceHeight * scale - height) / 2;
  const toWorld = (landmark: FaceLandmark) => {
    const sourceX = landmark.x * sourceWidth * scale - offsetX;
    const screenX = mirrored ? width - sourceX : sourceX;
    const screenY = landmark.y * sourceHeight * scale - offsetY;
    return new THREE.Vector3(screenX - width / 2, height / 2 - screenY, -(landmark.z ?? 0) * sourceWidth * scale);
  };
  const screenX = (landmark: FaceLandmark) => {
    const sourceX = landmark.x * sourceWidth * scale - offsetX;
    return mirrored ? width - sourceX : sourceX;
  };
  const leftEye = toWorld(face[33]);
  const rightEye = toWorld(face[263]);
  const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  const mouthCorners = [face[61], face[291]].sort((a, b) => screenX(a) - screenX(b));
  const faceSides = [face[234], face[454]].sort((a, b) => screenX(a) - screenX(b));
  const mouthLeft = toWorld(mouthCorners[0]);
  const mouthRight = toWorld(mouthCorners[1]);
  const mouthWidth = Math.hypot(mouthRight.x - mouthLeft.x, mouthRight.y - mouthLeft.y);
  const faceUp = toWorld(face[10]).sub(toWorld(face[152])).normalize();

  if (!Number.isFinite(eyeDistance) || eyeDistance < 8 || mouthWidth < 4) {
    lines.forEach((line) => { line.visible = false; });
    return;
  }

  for (const [index, line] of lines.entries()) {
    const corner = toWorld(mouthCorners[index]);
    const cheekEdge = toWorld(faceSides[index]);
    const edgeVector = cheekEdge.clone().sub(corner);
    const projectedEdgeDistance = Math.hypot(edgeVector.x, edgeVector.y);
    const span = Math.min(mouthWidth * 0.16, Math.max(mouthWidth * 0.08, projectedEdgeDistance * 0.08));
    const end = corner.clone().addScaledVector(edgeVector, span / Math.max(projectedEdgeDistance, 1))
      .addScaledVector(faceUp, eyeDistance * 0.045);
    const first = corner.clone().addScaledVector(edgeVector, span * 0.32 / Math.max(projectedEdgeDistance, 1)).addScaledVector(faceUp, eyeDistance * 0.015);
    const second = corner.clone().addScaledVector(edgeVector, span * 0.72 / Math.max(projectedEdgeDistance, 1)).addScaledVector(faceUp, eyeDistance * 0.038);
    const positions = line.geometry.attributes.position as THREE.BufferAttribute;

    for (let row = 0; row <= voodooLineSegments; row += 1) {
      const t = row / voodooLineSegments;
      const center = cubicPoint3(corner, first, second, end, t);
      const before = cubicPoint3(corner, first, second, end, Math.max(0, t - 0.01));
      const after = cubicPoint3(corner, first, second, end, Math.min(1, t + 0.01));
      const tangent = after.sub(before).normalize();
      const across = faceUp.clone().addScaledVector(tangent, -faceUp.dot(tangent)).normalize();
      if (across.lengthSq() < 0.001) across.set(0, 1, 0);
      const halfWidth = eyeDistance * 0.525;
      const offset = across.multiplyScalar(halfWidth);
      const vertex = row * 2;
      positions.setXYZ(vertex, center.x + offset.x, center.y + offset.y, center.z + offset.z + eyeDistance * 0.004);
      positions.setXYZ(vertex + 1, center.x - offset.x, center.y - offset.y, center.z - offset.z + eyeDistance * 0.004);
    }
    positions.needsUpdate = true;
    line.geometry.computeVertexNormals();
    line.geometry.computeBoundingSphere();
    line.visible = true;
  }
}

