import * as THREE from "three";
import type { FaceLandmark } from "./tracked-3d-shared";

export function addDogTongue(parent: THREE.Group) {
  const tongue = new THREE.Group();
  const rows = 36;
  const around = 24;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const groups: Array<{ start: number; count: number; materialIndex: number }> = [];
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    const bodyWidth = 0.1 + 0.95 * Math.sin((Math.PI / 2) * Math.pow(v, 0.72)) ** 0.72;
    const roundedTip = v > 0.84 ? Math.sqrt(Math.max(0, (1 - v) / 0.16)) : 1;
    const width = Math.max(0.035, bodyWidth * roundedTip);
    const curve = 0.16 * Math.sin(v * Math.PI * 0.9);
    const depth = 0.04 + 1.55 * (v * v * (3 - 2 * v));
    const thickness = width * 0.43;
    for (let side = 0; side <= around; side++) {
      const angle = -Math.PI + (side / around) * Math.PI * 2;
      const frontU = THREE.MathUtils.clamp((angle + Math.PI / 2) / Math.PI, 0, 1);
      positions.push(
        curve + Math.sin(angle) * width * 0.5,
        -v * 3.7,
        depth + Math.cos(angle) * thickness,
      );
      uvs.push(frontU, 1 - v);
      if (row < rows && side < around) {
        const a = row * (around + 1) + side;
        const b = a + around + 1;
        const firstIndex = indices.length;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
        const theta = -Math.PI + ((side + 0.5) / around) * Math.PI * 2;
        const materialIndex = Math.cos(theta) > 0 ? 0 : 1;
        const previous = groups[groups.length - 1];
        if (previous && previous.materialIndex === materialIndex && previous.start + previous.count === firstIndex) {
          previous.count += 6;
        } else {
          groups.push({ start: firstIndex, count: 6, materialIndex });
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  groups.forEach((group) => geometry.addGroup(group.start, group.count, group.materialIndex));
  geometry.computeVertexNormals();

  const texture = new THREE.TextureLoader().load("/filters/dog-lick.png");
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(0.27, 0.4);
  texture.offset.set(0.365, 0.01);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    roughness: 0.33,
    metalness: 0,
    transparent: true,
    alphaTest: 0.18,
  });
  const underside = new THREE.MeshStandardMaterial({ color: 0xc75d75, roughness: 0.4 });
  const mesh = new THREE.Mesh(geometry, [material, underside]);
  tongue.add(mesh);
  tongue.visible = false;
  tongue.scale.setScalar(0);
  parent.add(tongue);
  parent.userData.dogTongue = tongue;
  return tongue;
}

export function updateDogAccessory(parent: THREE.Group, face: FaceLandmark[], width: number, height: number, sourceWidth: number, sourceHeight: number, mirrored: boolean, tongueOpen: boolean) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const offsetX = (sourceWidth * scale - width) / 2;
  const offsetY = (sourceHeight * scale - height) / 2;
  const point = (landmark: FaceLandmark) => {
    const rawX = landmark.x * sourceWidth * scale - offsetX;
    return { x: mirrored ? width - rawX : rawX, y: landmark.y * sourceHeight * scale - offsetY };
  };
  const leftEye = point(face[33]);
  const rightEye = point(face[263]);
  const upperLip = point(face[13]);
  const lowerLip = point(face[14]);
  const nose = point(face[1]);
  const forehead = point(face[10]);
  const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  if (!Number.isFinite(eyeDistance) || eyeDistance < 8) return false;

  const centerX = (leftEye.x + rightEye.x) / 2;
  const centerY = (leftEye.y + rightEye.y) / 2;
  let screenAngle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  if (Math.abs(screenAngle) > Math.PI / 2) screenAngle += screenAngle > 0 ? -Math.PI : Math.PI;
  parent.visible = true;
  parent.position.set(centerX - width / 2, height / 2 - centerY, 0);
  parent.scale.setScalar(eyeDistance);
  const yaw = THREE.MathUtils.clamp((nose.x - centerX) / (eyeDistance * 0.42), -1, 1);
  const pitch = THREE.MathUtils.clamp((nose.y - forehead.y) / eyeDistance - 0.78, -0.7, 0.7);
  parent.rotation.set(pitch * 0.18, yaw * 0.62, -screenAngle);

  const tongue = parent.userData.dogTongue as THREE.Group | undefined;
  if (tongue) {
    const mouthX = (upperLip.x + lowerLip.x) / 2;
    const mouthY = (upperLip.y + lowerLip.y) / 2;
    const dx = mouthX - centerX;
    const dy = mouthY - centerY;
    const eyeDepth = ((face[33].z ?? 0) + (face[263].z ?? 0)) / 2;
    const mouthDepth = ((face[13].z ?? 0) + (face[14].z ?? 0)) / 2;
    const landmarkEyeDistance = Math.hypot(face[263].x - face[33].x, face[263].y - face[33].y);
    const depthInPixels = landmarkEyeDistance > 0 ? (eyeDepth - mouthDepth) * sourceWidth * scale : 0;
    const inverseFaceRotation = new THREE.Matrix4().makeRotationFromEuler(parent.rotation).invert();
    const localMouth = new THREE.Vector3(dx, -dy, depthInPixels)
      .applyMatrix4(inverseFaceRotation)
      .multiplyScalar(1 / eyeDistance);
    tongue.position.copy(localMouth);
    const target = tongueOpen ? 1 : 0;
    const extension = THREE.MathUtils.damp(tongue.scale.x, target, 9, 1 / 30);
    tongue.scale.setScalar(extension);
    tongue.visible = extension > 0.025;
  }
  return true;
}

