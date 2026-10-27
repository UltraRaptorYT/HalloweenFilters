import * as THREE from "three";
import type { FaceLandmark } from "./tracked-3d-shared";

const makeMaterial = (color: number, metalness = 0.12, roughness = 0.42) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
function addMesh(parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number]) { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); parent.add(mesh); return mesh; }

function makeWitchHatBrimGeometry() {
  const rings = 10;
  const around = 96;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rings; row += 1) {
    const radius = row / rings;
    for (let column = 0; column <= around; column += 1) {
      const theta = (column / around) * Math.PI * 2;
      const wave = Math.sin(theta * 3 + 0.5) * 0.055 + Math.sin(theta * 5) * 0.022;
      positions.push(
        Math.cos(theta) * radius * 1.58,
        Math.sin(theta) * radius * 0.3 + wave * radius * radius,
        Math.sin(theta) * radius * 0.13 + 0.018 * radius,
      );
      uvs.push(0.5 + Math.cos(theta) * radius * 0.5, 0.5 + Math.sin(theta) * radius * 0.5);
      if (row < rings && column < around) {
        const a = row * (around + 1) + column;
        const b = a + around + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeWitchHatCrownGeometry() {
  const rows = 28;
  const around = 64;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    const radius = 0.49 * Math.pow(1 - v, 0.9) + 0.012;
    const bendX = 0.34 * Math.sin(v * Math.PI * 0.72) + 0.12 * v;
    const bendZ = 0.12 * Math.sin(v * Math.PI * 0.6);
    for (let column = 0; column <= around; column += 1) {
      const u = column / around;
      const theta = u * Math.PI * 2;
      positions.push(
        bendX + Math.cos(theta) * radius,
        -1.48 * v,
        bendZ + Math.sin(theta) * radius * 0.72,
      );
      uvs.push(u, 1 - v);
      if (row < rows && column < around) {
        const a = row * (around + 1) + column;
        const b = a + around + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeWitchHatBandGeometry() {
  const rows = 2;
  const around = 64;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    const radius = 0.493 - v * 0.052;
    for (let column = 0; column <= around; column += 1) {
      const u = column / around;
      const theta = u * Math.PI * 2;
      positions.push(Math.cos(theta) * radius, 0.07 + v * 0.18, Math.sin(theta) * radius * 0.73);
      uvs.push(u, v);
      if (row < rows && column < around) {
        const a = row * (around + 1) + column;
        const b = a + around + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function addWitchHat(parent: THREE.Group, velvet: THREE.Texture) {
  const hatMaterial = new THREE.MeshStandardMaterial({
    map: velvet,
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const bandMaterial = new THREE.MeshStandardMaterial({ color: 0x8d2935, roughness: 0.58, metalness: 0.04, side: THREE.DoubleSide });
  addMesh(parent, makeWitchHatBrimGeometry(), hatMaterial, [0, 0, 0]);
  addMesh(parent, makeWitchHatCrownGeometry(), hatMaterial, [0, 0.04, 0]);
  addMesh(parent, makeWitchHatBandGeometry(), bandMaterial, [0, 0, 0.012]);
}

export function updateWitchHat(parent: THREE.Group, face: FaceLandmark[], width: number, height: number, sourceWidth: number, sourceHeight: number, mirrored: boolean) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const offsetX = (sourceWidth * scale - width) / 2;
  const offsetY = (sourceHeight * scale - height) / 2;
  const toWorld = (landmark: FaceLandmark) => {
    const rawX = landmark.x * sourceWidth * scale - offsetX;
    const x = mirrored ? width - rawX : rawX;
    const y = landmark.y * sourceHeight * scale - offsetY;
    return new THREE.Vector3(x - width / 2, height / 2 - y, -(landmark.z ?? 0) * sourceWidth * scale);
  };
  const eyeCorners = [toWorld(face[33]), toWorld(face[263])].sort((a, b) => a.x - b.x);
  const headAxisX = eyeCorners[1].clone().sub(eyeCorners[0]).normalize();
  const headWidth = eyeCorners[0].distanceTo(eyeCorners[1]);
  if (!Number.isFinite(headWidth) || headWidth < 8) return false;

  const forehead = toWorld(face[10]);
  const chin = toWorld(face[152]);
  const headUp = forehead.clone().sub(chin);
  headUp.addScaledVector(headAxisX, -headUp.dot(headAxisX)).normalize();
  const headDown = headUp.clone().negate();
  const headBack = headAxisX.clone().cross(headDown).normalize();
  const headForward = headAxisX.clone().cross(headUp).normalize();
  const headBasis = new THREE.Matrix4().makeBasis(headAxisX, headDown, headBack);
  const hatAnchor = forehead.clone()
    .addScaledVector(headUp, headWidth * 0.44)
    .addScaledVector(headForward, headWidth * 0.08);
  parent.visible = true;
  parent.position.copy(hatAnchor);
  parent.scale.setScalar(headWidth * 1.45);
  parent.quaternion.setFromRotationMatrix(headBasis);
  return true;
}

