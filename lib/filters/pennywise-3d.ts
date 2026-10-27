import * as THREE from "three";
import { faceSurfaceDepth, type FaceLandmark, type FaceTriangle } from "./tracked-3d-shared";

const pennywiseLineSegments = 52;
const pennywiseRibbonAcrossSegments = 6;
const pennywiseLineColor = 0x86121c;
const pennywiseLineOpacity = 0.76;
const pennywiseLineHalfWidth = 0.052;
type PennywiseStreak = { upper: { glow: THREE.Mesh; line: THREE.Mesh }; lower: { glow: THREE.Mesh; line: THREE.Mesh } };
type PennywiseLipPatch = { mesh: THREE.Mesh; landmarkIndices: number[]; material: THREE.ShaderMaterial };
type PennywiseMarkings = { streaks: PennywiseStreak[]; nose: THREE.Mesh; lips: PennywiseLipPatch[] };

function addPennywiseRibbon(parent: THREE.Group, color: number, opacity: number, renderOrder: number) {
  const acrossCount = pennywiseRibbonAcrossSegments + 1;
  const positions = new Float32Array((pennywiseLineSegments + 1) * acrossCount * 3);
  const colors = new Float32Array((pennywiseLineSegments + 1) * acrossCount * 4);
  const indices: number[] = [];
  for (let segment = 0; segment <= pennywiseLineSegments; segment += 1) {
    for (let across = 0; across <= pennywiseRibbonAcrossSegments; across += 1) {
      const vertex = segment * acrossCount + across;
      const t = across / pennywiseRibbonAcrossSegments;
      const alpha = opacity * Math.sin(Math.PI * t) ** 0.7;
      colors.set([1, 1, 1, alpha], vertex * 4);
      if (segment < pennywiseLineSegments && across < pennywiseRibbonAcrossSegments) {
        const nextRow = vertex + acrossCount;
        indices.push(vertex, nextRow, vertex + 1, vertex + 1, nextRow, nextRow + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  const material = new THREE.MeshBasicMaterial({ color, vertexColors: true, transparent: true, side: THREE.DoubleSide, depthTest: false, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  parent.add(mesh);
  return mesh;
}

function addPennywiseNose(parent: THREE.Group) {
  const rings = 10;
  const around = 48;
  const positions = new Float32Array((rings + 1) * around * 3);
  const colors = new Float32Array((rings + 1) * around * 4);
  const indices: number[] = [];
  const edge = new THREE.Color(0x85131c);
  const center = new THREE.Color(0xc83a32);
  for (let ring = 0; ring <= rings; ring += 1) {
    const radius = ring / rings;
    const color = edge.clone().lerp(center, 1 - radius * 0.55);
    for (let point = 0; point < around; point += 1) {
      const vertex = ring * around + point;
      const alpha = 0.68 * (1 - radius * radius) ** 1.35;
      colors.set([color.r, color.g, color.b, alpha], vertex * 4);
      if (ring < rings) {
        const next = ring * around + (point + 1) % around;
        const outer = (ring + 1) * around + point;
        const outerNext = (ring + 1) * around + (point + 1) % around;
        indices.push(vertex, outer, next, next, outer, outerNext);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.96, side: THREE.DoubleSide, depthTest: false, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  parent.add(mesh);
  return mesh;
}

function addPennywiseLipPatch(parent: THREE.Group, outerIndices: number[], innerIndices: number[], outerShape: number[], innerShape: number[]) {
  const landmarkIndices = [...outerIndices, ...innerIndices.slice(1, -1).reverse()];
  const shape = [
    ...outerShape.map((y, index) => new THREE.Vector2(-1 + (2 * index) / (outerShape.length - 1), y)),
    ...innerShape.slice(1, -1).reverse().map((y, reverseIndex) => {
      const index = innerShape.length - 2 - reverseIndex;
      return new THREE.Vector2(-1 + (2 * index) / (innerShape.length - 1), y);
    }),
  ];
  const triangles = THREE.ShapeUtils.triangulateShape(shape, []);
  const positions = new Float32Array(landmarkIndices.length * 3);
  const uvs = new Float32Array(landmarkIndices.length * 2);
  const indices = triangles.flat();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const material = new THREE.ShaderMaterial({
    uniforms: { uFrame: { value: null }, uSaturation: { value: 1.55 } },
    vertexShader: `
      varying vec2 vFrameUv;
      void main() {
        vFrameUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uFrame;
      uniform float uSaturation;
      varying vec2 vFrameUv;
      void main() {
          vec3 source = sRGBTransferEOTF(texture2D(uFrame, vFrameUv)).rgb;
          float luminance = dot(source, vec3(0.2126, 0.7152, 0.0722));
          vec3 saturated = mix(vec3(luminance), source, uSaturation);
          saturated.r *= 1.12;
          saturated.g *= 0.72;
          saturated.b *= 0.68;
          gl_FragColor = vec4(clamp(saturated, 0.0, 1.0), 1.0);
          #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 11;
  parent.add(mesh);
  return { mesh, landmarkIndices, material } satisfies PennywiseLipPatch;
}

export function addPennywiseMarkings(parent: THREE.Group) {
  const streaks = Array.from({ length: 2 }, () => ({
    upper: {
      glow: addPennywiseRibbon(parent, 0xb13a43, 0.18, 8),
      line: addPennywiseRibbon(parent, pennywiseLineColor, pennywiseLineOpacity, 9),
    },
    lower: {
      glow: addPennywiseRibbon(parent, 0xb13a43, 0.18, 8),
      line: addPennywiseRibbon(parent, pennywiseLineColor, pennywiseLineOpacity, 9),
    },
  }));
  const nose = addPennywiseNose(parent);
  const lips = [
    addPennywiseLipPatch(parent, [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291], [61, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 291], [0, 0.1, 0.19, 0.28, 0.34, 0.37, 0.34, 0.28, 0.19, 0.1, 0], [0, 0.01, 0.04, 0.06, 0.08, 0.1, 0.11, 0.1, 0.08, 0.06, 0.04, 0.01]),
    addPennywiseLipPatch(parent, [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291], [61, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 291], [0, -0.1, -0.19, -0.28, -0.34, -0.36, -0.34, -0.28, -0.19, -0.1, 0], [0, -0.01, -0.03, -0.05, -0.08, -0.1, -0.11, -0.1, -0.08, -0.05, -0.03, -0.01, 0]),
  ];
  parent.userData.pennywiseMarkings = { streaks, nose, lips } satisfies PennywiseMarkings;
}

function updatePennywiseRibbon(mesh: THREE.Mesh, controlPoints: THREE.Vector3[], halfWidth: number, projectedLandmarks: THREE.Vector3[], faceTriangles: FaceTriangle[], depthOffset: number, widenTowardEnd = false) {
  const geometry = mesh.geometry as THREE.BufferGeometry;
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const colors = geometry.attributes.color as THREE.BufferAttribute;
  const path = new THREE.CatmullRomCurve3(controlPoints, false, "centripetal");
  const samples = path.getPoints(pennywiseLineSegments);
  const acrossCount = pennywiseRibbonAcrossSegments + 1;
  for (let index = 0; index <= pennywiseLineSegments; index += 1) {
    const point = samples[index];
    const previous = samples[Math.max(index - 1, 0)];
    const next = samples[Math.min(index + 1, pennywiseLineSegments)];
    const tangent = new THREE.Vector2(next.x - previous.x, next.y - previous.y).normalize();
    const normal = new THREE.Vector2(-tangent.y, tangent.x);
    const t = index / pennywiseLineSegments;
    const fullness = Math.sin(Math.PI * t) ** 0.62;
    const taper = widenTowardEnd ? 0.28 + 0.72 * t : 0.22 + 0.78 * fullness;
    const radius = halfWidth * taper;
    const z = faceSurfaceDepth(point.x, point.y, projectedLandmarks, faceTriangles) + depthOffset;
    for (let across = 0; across <= pennywiseRibbonAcrossSegments; across += 1) {
      const tAcross = across / pennywiseRibbonAcrossSegments;
      const offset = radius * (tAcross * 2 - 1);
      const vertex = index * acrossCount + across;
      positions.setXYZ(vertex, point.x + normal.x * offset, point.y + normal.y * offset, z);
      const edge = Math.abs(tAcross * 2 - 1);
      const edgeShade = 1 - 0.34 * edge ** 1.6;
      colors.setXYZ(vertex, edgeShade, edgeShade, edgeShade);
    }
  }
  positions.needsUpdate = true;
  colors.needsUpdate = true;
  geometry.computeBoundingSphere();
}

function updatePennywiseNose(mesh: THREE.Mesh, center: THREE.Vector3, axisX: THREE.Vector2, axisY: THREE.Vector2, radiusX: number, radiusY: number, projectedLandmarks: THREE.Vector3[], faceTriangles: FaceTriangle[], depthOffset: number) {
  const geometry = mesh.geometry as THREE.BufferGeometry;
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const rings = 10;
  const around = 48;
  for (let ring = 0; ring <= rings; ring += 1) {
    const radius = ring / rings;
    for (let point = 0; point < around; point += 1) {
      const angle = (point / around) * Math.PI * 2;
      const x = center.x + axisX.x * Math.cos(angle) * radiusX * radius + axisY.x * Math.sin(angle) * radiusY * radius;
      const y = center.y + axisX.y * Math.cos(angle) * radiusX * radius + axisY.y * Math.sin(angle) * radiusY * radius;
      const z = faceSurfaceDepth(x, y, projectedLandmarks, faceTriangles) + depthOffset;
      positions.setXYZ(ring * around + point, x, y, z);
    }
  }
  positions.needsUpdate = true;
  geometry.computeBoundingSphere();
}

export function updatePennywiseMarkings(parent: THREE.Group, face: FaceLandmark[], width: number, height: number, sourceWidth: number, sourceHeight: number, mirrored: boolean, faceTriangles: FaceTriangle[], videoTexture: THREE.VideoTexture | null) {
  const markings = parent.userData.pennywiseMarkings as PennywiseMarkings | undefined;
  if (!markings || face.length < 468) return;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const offsetX = (sourceWidth * scale - width) / 2;
  const offsetY = (sourceHeight * scale - height) / 2;
  const project = (landmark: FaceLandmark) => {
    const rawX = landmark.x * sourceWidth * scale - offsetX;
    const x = mirrored ? width - rawX : rawX;
    const y = landmark.y * sourceHeight * scale - offsetY;
    return new THREE.Vector3(x - width / 2, height / 2 - y, -(landmark.z ?? 0) * sourceWidth * scale);
  };
  const eyes = [
    project(face[33]).add(project(face[133])).multiplyScalar(0.5),
    project(face[362]).add(project(face[263])).multiplyScalar(0.5),
  ].sort((a, b) => a.x - b.x);
  const eyeCenter = eyes[0].clone().add(eyes[1]).multiplyScalar(0.5);
  const eyeDistance = Math.hypot(eyes[1].x - eyes[0].x, eyes[1].y - eyes[0].y);
  if (!Number.isFinite(eyeDistance) || eyeDistance < 8) return;
  const axisX = new THREE.Vector2(eyes[1].x - eyes[0].x, eyes[1].y - eyes[0].y).normalize();
  const projectedLandmarks = face.map(project);
  const chin = project(face[152]);
  const faceDown = new THREE.Vector2(chin.x - eyeCenter.x, chin.y - eyeCenter.y);
  faceDown.sub(axisX.clone().multiplyScalar(faceDown.dot(axisX))).normalize();
  const forehead = project(face[10]);
  const mouthCorners = [project(face[61]), project(face[291])].sort((a, b) => a.x - b.x);
  const eyeUpperPoints = [project(face[159]), project(face[386])].sort((a, b) => a.x - b.x);
  const eyeLowerPoints = [project(face[145]), project(face[374])].sort((a, b) => a.x - b.x);
  for (const [index, side] of [-1, 1].entries()) {
    const start = forehead.clone()
      .addScaledVector(new THREE.Vector3(axisX.x, axisX.y, 0), side * eyeDistance * 0.5)
      .addScaledVector(new THREE.Vector3(faceDown.x, faceDown.y, 0), eyeDistance * 0.2);
    const upperEyeEdge = eyeUpperPoints[index];
    const lowerEyeEdge = eyeLowerPoints[index];
    const eyeExit = lowerEyeEdge.clone().addScaledVector(new THREE.Vector3(faceDown.x, faceDown.y, 0), eyeDistance * 0.3);
    const cheek = eyeCenter.clone()
      .addScaledVector(new THREE.Vector3(axisX.x, axisX.y, 0), side * eyeDistance * 0.8)
      .addScaledVector(new THREE.Vector3(faceDown.x, faceDown.y, 0), eyeDistance * 0.74);
    const mouthCorner = mouthCorners[index];
    const upperPoints = [start, upperEyeEdge];
    const lowerPoints = [lowerEyeEdge, eyeExit, cheek, mouthCorner];
    const streak = markings.streaks[index];
    updatePennywiseRibbon(streak.upper.glow, upperPoints, eyeDistance * 0.065, projectedLandmarks, faceTriangles, eyeDistance * 0.025);
    updatePennywiseRibbon(streak.upper.line, upperPoints, eyeDistance * pennywiseLineHalfWidth, projectedLandmarks, faceTriangles, eyeDistance * 0.03, true);
    updatePennywiseRibbon(streak.lower.glow, lowerPoints, eyeDistance * 0.065, projectedLandmarks, faceTriangles, eyeDistance * 0.025);
    updatePennywiseRibbon(streak.lower.line, lowerPoints, eyeDistance * pennywiseLineHalfWidth, projectedLandmarks, faceTriangles, eyeDistance * 0.03);
  }
  const nostrils = [project(face[98]), project(face[327])].sort((a, b) => a.x - b.x);
  const noseTip = project(face[4]);
  const noseBridge = project(face[168]);
  const noseAxisX = new THREE.Vector2(nostrils[1].x - nostrils[0].x, nostrils[1].y - nostrils[0].y).normalize();
  const noseAxisY = new THREE.Vector2(noseTip.x - noseBridge.x, noseTip.y - noseBridge.y);
  noseAxisY.sub(noseAxisX.clone().multiplyScalar(noseAxisY.dot(noseAxisX))).normalize();
  const noseWidth = Math.hypot(nostrils[1].x - nostrils[0].x, nostrils[1].y - nostrils[0].y);
  updatePennywiseNose(markings.nose, noseTip, noseAxisX, noseAxisY, noseWidth * 0.72, noseWidth * 0.58, projectedLandmarks, faceTriangles, eyeDistance * 0.038);
  for (const lip of markings.lips) {
    const positions = lip.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const uvs = lip.mesh.geometry.attributes.uv as THREE.BufferAttribute;
    lip.landmarkIndices.forEach((landmarkIndex, index) => {
      const point = projectedLandmarks[landmarkIndex];
      positions.setXYZ(index, point.x, point.y, point.z + eyeDistance * 0.042);
      const landmark = face[landmarkIndex];
      // The mesh is projected into mirrored screen coordinates, while this UV
      // must still sample the landmark's original camera pixel.
      uvs.setXY(index, landmark.x, 1 - landmark.y);
    });
    positions.needsUpdate = true;
    uvs.needsUpdate = true;
    lip.material.uniforms.uFrame.value = videoTexture;
    lip.mesh.visible = Boolean(videoTexture);
    lip.mesh.geometry.computeBoundingSphere();
  }
}

