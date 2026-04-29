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
  const videoWidth = videoEl.videoWidth;
  const videoHeight = videoEl.videoHeight;

  if (!videoWidth || !videoHeight) {
    throw new Error("Video frame not ready.");
  }

  canvasEl.width = videoWidth;
  canvasEl.height = videoHeight;

  const ctx = canvasEl.getContext("2d", { alpha: false, willReadFrequently: false });

  const isMirrored = videoEl.style.transform.includes("-1");
  if (isMirrored) {
    ctx.translate(videoWidth, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(videoEl, 0, 0, videoWidth, videoHeight);

  if (isMirrored) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  const vRect = videoEl.getBoundingClientRect();
  const oRect = overlayEl.getBoundingClientRect();

  const scaleX = videoWidth / vRect.width;
  const scaleY = videoHeight / vRect.height;

  const dx = (oRect.left - vRect.left) * scaleX;
  const dy = (oRect.top - vRect.top) * scaleY;
  const dWidth = oRect.width * scaleX;
  const dHeight = oRect.height * scaleY;

  ctx.drawImage(overlayEl, dx, dy, dWidth, dHeight);

  return canvasEl.toDataURL("image/png");
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

startCamera();
