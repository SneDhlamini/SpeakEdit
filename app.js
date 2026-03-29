// ═══════════════════════════════════════════════════════════════
// app.js — App bootstrap & camera initialisation
// ═══════════════════════════════════════════════════════════════

let stream = null;

async function initApp() {
  document.getElementById('startOverlay').style.display = 'none';
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 1280, height: 720 },
      audio: true
    });
    const cam = document.getElementById('cameraFeed');
    cam.style.display = 'block';
    cam.srcObject = stream;
    document.getElementById('faceGuide').style.display = 'block';
    startFaceDetection();
    speakIntro();
  } catch (e) {
    showToast('Camera/mic permission denied. Please allow access and reload.', 5000);
    speak("Camera permission denied. Please allow access and reload the page.");
  }
  initSpeechRecognition();
  startListening();
}

// Mic orb toggle
document.getElementById('micOrb').onclick = () => {
  isListening ? stopListening() : startListening();
};