import * as THREE from "three";

export type FaceLandmark = { x: number; y: number; z?: number };
export type FaceTriangle = [number, number, number];
export type VoodooPatch = { mesh: THREE.Mesh; resolution: number };

const voodooPatchResolution = 12;

export function addVoodooImagePatch(parent: THREE.Group, texture: THREE.Texture, resolution = voodooPatchResolution, flipX = false) {
  const positions = new Float32Array((resolution + 1) ** 2 * 3);
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= resolution; row += 1) {
    for (let column = 0; column <= resolution; column += 1) {
      uvs.push(flipX ? 1 - column / resolution : column / resolution, 1 - row / resolution);
      if (row < resolution && column < resolution) {
        const a = row * (resolution + 1) + column;
        const b = a + resolution + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.015, side: THREE.DoubleSide, depthTest: false, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 9;
  parent.add(mesh);
  const patch: VoodooPatch = { mesh, resolution };
  parent.userData.voodooPatches ??= [];
  (parent.userData.voodooPatches as VoodooPatch[]).push(patch);
  return patch;
}

export function updateVoodooSurfacePatch(patch: VoodooPatch, centerX: number, centerY: number, patchWidth: number, patchHeight: number, axisX: THREE.Vector2, axisY: THREE.Vector2, projectedLandmarks: THREE.Vector3[], faceTriangles: FaceTriangle[], depthOffset: number) {
  const { mesh, resolution } = patch;
  const positions = mesh.geometry.attributes.position as THREE.BufferAttribute;
  for (let row = 0; row <= resolution; row += 1) {
    for (let column = 0; column <= resolution; column += 1) {
      const u = column / resolution;
      const v = row / resolution;
      const x = centerX + axisX.x * (u - 0.5) * patchWidth + axisY.x * (v - 0.5) * patchHeight;
      const y = centerY + axisX.y * (u - 0.5) * patchWidth + axisY.y * (v - 0.5) * patchHeight;
      const index = row * (resolution + 1) + column;
      positions.setXYZ(index, x, y, faceSurfaceDepth(x, y, projectedLandmarks, faceTriangles) + depthOffset);
    }
  }
  positions.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingSphere();
  mesh.visible = true;
}

export function faceSurfaceDepth(x: number, y: number, points: THREE.Vector3[], triangles: FaceTriangle[]) {
  for (const [aIndex, bIndex, cIndex] of triangles) {
    const a = points[aIndex];
    const b = points[bIndex];
    const c = points[cIndex];
    if (!a || !b || !c) continue;
    const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(denominator) < 1e-5) continue;
    const alpha = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / denominator;
    const beta = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / denominator;
    const gamma = 1 - alpha - beta;
    if (alpha >= -0.001 && beta >= -0.001 && gamma >= -0.001) return alpha * a.z + beta * b.z + gamma * c.z;
  }
  let nearest = points[0];
  let distance = Infinity;
  for (const point of points) {
    const candidate = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (candidate < distance) { distance = candidate; nearest = point; }
  }
  return nearest?.z ?? 0;
}

export function triangulateFace(connections: Array<{ start: number; end: number }>): FaceTriangle[] {
  const neighbors = new Map<number, Set<number>>();
  for (const { start, end } of connections) {
    if (!neighbors.has(start)) neighbors.set(start, new Set());
    if (!neighbors.has(end)) neighbors.set(end, new Set());
    neighbors.get(start)?.add(end);
    neighbors.get(end)?.add(start);
  }
  const triangles: FaceTriangle[] = [];
  for (const [center, adjacent] of neighbors) {
    const points = [...adjacent].filter((index) => index > center).sort((a, b) => a - b);
    for (let first = 0; first < points.length; first += 1) {
      for (let second = first + 1; second < points.length; second += 1) {
        const a = points[first];
        const b = points[second];
        if (neighbors.get(a)?.has(b)) triangles.push([center, a, b]);
      }
    }
  }
  return triangles;
}

export function cubicPoint3(start: THREE.Vector3, first: THREE.Vector3, second: THREE.Vector3, end: THREE.Vector3, t: number) {
  const inverse = 1 - t;
  return start.clone().multiplyScalar(inverse ** 3)
    .addScaledVector(first, 3 * inverse ** 2 * t)
    .addScaledVector(second, 3 * inverse * t ** 2)
    .addScaledVector(end, t ** 3);
}

