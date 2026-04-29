"use strict";

const videoEl = document.getElementById("video");
const overlayEl = document.getElementById("overlay");
const captureFrameEl = document.getElementById("captureFrame");
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

function setError(message) { errorEl.textContent = message; errorEl.classList.remove("hidden"); }
function clearError() { errorEl.classList.add("hidden"); errorEl.textContent = ""; }

function setupOverlay() {
  overlayEl.crossOrigin = "anonymous";
  const onLoad = () => { overlayReady = overlayEl.naturalWidth > 0; };
  const onError = () => { overlayReady = false; setError("Overlay failed to load. Check assets/overlay.png."); };
  if (overlayEl.complete) overlayEl.naturalWidth > 0 ? onLoad() : onError();
  overlayEl.addEventListener("load", onLoad);
  overlayEl.addEventListener("error", onError);
}

function stopStream() {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
  stream = undefined;
}

async function startCamera() {
  clearError();
  if (!navigator.mediaDevices?.getUserMedia) return setError("Camera access unsupported.");
  loadingEl.classList.remove("hidden");
  stopStream();

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1920 } } });
    videoEl.srcObject = stream;
    await videoEl.play();
    loadingEl.classList.add("hidden");

    const [track] = stream.getVideoTracks();
    const settings = track?.getSettings?.() || {};
    const isUser = settings.facingMode === "user" || facingMode === "user";
    videoEl.style.transform = isUser ? "scaleX(-1)" : "none";
  } catch (error) {
    loadingEl.classList.add("hidden");
    if (error?.name === "NotAllowedError") setError("Camera permission denied.");
    else setError("Unable to access camera. Use HTTPS and allow camera.");
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function runCountdown() {
  countdownEl.classList.remove("hidden");
  for (const n of [3, 2, 1]) { countdownEl.textContent = String(n); await wait(650); }
  countdownEl.classList.add("hidden");
}

function drawCapture() {
  const frameRect = captureFrameEl.getBoundingClientRect();
  const videoRect = videoEl.getBoundingClientRect();
  const videoWidth = videoEl.videoWidth;
  const videoHeight = videoEl.videoHeight;
  if (!videoWidth || !videoHeight) throw new Error("Video frame not ready");

  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
  const outW = Math.round(frameRect.width * dpr);
  const outH = Math.round(frameRect.height * dpr);
  canvasEl.width = outW;
  canvasEl.height = outH;
  const ctx = canvasEl.getContext("2d", { alpha: false });

  const frameAspect = frameRect.width / frameRect.height;
  const vidAspect = videoWidth / videoHeight;
  let sx = 0, sy = 0, sWidth = videoWidth, sHeight = videoHeight;
  if (vidAspect > frameAspect) { sWidth = videoHeight * frameAspect; sx = (videoWidth - sWidth) / 2; }
  else { sHeight = videoWidth / frameAspect; sy = (videoHeight - sHeight) / 2; }

  const isMirrored = videoEl.style.transform.includes("-1");
  if (isMirrored) { ctx.translate(outW, 0); ctx.scale(-1, 1); }
  ctx.drawImage(videoEl, sx, sy, sWidth, sHeight, 0, 0, outW, outH);
  if (isMirrored) ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (overlayReady) {
    const oRect = overlayEl.getBoundingClientRect();
    const dx = (oRect.left - frameRect.left) * dpr;
    const dy = (oRect.top - frameRect.top) * dpr;
    const dWidth = oRect.width * dpr;
    const dHeight = oRect.height * dpr;
    ctx.drawImage(overlayEl, dx, dy, dWidth, dHeight);
  }

  return canvasEl.toDataURL("image/png");
}

async function capture() {
  if (captureInProgress) return;
  captureInProgress = true;
  captureBtn.disabled = true;
  try {
    await runCountdown();
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
  if (!resultImageEl.src || !navigator.share) return setError("Share not available.");
  try {
    const blob = await (await fetch(resultImageEl.src)).blob();
    const file = new File([blob], "selfie-overlay.png", { type: "image/png" });
    if (navigator.canShare && !navigator.canShare({ files: [file] })) return setError("Cannot share image file on this device.");
    await navigator.share({ title: "Selfie", files: [file] });
  } catch {}
}

captureBtn.addEventListener("click", capture);
flipBtn.addEventListener("click", async () => { facingMode = facingMode === "user" ? "environment" : "user"; await startCamera(); });
shareBtn.addEventListener("click", shareImage);
retakeBtn.addEventListener("click", async () => { resultScreen.classList.add("hidden"); cameraScreen.classList.remove("hidden"); await startCamera(); });
window.addEventListener("beforeunload", stopStream);

setupOverlay();
startCamera();
