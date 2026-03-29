// ═══════════════════════════════════════════════════════════════
// ui.js — Render clips list, timeline & toast
// ═══════════════════════════════════════════════════════════════

// ── Clips sidebar list ─────────────────────────────────────────
function renderClips() {
  const list  = document.getElementById('clipsList');
  const noMsg = document.getElementById('noClipsMsg');

  if (!clips.length) {
    list.innerHTML = '';
    list.appendChild(noMsg);
    noMsg.style.display = 'block';
    return;
  }

  noMsg.style.display = 'none';
  list.innerHTML = '';

  clips.forEach((clip, i) => {
    const el = document.createElement('div');
    el.className = 'clip-item' + (i === selectedClipIdx ? ' selected' : '');
    el.innerHTML = `
      <div class="clip-thumb">🎬</div>
      <div class="clip-info">
        <div class="clip-name">${clip.name}${clip.song ? ' <span style="color:var(--accent);font-size:10px">🎵</span>' : ''}</div>
        <div class="clip-dur">${formatDur(clip.duration)}</div>
      </div>
      <div class="clip-del" title="Delete">✕</div>`;

    el.querySelector('.clip-del').onclick = e => {
      e.stopPropagation();
      selectedClipIdx = i;
      deleteClip();
    };
    el.onclick = () => {
      selectedClipIdx = i;
      renderClips();
      speak(`${clip.name} selected.`);
    };
    list.appendChild(el);
  });
}

// ── Timeline track ─────────────────────────────────────────────
function renderTimeline() {
  const track = document.getElementById('timelineTrack');
  const ph    = document.getElementById('playhead');
  track.innerHTML = '';
  track.appendChild(ph);

  const totalDur = clips.reduce((s, c) => s + c.duration, 0) || 1;
  const trackW   = Math.max(track.clientWidth - 32, 400);

  clips.forEach((clip, i) => {
    const w  = Math.max(60, (clip.duration / totalDur) * trackW);
    const el = document.createElement('div');
    el.className  = 'tl-clip' + (i === selectedClipIdx ? ' selected-tl' : '');
    el.style.width = w + 'px';
    el.innerHTML  = `<span style="text-align:center">${clip.name}<br>
      <span style="font-size:9px;color:var(--muted)">${formatDur(clip.duration)}</span></span>`;
    el.onclick = () => {
      selectedClipIdx = i;
      renderClips();
      renderTimeline();
      speak(`${clip.name} selected.`);
    };
    track.appendChild(el);
  });
}

// ── Timeline clip highlight ────────────────────────────────────
function highlightTimelineClip(idx, playing) {
  document.querySelectorAll('.tl-clip').forEach((el, i) => {
    el.classList.toggle('active',      playing  && i === idx);
    el.classList.toggle('selected-tl', !playing && i === idx);
  });
}

// ── Toast notification ─────────────────────────────────────────
let toastTimer = null;
function showToast(msg, duration = 2500) {
  const t = document.getElementById('speechToast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.display = 'none'; }, duration);
}