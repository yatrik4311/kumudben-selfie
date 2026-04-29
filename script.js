"use strict";

const videoEl = document.getElementById("video");
const overlayEl = document.getElementById("overlay");
const captureBtn = document.getElementById("captureBtn");
const flipBtn = document.getElementById("flipBtn");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const countdownEl = document.getElementById("countdown");
const canvasEl = document.getElementById("captureCanvas");
const cameraScreen = document.getElementById("cameraScreen");
const resultScreen = document.getElementById("resultScreen");
const resultImageEl = document.getElementById("resultImage");
const downloadBtn = document.getElementById("downloadBtn");
const shareBtn = document.getElementById("shareBtn");
const retakeBtn = document.getElementById("retakeBtn");

let overlayReady = false;

let stream;
let facingMode = "user";
let captureInProgress = false;

function setError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function clearError() {
  errorEl.classList.add("hidden");
  errorEl.textContent = "";
}


function setupOverlay() {
  // Helps when using a CDN URL for overlay (requires server CORS headers).
  overlayEl.crossOrigin = "anonymous";

  const onOverlayLoad = () => {
    overlayReady = overlayEl.naturalWidth > 0 && overlayEl.naturalHeight > 0;
    if (overlayReady) {
      clearError();
    }
  };

  const onOverlayError = () => {
    overlayReady = false;
    setError("Overlay image failed to load. Check assets/overlay.png path or CORS on remote URL.");
  };

  if (overlayEl.complete) {
    if (overlayEl.naturalWidth > 0) {
      onOverlayLoad();
    } else {
      onOverlayError();
    }
  }

  overlayEl.addEventListener("load", onOverlayLoad);
  overlayEl.addEventListener("error", onOverlayError);
}
function stopStream() {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
  stream = undefined;
}

async function startCamera() {
  clearError();

  if (!navigator.mediaDevices?.getUserMedia) {
    setError("Your browser does not support camera access.");
    loadingEl.classList.add("hidden");
    return;
  }

  loadingEl.classList.remove("hidden");

  stopStream();

  const constraints = {
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1080 },
      height: { ideal: 1920 }
    }
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = stream;
    await videoEl.play();
    loadingEl.classList.add("hidden");

    if (!overlayReady) {
      setError("Overlay not loaded yet. Check image path/CORS or wait a moment.");
    }

    const [track] = stream.getVideoTracks();
    const settings = track?.getSettings?.() || {};
    const isUser = settings.facingMode === "user" || facingMode === "user";
    videoEl.style.transform = isUser ? "scaleX(-1)" : "none";
  } catch (error) {
    loadingEl.classList.add("hidden");
    if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
      setError("Camera permission denied. Please enable it and reload.");
    } else {
      setError("Unable to access camera. Ensure you opened this page over HTTPS.");
    }
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCountdown() {
  countdownEl.classList.remove("hidden");
  for (const value of [3, 2, 1]) {
    countdownEl.textContent = String(value);
    await wait(650);
  }
  countdownEl.classList.add("hidden");
}

async function beep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = 760;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.12);
  } catch {
    // Sound is optional; ignore if blocked.
  }
}

function drawCapture() {
  const previewRect = videoEl.getBoundingClientRect();
  const videoWidth = videoEl.videoWidth;
  const videoHeight = videoEl.videoHeight;

  if (!videoWidth || !videoHeight || !previewRect.width || !previewRect.height) {
    throw new Error("Video frame not ready.");
  }

  // Preserve what user actually sees (object-fit: cover) and keep high quality.
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
  const outputWidth = Math.round(previewRect.width * dpr);
  const outputHeight = Math.round(previewRect.height * dpr);
  canvasEl.width = outputWidth;
  canvasEl.height = outputHeight;

  const ctx = canvasEl.getContext("2d", { alpha: false, willReadFrequently: false });

  // Compute crop region of the video that corresponds to object-fit: cover.
  const previewAspect = previewRect.width / previewRect.height;
  const videoAspect = videoWidth / videoHeight;

  let sx = 0;
  let sy = 0;
  let sWidth = videoWidth;
  let sHeight = videoHeight;

  if (videoAspect > previewAspect) {
    // Video is wider than preview: crop left/right.
    sWidth = videoHeight * previewAspect;
    sx = (videoWidth - sWidth) / 2;
  } else {
    // Video is taller than preview: crop top/bottom.
    sHeight = videoWidth / previewAspect;
    sy = (videoHeight - sHeight) / 2;
  }

  const isMirrored = videoEl.style.transform.includes("-1");
  if (isMirrored) {
    ctx.translate(outputWidth, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(videoEl, sx, sy, sWidth, sHeight, 0, 0, outputWidth, outputHeight);

  if (isMirrored) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  const overlayRect = overlayEl.getBoundingClientRect();
  if (overlayReady && overlayRect.width > 0 && overlayRect.height > 0) {
    const dx = (overlayRect.left - previewRect.left) * dpr;
    const dy = (overlayRect.top - previewRect.top) * dpr;
    const dWidth = overlayRect.width * dpr;
    const dHeight = overlayRect.height * dpr;
    ctx.drawImage(overlayEl, dx, dy, dWidth, dHeight);
  }

  try {
    return canvasEl.toDataURL("image/png");
  } catch (error) {
    if (error?.name === "SecurityError" && overlayReady) {
      overlayReady = false;
      setError("Overlay host blocks canvas export (CORS). Capturing photo without overlay.");
      return canvasEl.toDataURL("image/png");
    }
    throw error;
  }
}

async function capture() {
  if (captureInProgress) return;
  captureInProgress = true;
  captureBtn.disabled = true;

  try {
    await runCountdown();
    await beep();
    const dataUrl = drawCapture();

    resultImageEl.src = dataUrl;
    downloadBtn.href = dataUrl;

    cameraScreen.classList.add("hidden");
    resultScreen.classList.remove("hidden");
  } catch {
    setError("Capture failed. Please try again.");
  } finally {
    captureBtn.disabled = false;
    captureInProgress = false;
  }
}

async function shareImage() {
  const dataUrl = resultImageEl.src;
  if (!dataUrl) return;

  if (!navigator.share) {
    setError("Sharing is not available on this browser.");
    return;
  }

  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const file = new File([blob], "selfie-overlay.png", { type: "image/png" });

    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      setError("This device does not support sharing image files.");
      return;
    }

    await navigator.share({
      title: "Selfie with Overlay",
      text: "Check out my selfie!",
      files: [file]
    });
  } catch {
    // User may cancel share UI.
  }
}

captureBtn.addEventListener("click", capture);
flipBtn.addEventListener("click", async () => {
  facingMode = facingMode === "user" ? "environment" : "user";
  await startCamera();
});
shareBtn.addEventListener("click", shareImage);
retakeBtn.addEventListener("click", async () => {
  resultScreen.classList.add("hidden");
  cameraScreen.classList.remove("hidden");
  await startCamera();
});

window.addEventListener("orientationchange", () => {
  // Overlay uses CSS centering + responsive sizing and stays aligned.
});

window.addEventListener("beforeunload", stopStream);

setupOverlay();
startCamera();
