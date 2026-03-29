// ═══════════════════════════════════════════════════════════════
// face.js — Camera face detection & framing guidance
// ═══════════════════════════════════════════════════════════════

let faceDetectInterval = null;
let faceDetected = false;
let lastSpokenDirection = '';
let directionSpeakTimer = null;
let centredMsgTimer = null;

// ── Start polling the camera feed for skin-tone centroid ───────
function startFaceDetection() {
  const canvas = document.getElementById('faceCanvas');
  const ctx    = canvas.getContext('2d');
  const video  = document.getElementById('cameraFeed');

  faceDetectInterval = setInterval(() => {
    if (!stream) return;
    canvas.width = 320; canvas.height = 240;
    ctx.drawImage(video, 0, 0, 320, 240);
    const data = ctx.getImageData(0, 0, 320, 240).data;

    let skinPixels = 0, totalX = 0, totalY = 0;
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (isSkin(r, g, b)) {
        skinPixels++;
        totalX += (i / 4) % 320;
        totalY += Math.floor((i / 4) / 320);
      }
    }

    if (skinPixels < 60) {
      faceDetected = false;
      showFaceGuide(null, null);
      return;
    }

    faceDetected = true;
    showFaceGuide((totalX / skinPixels) / 320, (totalY / skinPixels) / 240);
  }, 400);
}

// ── Heuristic skin-tone detector ──────────────────────────────
function isSkin(r, g, b) {
  return r > 95 && g > 40 && b > 20 &&
    Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
    Math.abs(r - g) > 15 && r > g && r > b;
}

// ── Update the UI guide overlay and speak directions ───────────
function showFaceGuide(nx, ny) {
  const guide     = document.getElementById('faceGuide');
  const arrow     = document.getElementById('dirArrow');
  const msg       = document.getElementById('faceMsg');
  const centredEl = document.getElementById('centredMsg');

  if (nx === null) {
    guide.classList.remove('centred');
    arrow.style.display = 'none';
    msg.style.display   = 'none';
    centredEl.style.display = 'none';
    return;
  }

  const dx = nx - 0.5;
  const dy = ny - 0.5;
  const tolerance = 0.18;

  if (Math.abs(dx) < tolerance && Math.abs(dy) < tolerance) {
    // ── CENTRED ──────────────────────────────────────────────
    guide.classList.add('centred');
    arrow.style.display = 'none';
    msg.style.display   = 'none';
    centredEl.style.display = 'block';

    clearTimeout(centredMsgTimer);
    centredMsgTimer = setTimeout(() => { centredEl.style.display = 'none'; }, 3000);

    if (lastSpokenDirection !== 'centred') {
      lastSpokenDirection = 'centred';
      clearTimeout(directionSpeakTimer);
      speakDirection("You are centred. Great position. Say start recording whenever you are ready.");
    }

  } else {
    // ── OFF-CENTRE ───────────────────────────────────────────
    guide.classList.remove('centred');
    arrow.style.display = 'block';
    msg.style.display   = 'block';
    centredEl.style.display = 'none';

    let dir, arrowChar;

    if (Math.abs(dx) > Math.abs(dy)) {
      dir       = dx < 0 ? 'right' : 'left';
      arrowChar = dx < 0 ? '→' : '←';
      arrow.style.top    = '50%';
      arrow.style.left   = dx < 0 ? 'unset' : '5%';
      arrow.style.right  = dx < 0 ? '5%'    : 'unset';
      arrow.style.bottom = 'unset';
      arrow.style.transform = 'translateY(-50%)';
    } else {
      dir       = dy < 0 ? 'down' : 'up';
      arrowChar = dy < 0 ? '↓'   : '↑';
      arrow.style.left   = '50%';
      arrow.style.top    = dy < 0 ? 'unset' : '5%';
      arrow.style.bottom = dy < 0 ? '5%'    : 'unset';
      arrow.style.right  = 'unset';
      arrow.style.transform = 'translateX(-50%)';
    }

    arrow.textContent = arrowChar;
    msg.textContent   = `Please move ${dir} to centre yourself`;

    // Debounce: only speak when direction changes, after 800ms stillness
    if (lastSpokenDirection !== dir) {
      lastSpokenDirection = dir;
      clearTimeout(directionSpeakTimer);
      directionSpeakTimer = setTimeout(() => {
        speakDirection(`Move ${dir} to centre yourself.`);
      }, 800);
    }
  }
}