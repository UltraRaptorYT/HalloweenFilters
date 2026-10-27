"use client";

import { useEffect, useRef, useState } from "react";
import NextImage from "next/image";
import type { FaceLandmarker as FaceLandmarkerType, PoseLandmarker as PoseLandmarkerType } from "@mediapipe/tasks-vision";
import type { TrackedArRenderer } from "@/lib/tracked-3d-lenses";
import { drawDogImageFilter, dogImageSources, type DogEarPhysics } from "@/lib/dog-filter";
import { devilImageSources, drawDevilBackProps, drawDevilHorns, type DevilAssets } from "@/lib/devil-filter";
import { drawGrinFilter } from "@/lib/grin-filter";
import { getDogMouthOpenness, shouldDogTongueBeOpen } from "@/lib/dog-mouth";
import { getQueuedPhotos, removeQueuedPhoto, saveQueuedPhoto } from "@/lib/offline-photo-queue";
import { drawVampireFangs, drawVampireRibbon, vampireImageSources, type VampireAssets } from "@/lib/vampire-filter";
import { drawVoodooSkullFilter, type VoodooSkullImages, voodooSkullImageSources } from "@/lib/voodoo-skull-filter";

type Filter = {
  id: string;
  name: string;
  mood: string;
  symbol: string;
  style: "makeup" | "transformation" | "accessory";
  preview?: string;
};

const filters: Filter[] = [
  { id: "dog", name: "Good Dog", mood: "OPEN YOUR MOUTH FOR A SCREEN LICK", symbol: "DOG", preview: "/icons/good-dog.webp", style: "transformation" },
  { id: "clown", name: "The Grin", mood: "RED EYES & A WIDE, TRACKED SMILE", symbol: "GRIN", preview: "/icons/the-grin.webp", style: "transformation" },
  { id: "vampire", name: "Vampire", mood: "RIBBON & TRACKED FANGS", symbol: "BITE", preview: "/filters/vampire.webp", style: "transformation" },
  { id: "devil", name: "Devil", mood: "TRACKED HORNS & WINGS", symbol: "DEVIL", preview: "/filters/devil-horns.png", style: "transformation" },
  { id: "cute-devil", name: "Cute Devil", mood: "GLOWING HORNS THAT FOLLOW YOUR FACE", symbol: "CUTE", preview: "/filters/cute-devil-horns.png", style: "accessory" },
  { id: "pennywise", name: "Pennywise", mood: "EYE-CUTTING RED LINES & A CIRCULAR NOSE", symbol: "CLOWN", style: "makeup" },
  { id: "witch-hat", name: "Witch Hat", mood: "3D TRACKED VELVET HAT", symbol: "WITCH", style: "transformation" },
  { id: "voodoo-skull", name: "Voodoo Skull", mood: "SMOKY EYES & A SEWN SMILE", symbol: "VOODOO", preview: "/filters/voodoo-sockets.webp", style: "makeup" },
];
const maxTrackedFaces = 5;
const maxTrackedPoses = 5;
const backgrounds: Filter[] = [
  { id: "none", name: "Camera room", mood: "ORIGINAL BACKGROUND", symbol: "ROOM", preview: "/icons/camera-room.webp", style: "makeup" },
  { id: "forest", name: "Haunted forest", mood: "FOG & MOONLIGHT", symbol: "FOG", preview: "/scenes/haunted-forest.webp", style: "makeup" },
  { id: "graveyard", name: "Moonlit graveyard", mood: "MIST & MOONLIGHT", symbol: "CRYPT", preview: "/scenes/graveyard.webp", style: "makeup" },
  { id: "haunted-manor", name: "Haunted manor", mood: "GHOSTLY ESTATE", symbol: "MANOR", preview: "/scenes/haunted-manor.webp", style: "makeup" },
  { id: "pumpkin-patch", name: "Pumpkin patch", mood: "HARVEST MOON", symbol: "PATCH", preview: "/scenes/pumpkin-patch.webp", style: "makeup" },
];
const sceneImageSources: Record<string, string> = {
  forest: "/scenes/haunted-forest.webp",
  graveyard: "/scenes/graveyard.webp",
  "haunted-manor": "/scenes/haunted-manor.webp",
  "pumpkin-patch": "/scenes/pumpkin-patch.webp",
};
type Landmark = { x: number; y: number; z?: number; visibility?: number };
const faceOutlineIndices = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

function drawSceneImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  const cropX = (image.naturalWidth - cropWidth) / 2;
  const cropY = (image.naturalHeight - cropHeight) / 2;
  ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);
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

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arCanvasRef = useRef<HTMLCanvasElement>(null);
  const arRendererRef = useRef<TrackedArRenderer | null>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const videoLandmarkerRef = useRef<FaceLandmarkerType | null>(null);
  const videoLandmarkerPromiseRef = useRef<Promise<FaceLandmarkerType> | null>(null);
  const videoFaceCpuFallbackRef = useRef(false);
  const videoPoseLandmarkerRef = useRef<PoseLandmarkerType | null>(null);
  const videoPosePromiseRef = useRef<Promise<PoseLandmarkerType> | null>(null);
  const videoPoseCpuFallbackRef = useRef(false);
  const landmarksRef = useRef<Landmark[][]>([]);
  const faceOpennessRef = useRef<number[]>([]);
  const dogImagesRef = useRef<Partial<Record<keyof typeof dogImageSources, HTMLImageElement>>>({});
  const vampireImagesRef = useRef<Partial<VampireAssets>>({});
  const devilImagesRef = useRef<Partial<DevilAssets>>({});
  const voodooSkullImagesRef = useRef<Partial<VoodooSkullImages>>({});
  const grinIrisRef = useRef<HTMLImageElement | null>(null);
  const grinFrameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dogTongueStatesRef = useRef<Array<{ isOpen: boolean; openedAt: number }>>([]);
  const dogEarPhysicsRef = useRef<DogEarPhysics[]>([]);
  const sceneImagesRef = useRef<Record<string, HTMLImageElement>>({});
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
  const needsBodyTracking = activeBackground !== "none" || activeFilter?.id === "devil";
  const visibleOptions = effectCategory === "face" ? filters : backgrounds;
  const selectedOptionId = effectCategory === "face" ? activeFilter?.id ?? "none" : activeBackground;
  const activeIndex = visibleOptions.findIndex((option) => option.id === selectedOptionId);
  const selectedLens = visibleOptions.find((option) => option.id === selectedOptionId);

  async function ensureFaceTracker() {
    const detectorRef = videoLandmarkerRef;
    const promiseRef = videoLandmarkerPromiseRef;
    if (detectorRef.current) return detectorRef.current;
    if (promiseRef.current) return promiseRef.current;
    promiseRef.current = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      try {
        return await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: maxTrackedFaces,
          outputFaceBlendshapes: true,
        });
      } catch {
        return FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate: "CPU" },
          runningMode: "VIDEO",
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
    for (const [name, source] of Object.entries(voodooSkullImageSources) as [keyof VoodooSkullImages, string][]) {
      const image = new Image();
      image.onload = () => {
        if (!cancelled) voodooSkullImagesRef.current[name] = image;
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
    for (const [name, source] of Object.entries(vampireImageSources) as [keyof VampireAssets, string][]) {
      const image = new Image();
      image.onload = () => {
        if (!cancelled) vampireImagesRef.current[name] = image;
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
    void Promise.all([import("@/lib/tracked-3d-lenses"), import("@mediapipe/tasks-vision")]).then(([renderer, vision]) => {
      if (cancelled) return;
      try {
        arRendererRef.current = renderer.createTrackedArRenderer(canvas, vision.FaceLandmarker.FACE_LANDMARKS_TESSELATION);
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
    for (const [name, source] of Object.entries(devilImageSources) as [keyof DevilAssets, string][]) {
      const image = new Image();
      image.onload = () => {
        if (!cancelled) devilImagesRef.current[name] = image;
      };
      image.src = source;
    }
    return () => { cancelled = true; };
  }, []);

  async function ensurePoseTracker() {
    const detectorRef = videoPoseLandmarkerRef;
    const promiseRef = videoPosePromiseRef;
    if (detectorRef.current) return detectorRef.current;
    if (promiseRef.current) return promiseRef.current;
    promiseRef.current = (async () => {
      const { PoseLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      try {
        return await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "/models/pose_landmarker_lite.task", delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: maxTrackedPoses,
          outputSegmentationMasks: true,
        });
      } catch {
        return PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "/models/pose_landmarker_lite.task", delegate: "CPU" },
          runningMode: "VIDEO",
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
    videoPoseLandmarkerRef.current?.close();
    if (countdownIntervalRef.current !== null) window.clearInterval(countdownIntervalRef.current);
  }, []);

  useEffect(() => {
    if (!qrDataUrl || !shareUrl || !photoUrl) return;
    let remaining = 15;
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
        ctx.save();
        if (activeFilter?.id === "voodoo-skull") ctx.filter = "grayscale(1)";
        drawSceneImage(ctx, sceneImage, width, height);
        ctx.restore();
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
      if (activeFilter?.id === "devil" && poseMaskReadyRef.current) {
        drawDevilBackProps(ctx, posesRef.current, devilImagesRef.current, poseMask, width, height, sourceWidth, sourceHeight, mirrored);
      }
      for (const [faceIndex, faceLandmarks] of landmarksRef.current.entries()) {
        if (!activeFilter) continue;
        if (activeFilter.id === "dog") {
          const openness = faceOpennessRef.current[faceIndex] ?? getDogMouthOpenness(faceLandmarks, sourceWidth, sourceHeight);
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
        if (activeFilter.id === "vampire") {
          drawVampireFangs(ctx, faceLandmarks, vampireImagesRef.current.fangs, width, height, sourceWidth, sourceHeight, mirrored);
          drawVampireRibbon(ctx, faceLandmarks, activeBackground !== "none" ? posesRef.current[faceIndex] : undefined, vampireImagesRef.current.ribbon, width, height, sourceWidth, sourceHeight, mirrored);
          continue;
        }
        if (activeFilter.id === "devil") {
          drawDevilHorns(ctx, faceLandmarks, devilImagesRef.current.horns, width, height, sourceWidth, sourceHeight, mirrored);
          continue;
        }
        if (activeFilter.id === "voodoo-skull") {
          drawVoodooSkullFilter(ctx, faceLandmarks, voodooSkullImagesRef.current, width, height, sourceWidth, sourceHeight, mirrored);
          continue;
        }
      }
      arRendererRef.current?.update({
        faces: landmarksRef.current,
        videoFrame: frameSource instanceof HTMLVideoElement ? frameSource : undefined,
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
      void ensurePoseTracker().catch(() => setTracking("Body effects unavailable · try another browser"));
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
              void switchVideoPoseTrackerToCpu().catch(() => setTracking("Body tracking unavailable on this device"));
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
  }, [activeBackground, activeFilter, cameraOn, facing, needsBodyTracking]);

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
      void ensureFaceTracker().catch(() => setTracking("Face tracking unavailable"));
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
          if (result.qrDataUrl && result.shareUrl) setQrCountdown(15);
          setMessage("QR code ready. Scan it to open your photo on another device.");
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
      setQrCountdown(15);
      setMessage(navigator.onLine ? "Photo saved on this booth. Creating its share QR…" : "Photo saved on this booth. Its QR will appear when the connection returns.");
      await syncQueuedPhotos();
    } catch (error) {
      setQrCountdown(null);
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
      const frame = overlay?.closest(".camera-frame") ?? video?.closest(".camera-frame");
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
      ctx.filter = activeFilter?.id === "voodoo-skull" ? "grayscale(1)" : "none";
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
            <video ref={videoRef} className={`camera-feed ${facing === "user" ? "mirrored" : ""} ${activeFilter?.id === "voodoo-skull" ? "voodoo-monochrome" : ""} ${reviewingPhoto ? "inactive" : ""}`} style={{ filter: activeFilter?.id === "voodoo-skull" ? "grayscale(100%)" : undefined }} autoPlay playsInline muted />
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
          </div>}
          {message && <p className="camera-message" role="status">{message}</p>}
          <div className="permission-note">{tracking}</div>
          <canvas ref={photoCanvasRef} className="hidden-canvas" />
          <canvas ref={poseMaskCanvasRef} className="hidden-canvas" />
          <canvas ref={poseMaskOutputCanvasRef} className="hidden-canvas" />

          {photoUrl && !reviewingPhoto && qrCountdown === null && <section className="share-card" aria-live="polite">
            <div className="share-card-heading"><div><div className="eyebrow">YOUR PHOTO</div><h2>{savingPhoto ? "Preparing your QR" : qrDataUrl ? "Ready to share" : "Saved on this booth"}</h2></div><span className="share-count">{savingPhoto ? "PREPARING" : qrDataUrl ? "QR READY" : queuedPhotoCount ? "QUEUED" : "LOCAL"}</span></div>
            <div className="share-preview"><NextImage src={photoUrl} width={820} height={1000} unoptimized alt="Captured Halloween photo" />{qrDataUrl && shareUrl ? <a className="qr-link" href={shareUrl} target="_blank" rel="noreferrer"><NextImage className="qr-image" src={qrDataUrl} width={560} height={560} unoptimized alt="QR code to open the photo" /></a> : <div className="qr-pending">{queuedPhotoCount ? "QR is being prepared" : "Confirm the photo to make a QR"}</div>}</div>
            {shareUrl && <a className="share-url" href={shareUrl} target="_blank" rel="noreferrer">OPEN SHARE PAGE ↗</a>}
            <a className="share-download" href={photoUrl} download={`afterglow-${activeFilter?.id ?? "photo"}.png`}>DOWNLOAD PHOTO ↓</a>
          </section>}
        </section>

        <aside className="filter-panel">
          <div className="filter-panel-heading"><div><div className="eyebrow">THE COLLECTION</div><h2>{selectedLens?.name ?? "No filter"}</h2></div><span className="filter-count">{activeIndex >= 0 ? String(activeIndex + 1).padStart(2, "0") : "—"}<br /><i>OF {visibleOptions.length}</i></span></div>
          <div className="lens-description"><span className="lens-pulse" /><p><strong>{effectCategory === "face" ? activeFilter ? activeFilter.style === "makeup" ? "REALISTIC MAKEUP" : activeFilter.style === "accessory" ? "TRACKED ACCESSORY" : "FULL-FACE TRANSFORMATION" : "NO FACE FILTER SELECTED" : "TRACKED SCENE"}</strong><br />{selectedLens?.mood ?? "The camera is clear until you choose a look."}</p></div>
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
                  {option.preview && <NextImage src={option.preview} fill sizes={isScene ? "(max-width: 560px) 45vw, 260px" : "96px"} alt="" loading="lazy" />}
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

      {qrCountdown !== null && photoUrl && <section className="qr-takeover" role="dialog" aria-modal="true" aria-labelledby="qr-takeover-title">
        <div className="qr-takeover-card">
          <div className="qr-takeover-heading"><p className="eyebrow">{qrDataUrl && shareUrl ? "YOUR PHOTO IS READY" : "YOUR PHOTO IS SAVED"}</p><span>{qrDataUrl && shareUrl ? `RETURNING IN ${qrCountdown}s` : "PREPARING QR CODE"}</span></div>
          <h1 id="qr-takeover-title">{qrDataUrl && shareUrl ? "Scan to get your photo" : "Your photo is ready"}</h1>
          <div className="qr-takeover-content">
            <NextImage className="qr-takeover-photo" src={photoUrl} width={820} height={1000} unoptimized alt="Your captured Halloween photo" />
            {qrDataUrl && shareUrl ? <a className="qr-takeover-link" href={shareUrl} target="_blank" rel="noreferrer" aria-label="Open your shared photo page">
              <NextImage className="qr-takeover-code" src={qrDataUrl} width={560} height={560} unoptimized alt="Scan this QR code to open your photo" />
              <span>SCAN WITH YOUR PHONE</span>
            </a> : <div className="qr-takeover-pending" role="status">Creating your QR code…</div>}
          </div>
          <p className="qr-takeover-note">{qrDataUrl && shareUrl ? "Your photo page lets you download the image and optionally sign up for email updates." : "Your QR code will appear here as soon as the photo is ready to share."}</p>
          {qrDataUrl && shareUrl && <div className="qr-takeover-progress" aria-hidden="true"><span style={{ animationDuration: "15s" }} /></div>}
        </div>
      </section>}

    </main>
  );
}
