"use strict";

const videoEl = document.getElementById("video");
const overlayEl = document.getElementById("overlay");
const logoEl = document.getElementById("logo");
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

const FRAME_TITLE_LINES = [
  "શ્રી દામજીભાઈ પદમશી શાહ પાઠશાળાના",
  "રિયુનિયન પ્રોગ્રામની યાદી"
];

let overlayReady = false;
let logoReady = false;
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

function setupImageStatus(imageEl, onReady, onError) {
  imageEl.crossOrigin = "anonymous";

  if (imageEl.complete) {
    if (imageEl.naturalWidth > 0) {
      onReady();
    } else {
      onError();
    }
  }

  imageEl.addEventListener("load", onReady);
  imageEl.addEventListener("error", onError);
}

function setupOverlay() {
  setupImageStatus(
    overlayEl,
    () => { overlayReady = true; },
    () => { overlayReady = false; setError("Overlay failed to load. Check assets/overlay.png."); }
  );
}

function setupLogo() {
  setupImageStatus(
    logoEl,
    () => { logoReady = true; },
    () => { logoReady = false; }
  );
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
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1920 }
      }
    });
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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runCountdown() {
  countdownEl.classList.remove("hidden");
  for (const number of [3, 2, 1]) {
    countdownEl.textContent = String(number);
    await wait(650);
  }
  countdownEl.classList.add("hidden");
}

function drawVisibleSquare(ctx, frameRect, outputSize) {
  const videoWidth = videoEl.videoWidth;
  const videoHeight = videoEl.videoHeight;
  if (!videoWidth || !videoHeight) throw new Error("Video frame not ready");

  const frameAspect = frameRect.width / frameRect.height;
  const videoAspect = videoWidth / videoHeight;
  let sx = 0;
  let sy = 0;
  let sWidth = videoWidth;
  let sHeight = videoHeight;

  if (videoAspect > frameAspect) {
    sWidth = videoHeight * frameAspect;
    sx = (videoWidth - sWidth) / 2;
  } else {
    sHeight = videoWidth / frameAspect;
    sy = (videoHeight - sHeight) / 2;
  }

  const isMirrored = videoEl.style.transform.includes("-1");
  if (isMirrored) {
    ctx.translate(outputSize, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(videoEl, sx, sy, sWidth, sHeight, 0, 0, outputSize, outputSize);
  if (isMirrored) ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (overlayReady) {
    const overlayRect = overlayEl.getBoundingClientRect();
    const scale = outputSize / frameRect.width;
    ctx.drawImage(
      overlayEl,
      (overlayRect.left - frameRect.left) * scale,
      (overlayRect.top - frameRect.top) * scale,
      overlayRect.width * scale,
      overlayRect.height * scale
    );
  }
}

function drawRoundedBorder(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawFramedSelfie(squareCanvas, outputSize) {
  const margin = Math.round(outputSize * 0.055);
  const footerHeight = Math.round(outputSize * 0.25);
  const borderRadius = Math.round(outputSize * 0.035);
  const finalWidth = outputSize + margin * 2;
  const finalHeight = outputSize + margin * 2 + footerHeight;
  canvasEl.width = finalWidth;
  canvasEl.height = finalHeight;

  const ctx = canvasEl.getContext("2d", { alpha: false });
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(0, 0, finalWidth, finalHeight);

  ctx.save();
  drawRoundedBorder(ctx, margin, margin, outputSize, outputSize, borderRadius);
  ctx.clip();
  ctx.drawImage(squareCanvas, margin, margin, outputSize, outputSize);
  ctx.restore();

  ctx.strokeStyle = "#b00020";
  ctx.lineWidth = Math.max(6, Math.round(outputSize * 0.009));
  drawRoundedBorder(ctx, margin / 2, margin / 2, finalWidth - margin, finalHeight - margin, borderRadius * 1.4);
  ctx.stroke();

  ctx.strokeStyle = "#d99a23";
  ctx.lineWidth = Math.max(3, Math.round(outputSize * 0.005));
  drawRoundedBorder(ctx, margin * 0.72, margin * 0.72, finalWidth - margin * 1.44, finalHeight - margin * 1.44, borderRadius * 1.2);
  ctx.stroke();

  const footerY = margin + outputSize;
  ctx.strokeStyle = "#d99a23";
  ctx.lineWidth = Math.max(3, Math.round(outputSize * 0.004));
  ctx.beginPath();
  ctx.moveTo(margin, footerY + margin * 0.5);
  ctx.lineTo(finalWidth - margin, footerY + margin * 0.5);
  ctx.stroke();

  const logoSize = Math.round(footerHeight * 0.72);
  const logoX = margin;
  const logoY = footerY + Math.round((footerHeight - logoSize) / 2) + Math.round(margin * 0.2);
  if (logoReady) {
    ctx.drawImage(logoEl, logoX, logoY, logoSize, logoSize);
  }

  const textLeft = logoReady ? logoX + logoSize + margin * 0.45 : margin;
  const textWidth = finalWidth - textLeft - margin;
  ctx.fillStyle = "#9d0015";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(outputSize * 0.04)}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(FRAME_TITLE_LINES[0], textLeft + textWidth / 2, footerY + footerHeight * 0.42, textWidth);
  ctx.font = `700 ${Math.round(outputSize * 0.045)}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(FRAME_TITLE_LINES[1], textLeft + textWidth / 2, footerY + footerHeight * 0.67, textWidth);

  return canvasEl.toDataURL("image/png");
}

function drawCapture() {
  const frameRect = captureFrameEl.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
  const squareSize = Math.round(frameRect.width * dpr);
  const squareCanvas = document.createElement("canvas");
  squareCanvas.width = squareSize;
  squareCanvas.height = squareSize;
  const squareCtx = squareCanvas.getContext("2d", { alpha: false });

  drawVisibleSquare(squareCtx, frameRect, squareSize);
  return drawFramedSelfie(squareCanvas, squareSize);
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
    const file = new File([blob], "reunion-selfie.png", { type: "image/png" });
    if (navigator.canShare && !navigator.canShare({ files: [file] })) return setError("Cannot share image file on this device.");
    await navigator.share({ title: "Selfie", files: [file] });
  } catch {}
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
window.addEventListener("beforeunload", stopStream);

setupOverlay();
setupLogo();
startCamera();
