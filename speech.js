// ═══════════════════════════════════════════════════════════════
// speech.js — TTS + Speech Recognition
// ═══════════════════════════════════════════════════════════════

let recognition = null;
let isListening = false;

// ── Text-to-speech (command feedback — always interrupts) ──────
function speak(text) {
  if (!window.speechSynthesis) return;
  if (window._recordingMuted) return;          // silent during recording
  showToast(`🔊 ${text}`, 3500);
  document.getElementById('cmdDisplay').textContent = `🔊 ${text.slice(0, 35)}…`;
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 1.05; utt.pitch = 1; utt.volume = 1;
  utt.voice = getPreferredVoice();
  speechSynthesis.cancel();
  speechSynthesis.speak(utt);
}

// ── TTS for face directions — queues, never interrupts commands ─
function speakDirection(text) {
  if (!window.speechSynthesis) return;
  if (window._recordingMuted) return;          // silent during recording
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 1.05; utt.pitch = 1; utt.volume = 0.9;
  utt.voice = getPreferredVoice();
  speechSynthesis.speak(utt);
}

// ── Startup voice walkthrough ──────────────────────────────────
function speakIntro() {
  if (!window.speechSynthesis) return;
  const lines = [
    "Welcome to SpeakToEdit — your hands-free video editor.",
    "Here are your voice commands.",
    "Say: start recording — to begin capturing.",
    "Say: stop recording — to save the clip.",
    "Say: play — to watch the selected clip.",
    "Say: pause — to stop playback.",
    "Say: cut — to split the clip at the playhead.",
    "Say: delete clip — to remove the selected clip.",
    "Say: select clip, followed by a number — to choose a clip.",
    "Say: next clip or previous clip — to navigate.",
    "Say: undo — to reverse your last action.",
    "Say: export — to download your clips.",
    "Say: help — at any time to hear these commands again.",
    "Now, please centre yourself in the frame. I will guide you."
  ];
  speechSynthesis.cancel();
  lines.forEach((text, i) => {
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = i === 0 ? 0.95 : 1.05;
    utt.pitch = 1; utt.volume = 1;
    utt.voice = getPreferredVoice();
    speechSynthesis.speak(utt);
  });
}

function getPreferredVoice() {
  const voices = speechSynthesis.getVoices();
  return voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
         voices.find(v => v.lang.startsWith('en')) || null;
}

// Trigger voice list load
window.speechSynthesis && (window.speechSynthesis.onvoiceschanged = () => {});

// ── Speech Recognition ─────────────────────────────────────────
function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Speech recognition not supported. Please use Chrome.', 6000); return; }

  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = e => {
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
    }
    if (final.trim()) {
      const cmd = final.trim().toLowerCase();
      document.getElementById('cmdDisplay').textContent = `"${cmd}"`;
      handleCommand(cmd);
    }
  };

  recognition.onerror = e => { if (e.error === 'no-speech') return; console.warn('SR error:', e.error); };
  recognition.onend   = () => { if (isListening) setTimeout(() => { try { recognition.start(); } catch(e) {} }, 300); };
}

function startListening() {
  if (!recognition) return;
  isListening = true;
  try { recognition.start(); } catch(e) {}
  document.getElementById('micOrb').classList.add('listening');
}

function stopListening() {
  isListening = false;
  try { recognition.stop(); } catch(e) {}
  document.getElementById('micOrb').classList.remove('listening');
}