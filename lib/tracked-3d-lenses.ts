import * as THREE from "three";

export type FaceLandmark = { x: number; y: number; z?: number };

type TrackedArFrame = {
  faces: FaceLandmark[][];
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  mirrored: boolean;
  lensId: string;
  tongueOpen?: boolean[];
  onDogMouthDebug?: (openness: number, isOpen: boolean) => void;
};

export type TrackedArRenderer = {
  update(frame: TrackedArFrame): void;
  dispose(): void;
};

const makeMaterial = (color: number, metalness = 0.12, roughness = 0.42) => new THREE.MeshStandardMaterial({
  color,
  metalness,
  roughness,
});

function addMesh(parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], scale?: [number, number, number]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

function addHorn(parent: THREE.Group, side: -1 | 1, color: number, height = 0.92) {
  const points = [
    new THREE.Vector3(side * 0.38, 0.66, 0),
    new THREE.Vector3(side * 0.56, 0.88, 0.03),
    new THREE.Vector3(side * 0.52, 0.66 + height * 0.78, 0.08),
    new THREE.Vector3(side * 0.72, 0.66 + height, 0.06),
  ];
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, 24, 0.105, 10, false);
  const material = makeMaterial(color, 0.18, 0.34);
  const horn = addMesh(parent, geometry, material, [0, 0, 0]);
  horn.geometry.computeVertexNormals();
}

function addCatEars(parent: THREE.Group) {
  const outer = new THREE.Shape();
  outer.moveTo(0, 0);
  outer.quadraticCurveTo(-0.04, 0.55, -0.27, 1.02);
  outer.quadraticCurveTo(0.28, 0.91, 0.48, 0.08);
  outer.quadraticCurveTo(0.2, -0.03, 0, 0);
  const inner = new THREE.Shape();
  inner.moveTo(0.1, 0.13);
  inner.quadraticCurveTo(0.12, 0.51, 0.04, 0.78);
  inner.quadraticCurveTo(0.34, 0.58, 0.38, 0.16);
  inner.quadraticCurveTo(0.25, 0.09, 0.1, 0.13);
  const extrude = { depth: 0.1, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.035, bevelThickness: 0.035 };
  const outerMaterial = makeMaterial(0x17131a, 0.22, 0.3);
  const innerMaterial = makeMaterial(0x6f3540, 0.04, 0.52);
  for (const side of [-1, 1] as const) {
    const ear = new THREE.Group();
    ear.position.set(side * 0.5, 0.58, 0.01);
    ear.scale.x = side;
    ear.rotation.z = side * -0.12;
    const geometry = new THREE.ExtrudeGeometry(outer, extrude);
    const innerGeometry = new THREE.ExtrudeGeometry(inner, { ...extrude, depth: 0.035, bevelSize: 0.012, bevelThickness: 0.01 });
    addMesh(ear, geometry, outerMaterial, [0, 0, 0]);
    addMesh(ear, innerGeometry, innerMaterial, [0, 0.025, 0.13]);
    parent.add(ear);
  }
  addMesh(parent, new THREE.SphereGeometry(0.16, 24, 18), makeMaterial(0x21161a, 0.08, 0.22), [0, -0.46, 0.27], [1.12, 0.62, 0.55]);
  addMesh(parent, new THREE.SphereGeometry(0.09, 22, 18), makeMaterial(0x120f12, 0.24, 0.16), [0, -0.37, 0.55], [1.05, 0.72, 0.6]);
  const whiskers = makeMaterial(0x251c20, 0.05, 0.5);
  for (const side of [-1, 1] as const) {
    for (let row = 0; row < 3; row++) {
      const y = -0.46 - row * 0.055;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.12, y, 0.35),
        new THREE.Vector3(side * 0.42, y + (row - 1) * 0.08, 0.24),
        new THREE.Vector3(side * 0.77, y + (row - 1) * 0.14, 0.12),
      ]);
      addMesh(parent, new THREE.TubeGeometry(curve, 12, 0.012, 6, false), whiskers, [0, 0, 0]);
    }
  }
}

function addFlowerCrown(parent: THREE.Group) {
  const flowerColors = [0xe9d6c5, 0x9e3741, 0xd18b68, 0xddd0a4];
  const leafMaterial = makeMaterial(0x304a37, 0.03, 0.62);
  for (let index = 0; index < 11; index++) {
    const angle = Math.PI * (0.08 + 0.84 * index / 10);
    const x = Math.cos(angle) * 0.94;
    const y = 0.55 + Math.sin(angle) * 0.48;
    const leaf = addMesh(parent, new THREE.SphereGeometry(0.17, 14, 10), leafMaterial, [x, y, -0.06], [0.42, 1.35, 0.34]);
    leaf.rotation.z = -angle + Math.PI / 2;
    if (index % 2 === 0) {
      const color = flowerColors[(index / 2) % flowerColors.length];
      const blossom = new THREE.Group();
      blossom.position.set(x, y + 0.02, 0.11);
      for (let petal = 0; petal < 6; petal++) {
        const rotation = petal * Math.PI / 3;
        const bloom = addMesh(blossom, new THREE.SphereGeometry(0.085, 12, 10), makeMaterial(color, 0.02, 0.48), [Math.cos(rotation) * 0.1, Math.sin(rotation) * 0.1, 0], [0.9, 1.45, 0.6]);
        bloom.rotation.z = rotation;
      }
      addMesh(blossom, new THREE.SphereGeometry(0.055, 12, 10), makeMaterial(0xd0ad5c, 0.38, 0.28), [0, 0, 0.04]);
      parent.add(blossom);
    }
  }
}

function addWitchHat(parent: THREE.Group) {
  const felt = makeMaterial(0x201b2a, 0.08, 0.6);
  const band = makeMaterial(0x702c3a, 0.26, 0.36);
  const brim = addMesh(parent, new THREE.CylinderGeometry(0.79, 0.79, 0.09, 48), felt, [0, 0.88, 0.02]);
  brim.rotation.x = Math.PI / 2;
  const cone = addMesh(parent, new THREE.ConeGeometry(0.53, 1.02, 12, 2), felt, [0.02, 1.34, -0.02]);
  cone.rotation.z = -0.16;
  const ribbon = addMesh(parent, new THREE.TorusGeometry(0.43, 0.045, 10, 40), band, [0, 1.1, 0.19]);
  ribbon.scale.y = 0.36;
}

function addCrystalCrown(parent: THREE.Group, color: number) {
  const material = new THREE.MeshPhysicalMaterial({ color, roughness: 0.16, metalness: 0.15, transmission: 0.2, thickness: 0.5, transparent: true, opacity: 0.92 });
  for (let index = 0; index < 7; index++) {
    const x = (index - 3) * 0.24;
    const height = 0.42 + (index % 3) * 0.16;
    const crystal = addMesh(parent, new THREE.ConeGeometry(0.14, height, 6, 1), material, [x, 0.72 + height * 0.48, 0.03]);
    crystal.rotation.z = (index - 3) * -0.075;
    crystal.rotation.x = (index % 2 ? 1 : -1) * 0.1;
  }
}

function addBriarCrown(parent: THREE.Group) {
  const bark = makeMaterial(0x30241f, 0.02, 0.78);
  for (const side of [-1, 1] as const) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.48, 0), new THREE.Vector3(side * 0.32, 0.72, 0),
      new THREE.Vector3(side * 0.42, 1.12, 0.03), new THREE.Vector3(side * 0.7, 1.23, 0.08),
    ]);
    addMesh(parent, new THREE.TubeGeometry(curve, 20, 0.045, 8, false), bark, [0, 0, 0]);
    addHorn(parent, side, 0x493a31, 0.48);
  }
  addFlowerCrown(parent);
}

function addBatWings(parent: THREE.Group, color: number) {
  const membrane = makeMaterial(color, 0.2, 0.3);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.28, 0.55, 0.64, 0.7);
  shape.quadraticCurveTo(0.54, 0.35, 0.95, 0.46);
  shape.quadraticCurveTo(0.68, 0.12, 0.5, -0.12);
  shape.quadraticCurveTo(0.2, -0.28, 0, 0);
  for (const side of [-1, 1] as const) {
    const wing = addMesh(parent, new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.02, bevelThickness: 0.02 }), membrane, [side * 0.42, 0.1, -0.02]);
    wing.scale.x = side;
    wing.rotation.z = side * -0.12;
  }
}

function addSpider(parent: THREE.Group) {
  const body = makeMaterial(0x17121a, 0.18, 0.2);
  const abdomen = addMesh(parent, new THREE.SphereGeometry(0.19, 22, 16), body, [0, 0.56, 0.24], [0.82, 1.2, 0.7]);
  abdomen.rotation.z = -0.2;
  addMesh(parent, new THREE.SphereGeometry(0.12, 20, 16), makeMaterial(0x38232d, 0.34, 0.15), [0, 0.4, 0.34]);
  for (const side of [-1, 1] as const) {
    for (let leg = 0; leg < 4; leg++) {
      const startY = 0.42 + leg * 0.09;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.08, startY, 0.24),
        new THREE.Vector3(side * (0.28 + (leg % 2) * 0.06), startY + (leg < 2 ? 0.18 : -0.02), 0.2),
        new THREE.Vector3(side * (0.48 + (leg % 2) * 0.06), startY + (leg < 2 ? 0.07 : -0.19), 0.12),
      ]);
      addMesh(parent, new THREE.TubeGeometry(curve, 12, 0.025, 6, false), body, [0, 0, 0]);
    }
  }
}

function addSkullAndBoneCrown(parent: THREE.Group) {
  const bone = makeMaterial(0xd0c3a8, 0.08, 0.5);
  for (const side of [-1, 1] as const) {
    const brow = addMesh(parent, new THREE.SphereGeometry(0.42, 24, 16), bone, [side * 0.43, 0.16, 0.18], [0.94, 0.19, 0.16]);
    brow.rotation.z = side * -0.1;
    addMesh(parent, new THREE.SphereGeometry(0.15, 18, 14), bone, [side * 0.72, -0.35, 0.14], [1.45, 0.52, 0.28]);
  }
  for (let tooth = 0; tooth < 7; tooth++) {
    addMesh(parent, new THREE.BoxGeometry(0.085, 0.25, 0.1), bone, [(tooth - 3) * 0.12, -0.68, 0.23]);
  }
}

function addClownDetails(parent: THREE.Group) {
  addMesh(parent, new THREE.SphereGeometry(0.2, 28, 22), makeMaterial(0x9f1d2c, 0.16, 0.18), [0, -0.14, 0.52], [0.88, 0.9, 0.85]);
  for (const side of [-1, 1] as const) {
    addMesh(parent, new THREE.SphereGeometry(0.11, 20, 14), makeMaterial(0x8b2530, 0.12, 0.25), [side * 0.81, 0.15, 0.02], [0.76, 1.45, 0.32]);
  }
}

function addDogTongue(parent: THREE.Group) {
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

function makeAccessory(lensId: string) {
  const group = new THREE.Group();
  if (lensId === "dog") {
    addDogTongue(group);
    return group;
  }
  if (lensId === "cat") addCatEars(group);
  else if (lensId === "witch") addWitchHat(group);
  else if (lensId === "plague") addBriarCrown(group);
  else if (lensId === "devil") {
    addHorn(group, -1, 0x561d27, 0.95);
    addHorn(group, 1, 0x561d27, 0.95);
  } else if (lensId === "pumpkin") {
    addHorn(group, -1, 0xb95e27, 1.22);
    addHorn(group, 1, 0xb95e27, 1.22);
    addMesh(group, new THREE.SphereGeometry(0.47, 24, 18), makeMaterial(0xb85d22, 0.08, 0.48), [0, 0.88, -0.1], [1.3, 0.5, 0.74]);
  } else if (lensId === "vampire" || lensId === "bats" || lensId === "batgirl") {
    addBatWings(group, lensId === "vampire" ? 0x4d1b2c : 0x22202d);
    if (lensId === "vampire") {
      const fang = makeMaterial(0xf0e5d2, 0.04, 0.26);
      for (const side of [-1, 1] as const) addMesh(group, new THREE.ConeGeometry(0.075, 0.22, 8), fang, [side * 0.17, -0.62, 0.34]);
    }
  } else if (lensId === "spider") addSpider(group);
  else if (lensId === "clown") addClownDetails(group);
  else if (["frostbite", "ice", "ghost", "boo"].includes(lensId)) addCrystalCrown(group, lensId === "frostbite" || lensId === "ice" ? 0x9ad6e6 : 0xc6d2dc);
  else if (lensId === "skull") addSkullAndBoneCrown(group);
  else if (lensId === "stitched") {
    addSkullAndBoneCrown(group);
    const thread = makeMaterial(0x4b2527, 0.1, 0.6);
    for (const side of [-1, 1] as const) {
      for (let stitch = 0; stitch < 4; stitch++) {
        const staple = addMesh(group, new THREE.BoxGeometry(0.07, 0.025, 0.035), thread, [side * (0.55 + stitch * 0.06), -0.18 - stitch * 0.12, 0.28]);
        staple.rotation.z = side * 0.5;
      }
    }
  } else {
    addBriarCrown(group);
  }
  return group;
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
}

export function createTrackedArRenderer(canvas: HTMLCanvasElement): TrackedArRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10000);
  scene.add(new THREE.AmbientLight(0xffe6d0, 2.1));
  const keyLight = new THREE.DirectionalLight(0xfff0dc, 3.2);
  keyLight.position.set(-3, 5, 8);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0x9ab8ff, 1.4);
  fillLight.position.set(4, 1, 5);
  scene.add(fillLight);

  const faceRoot = new THREE.Group();
  scene.add(faceRoot);
  let accessories: THREE.Group[] = [];
  let currentLensId = "";
  let currentWidth = 0;
  let currentHeight = 0;

  function setLens(lensId: string) {
    for (const accessory of accessories) {
      faceRoot.remove(accessory);
      disposeTree(accessory);
    }
    accessories = [];
    currentLensId = lensId;
  }

  function resize(width: number, height: number) {
    if (width === currentWidth && height === currentHeight) return;
    currentWidth = width;
    currentHeight = height;
    renderer.setSize(width, height, false);
    camera.position.z = Math.max(width, height) * 2;
    camera.far = Math.max(width, height) * 10;
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
  }

  return {
    update({ faces, width, height, sourceWidth, sourceHeight, mirrored, lensId, tongueOpen = [] }: TrackedArFrame) {
      resize(width, height);
      if (lensId !== currentLensId) setLens(lensId);
      const scale = Math.max(width / sourceWidth, height / sourceHeight);
      const offsetX = (sourceWidth * scale - width) / 2;
      const offsetY = (sourceHeight * scale - height) / 2;
      const toScreen = (landmark: FaceLandmark) => {
        const sourceX = landmark.x * sourceWidth * scale - offsetX;
        return { x: mirrored ? width - sourceX : sourceX, y: landmark.y * sourceHeight * scale - offsetY };
      };

      while (accessories.length < faces.length) {
        const accessory = makeAccessory(lensId);
        faceRoot.add(accessory);
        accessories.push(accessory);
      }
      for (let index = 0; index < accessories.length; index++) {
        const accessory = accessories[index];
        const face = faces[index];
        if (!face || face.length < 468) {
          accessory.visible = false;
          continue;
        }
        if (lensId === "dog") {
          const leftEye = toScreen(face[33]);
          const rightEye = toScreen(face[263]);
          const upperLip = toScreen(face[13]);
          const lowerLip = toScreen(face[14]);
          const nose = toScreen(face[1]);
          const forehead = toScreen(face[10]);
          const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
          if (!Number.isFinite(eyeDistance) || eyeDistance < 8) {
            accessory.visible = false;
            continue;
          }
          const centerX = (leftEye.x + rightEye.x) / 2;
          const centerY = (leftEye.y + rightEye.y) / 2;
          let screenAngle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
          if (Math.abs(screenAngle) > Math.PI / 2) screenAngle += screenAngle > 0 ? -Math.PI : Math.PI;
          accessory.visible = true;
          accessory.position.set(centerX - width / 2, height / 2 - centerY, 0);
          accessory.scale.setScalar(eyeDistance);
          const yaw = THREE.MathUtils.clamp((nose.x - centerX) / (eyeDistance * 0.42), -1, 1);
          const pitch = THREE.MathUtils.clamp((nose.y - forehead.y) / eyeDistance - 0.78, -0.7, 0.7);
          accessory.rotation.set(pitch * 0.18, yaw * 0.62, -screenAngle);

          const tongue = accessory.userData.dogTongue as THREE.Group | undefined;
          if (tongue) {
            const mouthX = (upperLip.x + lowerLip.x) / 2;
            const mouthY = (upperLip.y + lowerLip.y) / 2;
            const dx = mouthX - centerX;
            const dy = mouthY - centerY;
            const eyeDepth = ((face[33].z ?? 0) + (face[263].z ?? 0)) / 2;
            const mouthDepth = ((face[13].z ?? 0) + (face[14].z ?? 0)) / 2;
            const landmarkEyeDistance = Math.hypot(face[263].x - face[33].x, face[263].y - face[33].y);
            const depthInPixels = landmarkEyeDistance > 0 ? (eyeDepth - mouthDepth) * sourceWidth * scale : 0;
            const inverseFaceRotation = new THREE.Matrix4().makeRotationFromEuler(accessory.rotation).invert();
            const localMouth = new THREE.Vector3(dx, -dy, depthInPixels)
              .applyMatrix4(inverseFaceRotation)
              .multiplyScalar(1 / eyeDistance);
            tongue.position.copy(localMouth);
            const target = tongueOpen[index] ? 1 : 0;
            const extension = THREE.MathUtils.damp(tongue.scale.x, target, 9, 1 / 30);
            tongue.scale.setScalar(extension);
            tongue.visible = extension > 0.025;
          }
          continue;
        }
        const leftEye = toScreen(face[33]);
        const rightEye = toScreen(face[263]);
        const nose = toScreen(face[1]);
        const forehead = toScreen(face[10]);
        const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
        if (!Number.isFinite(eyeDistance) || eyeDistance < 8) {
          accessory.visible = false;
          continue;
        }
        const centerX = (leftEye.x + rightEye.x) / 2;
        const centerY = (leftEye.y + rightEye.y) / 2;
        accessory.visible = true;
        accessory.position.set(centerX - width / 2, height / 2 - centerY, 0);
        accessory.scale.setScalar(eyeDistance);
        accessory.rotation.z = -Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
        const yaw = THREE.MathUtils.clamp((nose.x - centerX) / (eyeDistance * 0.42), -1, 1);
        const pitch = THREE.MathUtils.clamp((nose.y - forehead.y) / eyeDistance - 0.78, -0.7, 0.7);
        accessory.rotation.y = yaw * 0.62;
        accessory.rotation.x = pitch * 0.18;
      }
      renderer.render(scene, camera);
    },
    dispose() {
      disposeTree(faceRoot);
      scene.clear();
      renderer.dispose();
    },
  };
}
