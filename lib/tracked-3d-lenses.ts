import * as THREE from "three";
import { addDogTongue, updateDogAccessory } from "./filters/dog-3d";
import { addCuteDevilHorns, type CuteDevilTextureAssets, updateCuteDevilHorns } from "./filters/cute-devil-3d";
import { addPennywiseMarkings, updatePennywiseMarkings } from "./filters/pennywise-3d";
import { addVoodooFaceImages, addVoodooMouthLines, type VoodooTextureAssets, updateVoodooFaceImages, updateVoodooMouthLines } from "./filters/voodoo-skull-3d";
import { addWitchHat, updateWitchHat } from "./filters/witch-hat-3d";
import { triangulateFace, type FaceLandmark, type FaceTriangle } from "./filters/tracked-3d-shared";

type TrackedArFrame = {
  faces: FaceLandmark[][];
  videoFrame?: HTMLVideoElement;
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

function makeAccessory(lensId: string, voodooTextures: VoodooTextureAssets, witchHatTexture: THREE.Texture, cuteDevilTextures: CuteDevilTextureAssets) {
  const group = new THREE.Group();
  if (lensId === "dog") addDogTongue(group);
  if (lensId === "witch-hat") addWitchHat(group, witchHatTexture);
  if (lensId === "pennywise") addPennywiseMarkings(group);
  if (lensId === "cute-devil") addCuteDevilHorns(group, cuteDevilTextures.horns);
  if (lensId === "voodoo-skull") {
    addVoodooFaceImages(group, voodooTextures);
    addVoodooMouthLines(group, voodooTextures.mouthLine);
  }
  return group;
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if ("map" in material && material.map instanceof THREE.Texture && !material.map.userData.keepWarm) material.map.dispose();
      material.dispose();
    });
  });
}

export function createTrackedArRenderer(canvas: HTMLCanvasElement, faceConnections: Array<{ start: number; end: number }> = []): TrackedArRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
  const touchDevice = window.matchMedia("(pointer: coarse)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touchDevice ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const textureLoader = new THREE.TextureLoader();
  const voodooTextures: VoodooTextureAssets = {
    nose: textureLoader.load("/filters/voodoo-nose.webp"),
    mouthLine: textureLoader.load("/filters/voodoo-mouth-corner-wrap.png"),
  };
  const cuteDevilTextures: CuteDevilTextureAssets = {
    horns: textureLoader.load("/filters/cute-devil-horns.png"),
  };
  const witchHatTexture = textureLoader.load("/filters/witch-hat-velvet.webp");
  for (const texture of Object.values(voodooTextures)) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.userData.keepWarm = true;
  }
  for (const texture of [...Object.values(cuteDevilTextures), witchHatTexture]) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.userData.keepWarm = true;
  }
  witchHatTexture.wrapS = THREE.RepeatWrapping;
  witchHatTexture.wrapT = THREE.RepeatWrapping;
  witchHatTexture.repeat.set(1.5, 1.5);
  voodooTextures.mouthLine.generateMipmaps = true;
  voodooTextures.mouthLine.minFilter = THREE.LinearMipmapLinearFilter;
  voodooTextures.mouthLine.magFilter = THREE.LinearFilter;

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
  const faceTriangles = triangulateFace(faceConnections);
  let videoElement: HTMLVideoElement | null = null;
  let videoTexture: THREE.VideoTexture | null = null;

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
    update({ faces, videoFrame, width, height, sourceWidth, sourceHeight, mirrored, lensId, tongueOpen = [] }: TrackedArFrame) {
      resize(width, height);
      if (lensId !== currentLensId) setLens(lensId);
      if (lensId === "pennywise" && videoFrame && videoFrame !== videoElement) {
        videoTexture?.dispose();
        videoElement = videoFrame;
        videoTexture = new THREE.VideoTexture(videoFrame);
        videoTexture.colorSpace = THREE.SRGBColorSpace;
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.generateMipmaps = false;
      }
      if (lensId === "none") {
        renderer.render(scene, camera);
        return;
      }
      const scale = Math.max(width / sourceWidth, height / sourceHeight);
      const offsetX = (sourceWidth * scale - width) / 2;
      const offsetY = (sourceHeight * scale - height) / 2;
      const toScreen = (landmark: FaceLandmark) => {
        const sourceX = landmark.x * sourceWidth * scale - offsetX;
        return { x: mirrored ? width - sourceX : sourceX, y: landmark.y * sourceHeight * scale - offsetY };
      };

      while (accessories.length < faces.length) {
        const accessory = makeAccessory(lensId, voodooTextures, witchHatTexture, cuteDevilTextures);
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
          if (!updateDogAccessory(accessory, face, width, height, sourceWidth, sourceHeight, mirrored, tongueOpen[index] ?? false)) {
            accessory.visible = false;
            continue;
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
        if (lensId === "voodoo-skull") {
          accessory.position.set(0, 0, 0);
          accessory.scale.set(1, 1, 1);
          accessory.rotation.set(0, 0, 0);
          updateVoodooMouthLines(accessory, face, width, height, sourceWidth, sourceHeight, mirrored);
          updateVoodooFaceImages(accessory, face, width, height, sourceWidth, sourceHeight, mirrored, faceTriangles);
          continue;
        }
        if (lensId === "pennywise") {
          accessory.position.set(0, 0, 0);
          accessory.scale.set(1, 1, 1);
          accessory.rotation.set(0, 0, 0);
          updatePennywiseMarkings(accessory, face, width, height, sourceWidth, sourceHeight, mirrored, faceTriangles, videoTexture);
          continue;
        }
        if (lensId === "cute-devil") {
          accessory.position.set(0, 0, 0);
          accessory.scale.set(1, 1, 1);
          accessory.rotation.set(0, 0, 0);
          updateCuteDevilHorns(accessory, face, width, height, sourceWidth, sourceHeight, mirrored, faceTriangles);
          continue;
        }
        if (lensId === "witch-hat") {
          if (!updateWitchHat(accessory, face, width, height, sourceWidth, sourceHeight, mirrored)) {
            accessory.visible = false;
            continue;
          }
          continue;
        }
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
      Object.values(voodooTextures).forEach((texture) => texture.dispose());
      Object.values(cuteDevilTextures).forEach((texture) => texture.dispose());
      witchHatTexture.dispose();
      videoTexture?.dispose();
      renderer.dispose();
    },
  };
}
