// ═══════════════════════════════════════════════════════════════
// recorder.js — MediaRecorder capture & clip management
// ═══════════════════════════════════════════════════════════════

let mediaRecorder   = null;
let recordedChunks  = [];
let isRecording     = false;
let recInterval     = null;
let recSeconds      = 0;
const MAX_REC_SECS  = 120;

// ── Start recording ────────────────────────────────────────────
function startRecording() {
  if (isRecording)  { speak("Already recording."); return; }
  if (!stream)      { speak("Camera not ready."); return; }

  saveHistory();
  recordedChunks = [];

  const opts = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? { mimeType: 'video/webm;codecs=vp9' } : {};

  mediaRecorder = new MediaRecorder(stream, opts);
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = finaliseClip;
  mediaRecorder.start(100);
  isRecording = true;

  // Mute all TTS and face-direction audio during recording
  window._recordingMuted = true;
  speechSynthesis.cancel();           // stop any ongoing speech immediately

  recSeconds = 0;
  document.getElementById('recHud').style.display = 'flex';
  document.getElementById('countdownBar').style.display = 'block';
  animateCountdown();

  recInterval = setInterval(() => {
    recSeconds++;
    const m = String(Math.floor(recSeconds / 60)).padStart(2, '0');
    const s = String(recSeconds % 60).padStart(2, '0');
    document.getElementById('recTime').textContent = `${m}:${s}`;
    if (recSeconds >= MAX_REC_SECS) stopRecording();
  }, 1000);

  showToast("🔴 Recording…");
}

// ── Stop recording ─────────────────────────────────────────────
function stopRecording() {
  if (!isRecording) { speak("Not currently recording."); return; }
  clearInterval(recInterval);
  isRecording = false;
  mediaRecorder.stop();
  document.getElementById('recHud').style.display = 'none';
  document.getElementById('countdownBar').style.display = 'none';

  // Un-mute TTS — give the browser one tick to finish stopping the recorder
  setTimeout(() => {
    window._recordingMuted = false;
    speak("Recording stopped. Clip saved.");
  }, 100);
}

// ── Animate the red countdown bar ─────────────────────────────
function animateCountdown() {
  const bar = document.getElementById('countdownBar');
  bar.style.transition = 'none';
  bar.style.transform  = 'scaleX(1)';
  requestAnimationFrame(() => {
    bar.style.transition = `transform ${MAX_REC_SECS}s linear`;
    bar.style.transform  = 'scaleX(0)';
  });
}

// ── Save recorded blob as a clip object ────────────────────────
function finaliseClip() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const url  = URL.createObjectURL(blob);
  const id   = Date.now();
  const name = `Clip ${clips.length + 1}`;

  clips.push({ id, blob, url, duration: recSeconds, name });
  selectedClipIdx = clips.length - 1;
  renderClips();
  renderTimeline();
  showToast(`✅ ${name} saved (${formatDur(recSeconds)})`);
}