"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { FaceLandmarker as FaceLandmarkerType } from "@mediapipe/tasks-vision";

type Filter = {
  id: string;
  name: string;
  mood: string;
  emoji: string;
};

const filters: Filter[] = [
  { id: "skull", name: "Skull face", mood: "SUGAR SKULL", emoji: "💀" },
  { id: "pumpkin", name: "Pumpkin crown", mood: "PUMPKIN PARTY", emoji: "🎃" },
  { id: "devil", name: "Little devil", mood: "HELLA CUTE", emoji: "😈" },
  { id: "bats", name: "Bat swarm", mood: "NIGHT FLIGHT", emoji: "🦇" },
  { id: "spider", name: "Spider queen", mood: "WEB OF MAGIC", emoji: "🕷️" },
];

type Landmark = { x: number; y: number };

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

function drawFaceEffect(ctx: CanvasRenderingContext2D, effect: string, landmarks: Landmark[], width: number, height: number, sourceWidth: number, sourceHeight: number, mirrored: boolean) {
  if (!landmarks.length) return;
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

  if (effect === "skull") {
    const socket = (eye: Landmark) => {
      const eyeCenter = localPoint(eye === leftEye ? 33 : 263);
      ctx.save();
      ctx.translate(eyeCenter.x, eyeCenter.y);
      ctx.fillStyle = "#17131c";
      ctx.shadowColor = "#0d0b12";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(0, 0, eyeDistance * 0.27, eyeDistance * 0.19, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    socket(leftEye);
    socket(rightEye);
    ctx.fillStyle = "#17131c";
    ctx.beginPath();
    ctx.moveTo(0, eyeDistance * 0.04);
    ctx.lineTo(-eyeDistance * 0.11, eyeDistance * 0.25);
    ctx.lineTo(eyeDistance * 0.11, eyeDistance * 0.25);
    ctx.closePath();
    ctx.fill();
    const mouth = localPoint(13);
    const mouthLeft = localPoint(61);
    const mouthRight = localPoint(291);
    ctx.strokeStyle = "#21151b";
    ctx.lineWidth = Math.max(2, eyeDistance * 0.035);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(mouthLeft.x, mouthLeft.y);
    ctx.quadraticCurveTo(0, mouth.y + eyeDistance * 0.05, mouthRight.x, mouthRight.y);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, eyeDistance * 0.012);
    const smileY = mouth.y + eyeDistance * 0.05;
    for (let i = 0; i < 9; i++) {
      const x = -faceWidth * 0.25 + i * faceWidth * 0.0625;
      ctx.beginPath(); ctx.moveTo(x, smileY - eyeDistance * 0.04); ctx.lineTo(x, smileY + eyeDistance * 0.04); ctx.stroke();
    }
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
  ctx.restore();
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoLandmarkerRef = useRef<FaceLandmarkerType | null>(null);
  const imageLandmarkerRef = useRef<FaceLandmarkerType | null>(null);
  const videoLandmarkerPromiseRef = useRef<Promise<FaceLandmarkerType> | null>(null);
  const imageLandmarkerPromiseRef = useRef<Promise<FaceLandmarkerType> | null>(null);
  const landmarksRef = useRef<Landmark[]>([]);
  const lastVideoTimeRef = useRef(-1);
  const lastDetectionRef = useRef(0);
  const [activeFilter, setActiveFilter] = useState(filters[0]);
  const [cameraOn, setCameraOn] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [tracking, setTracking] = useState("Loading face tracking…");

  async function ensureFaceTracker(mode: "IMAGE" | "VIDEO") {
    const detectorRef = mode === "VIDEO" ? videoLandmarkerRef : imageLandmarkerRef;
    const promiseRef = mode === "VIDEO" ? videoLandmarkerPromiseRef : imageLandmarkerPromiseRef;
    if (detectorRef.current) return detectorRef.current;
    if (promiseRef.current) return promiseRef.current;
    promiseRef.current = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm");
      try {
        return await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate: "GPU" },
          runningMode: mode,
          numFaces: 1,
        });
      } catch {
        return FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate: "CPU" },
          runningMode: mode,
          numFaces: 1,
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

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    videoLandmarkerRef.current?.close();
    imageLandmarkerRef.current?.close();
  }, []);

  useEffect(() => {
    let animation = 0;
    let cancelled = false;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const image = imageRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const paint = (sourceWidth: number, sourceHeight: number, mirrored: boolean) => {
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
      drawFaceEffect(ctx, activeFilter.id, landmarksRef.current, width, height, sourceWidth, sourceHeight, mirrored);
    };

    if (imageUrl && imageLoaded && image?.complete && image.naturalWidth) {
      let cancelledDetect = false;
      const runStill = async () => {
        try {
          setTracking("Finding your face…");
          const detector = await ensureFaceTracker("IMAGE");
          if (cancelledDetect || cancelled) return;
          const result = detector.detect(image);
          landmarksRef.current = (result.faceLandmarks[0] ?? []) as Landmark[];
          setTracking(landmarksRef.current.length ? "Face found · effects follow you" : "No face found · try another photo");
          paint(image.naturalWidth, image.naturalHeight, false);
        } catch {
          setTracking("Face tracking unavailable");
        }
      };
      void runStill();
      return () => { cancelledDetect = true; };
    }

    if (!cameraOn || !video) {
      landmarksRef.current = [];
      paint(1, 1, false);
      return;
    }

    const render = () => {
      if (cancelled) return;
      if (video.videoWidth && video.videoHeight) {
        const now = performance.now();
        if (videoLandmarkerRef.current && video.currentTime !== lastVideoTimeRef.current && now - lastDetectionRef.current > 120) {
          try {
            const result = videoLandmarkerRef.current.detectForVideo(video, now);
            landmarksRef.current = (result.faceLandmarks[0] ?? []) as Landmark[];
            setTracking(landmarksRef.current.length ? "Face found · effects follow you" : "Move into the frame");
          } catch {
            landmarksRef.current = [];
            videoLandmarkerRef.current.close();
            videoLandmarkerRef.current = null;
            setTracking("Face tracking failed · restart the camera");
          }
          lastVideoTimeRef.current = video.currentTime;
          lastDetectionRef.current = now;
        }
        paint(video.videoWidth, video.videoHeight, facing === "user");
      }
      animation = requestAnimationFrame(render);
    };
    animation = requestAnimationFrame(render);
    return () => { cancelled = true; cancelAnimationFrame(animation); };
  }, [activeFilter.id, cameraOn, facing, imageLoaded, imageUrl]);

  async function startCamera(nextFacing = facing) {
    setMessage("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("Camera access needs a secure browser connection. Try uploading a photo instead.");
      return;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 1600 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setImageUrl(null);
      setImageLoaded(false);
      setCameraOn(true);
      setPhotoUrl(null);
      landmarksRef.current = [];
      lastVideoTimeRef.current = -1;
      setTracking("Loading face tracking…");
      void ensureFaceTracker("VIDEO").catch(() => setTracking("Face tracking unavailable"));
    } catch {
      setMessage("We couldn’t open your camera. Check your browser permissions or choose a photo to get started.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  function toggleCamera() {
    const nextFacing = facing === "user" ? "environment" : "user";
    setFacing(nextFacing);
    if (cameraOn || imageUrl) {
      if (imageUrl) setImageUrl(null);
      void startCamera(nextFacing);
    }
  }

  function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const nextUrl = URL.createObjectURL(file);
    setImageUrl(nextUrl);
    setImageLoaded(false);
    setPhotoUrl(null);
    setMessage("");
    stopCamera();
  }

  function capture() {
    const canvas = photoCanvasRef.current;
    const overlay = canvasRef.current;
    const video = videoRef.current;
    const source = imageUrl ? new Image() : null;
    const draw = (image: CanvasImageSource, sourceWidth: number, sourceHeight: number) => {
      if (!canvas) return;
      const frameAspect = 0.82;
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
      const mirrorCapture = !imageUrl && facing === "user";
      if (mirrorCapture) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);
      ctx.restore();
      if (overlay) ctx.drawImage(overlay, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) return;
        if (photoUrl) URL.revokeObjectURL(photoUrl);
        setPhotoUrl(URL.createObjectURL(blob));
      }, "image/png");
    };
    if (imageUrl && source) {
      source.onload = () => draw(source, source.naturalWidth, source.naturalHeight);
      source.src = imageUrl;
    } else if (video?.videoWidth && video.videoHeight) {
      draw(video, video.videoWidth, video.videoHeight);
    } else {
      setMessage("Start your camera or upload a photo before taking a picture.");
    }
  }

  return (
    <main className="studio-shell">
      <header className="topbar">
        <a className="wordmark" href="#home" aria-label="Afterglow home"><span className="brand-mark">✳</span> afterglow<span className="brand-dot">.</span></a>
        <div className="topbar-note"><span className="live-dot" /> HALLOWEEN FACE EFFECTS</div>
        <a className="top-link" href="#studio">TRY AN EFFECT <span>↗</span></a>
      </header>

      <section className="studio" id="studio">
        <div className="intro">
          <div className="eyebrow"><span>✧</span> A CAMERA FOR THE CURIOUS</div>
          <h1>A little<br /><em>after dark.</em></h1>
          <p className="intro-copy">Pick a look. Let the magic follow your face. Snap a Halloween selfie worth keeping.</p>
          <div className="season-tag"><span className="tag-spark">✦</span><span>FACE TRACKING<br />HALLOWEEN EFFECTS</span><span className="tag-year">VOL. 01</span></div>
          <div className="tiny-note"><span className="note-star">✳</span> MAKE BELIEVE, MEET CAMERA</div>
        </div>

        <div className="camera-column">
          <div className="camera-heading"><span>LIVE AR PREVIEW</span><span className="frame-counter">01 <i>/</i> 05</span></div>
          <div className="camera-frame">
            <div className="frame-grain" />
            <video ref={videoRef} className={`camera-feed ${facing === "user" ? "mirrored" : ""} ${imageUrl ? "inactive" : ""}`} playsInline muted />
            {imageUrl && <img ref={imageRef} className="camera-feed uploaded" src={imageUrl} alt="Your uploaded portrait" onLoad={() => setImageLoaded(true)} />}
            <canvas ref={canvasRef} className="effect-canvas" aria-hidden="true" />
            {!cameraOn && !imageUrl && <div className="camera-placeholder"><div className="placeholder-moon">☾</div><div className="placeholder-stars">✦　✧　✦</div><div className="placeholder-copy"><strong>YOUR PORTRAIT<br />GOES HERE</strong><span>Start the camera or upload a photo</span></div><div className="placeholder-pumpkin">🎃</div></div>}
            <div className="frame-shade" />
            <div className="frame-topline"><span className="rec-dot" /> <span>{cameraOn ? "LIVE PREVIEW" : imageUrl ? "PHOTO READY" : "CAMERA STANDBY"}</span><span className="frame-id">AFTERGLOW · 001</span></div>
            <div className="frame-sparkle sparkle-one">✦</div><div className="frame-sparkle sparkle-two">✧</div>
            <div className="frame-caption"><span>{tracking}</span><strong>{activeFilter.emoji} &nbsp;{activeFilter.name}</strong></div>
            <button className="flip-button" onClick={toggleCamera} aria-label="Switch camera" title="Switch camera">↻</button>
            {photoUrl && <div className="captured-badge"><span>✓</span> PHOTO CAPTURED</div>}
          </div>

          <div className="camera-controls">
            <label className="upload-button" title="Upload a photo"><input type="file" accept="image/*" onChange={uploadPhoto} /><span className="upload-icon">↥</span><span>UPLOAD</span></label>
            <button className="shutter" onClick={capture} aria-label="Take a photo"><span className="shutter-inner" /></button>
            {photoUrl ? <a className="download-button" href={photoUrl} download={`afterglow-${activeFilter.id}.png`}><span className="download-icon">↓</span><span>SAVE PHOTO</span></a> : <button className="save-placeholder" onClick={cameraOn || imageUrl ? capture : () => void startCamera()}><span className="download-icon">↗</span><span>{cameraOn || imageUrl ? "TAKE PHOTO" : "START CAMERA"}</span></button>}
          </div>
          {message && <p className="camera-message" role="status">{message}</p>}
          {!cameraOn && !imageUrl && <button className="start-link" onClick={() => void startCamera()}>Allow camera access <span>↗</span></button>}
          <div className="permission-note"><span>⌑</span> Your photos stay on this device</div>
          <canvas ref={photoCanvasRef} className="hidden-canvas" />
        </div>

        <aside className="filter-panel">
          <div className="filter-panel-heading"><div><div className="eyebrow"><span>✧</span> FACE TRACKING EFFECTS</div><h2>Choose a <em>look.</em></h2></div><span className="filter-count">05<br /><i>EFFECTS</i></span></div>
          <div className="filter-list" role="radiogroup" aria-label="Halloween face effects">
            {filters.map((filter, index) => <button key={filter.id} className={`filter-card ${activeFilter.id === filter.id ? "selected" : ""}`} onClick={() => { if (photoUrl) URL.revokeObjectURL(photoUrl); setActiveFilter(filter); setPhotoUrl(null); }} role="radio" aria-checked={activeFilter.id === filter.id}>
              <span className={`filter-swatch swatch-${filter.id}`}><span className="swatch-glow" /> <span className="swatch-emoji">{filter.emoji}</span><span className="swatch-no">0{index + 1}</span></span>
              <span className="filter-name-wrap"><strong>{filter.name}</strong><small>{filter.mood}</small></span>
              <span className="filter-arrow">↗</span>
            </button>)}
          </div>
          <div className="filter-tip"><span className="tip-spark">✳</span><p><strong>Move your face</strong><br />The effect follows along as you turn, smile, and pose.</p></div>
          <div className="panel-footer"><span>LIVE FACE TRACKING · IN YOUR BROWSER</span><span>✦</span></div>
        </aside>
      </section>

      <footer className="page-footer"><span>AFTERGLOW PHOTO BOOTH</span><span className="footer-center">A LITTLE MAGIC, RIGHT WHERE YOU ARE <i>✦</i></span><span>HAPPY HAUNTING <span className="footer-pumpkin">☻</span></span></footer>
    </main>
  );
}
