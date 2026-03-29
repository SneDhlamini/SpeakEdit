// ═══════════════════════════════════════════════════════════════
// editor.js — Clip state, playback, editing & export
// ═══════════════════════════════════════════════════════════════

let clips           = [];
let selectedClipIdx = -1;
let history         = [];   // undo stack

// ── Song overlay Audio element ─────────────────────────────────
let songAudio = null;

function stopSongAudio() {
  if (songAudio) { songAudio.pause(); songAudio.currentTime = 0; }
}

// ── Playback ───────────────────────────────────────────────────
function playSelectedClip() {
  if (selectedClipIdx < 0 || selectedClipIdx >= clips.length) {
    speak("No clip selected. Say select clip 1 to choose one."); return;
  }
  const clip = clips[selectedClipIdx];
  const cam  = document.getElementById('cameraFeed');
  const vid  = document.getElementById('mainVideo');

  stopSongAudio();

  cam.style.display = 'none';
  vid.style.display = 'block';
  vid.src = clip.url;
  if (clip.cutStart) vid.currentTime = clip.cutStart;
  vid.play();

  // Play song overlay if assigned
  if (clip.song) {
    if (!songAudio) songAudio = new Audio();
    songAudio.src    = clip.song.url;
    songAudio.volume = 0.4;
    songAudio.loop   = false;
    songAudio.play().catch(() => {});
    showToast(`▶ ${clip.name} 🎵 ${clip.song.title}`);
  } else {
    showToast(`▶ ${clip.name}`);
  }

  speak(`Playing ${clip.name}`);
  vid.ontimeupdate = updatePlayhead;
  vid.onended = () => { stopSongAudio(); };
  highlightTimelineClip(selectedClipIdx, true);
}

function pausePlayback() {
  const vid = document.getElementById('mainVideo');
  if (!vid.paused) { vid.pause(); stopSongAudio(); speak("Paused."); }
  else             { speak("Not playing."); }
}

function updatePlayhead() {
  const vid    = document.getElementById('mainVideo');
  const track  = document.getElementById('timelineTrack');
  const totalW = track.scrollWidth - 32;
  const totalDur = clips.reduce((s, c) => s + c.duration, 0);
  if (!totalDur) return;
  const elapsed = clips.slice(0, selectedClipIdx).reduce((s, c) => s + c.duration, 0) + vid.currentTime;
  document.getElementById('playhead').style.left = (16 + (elapsed / totalDur) * totalW) + 'px';
}

// ── Cut at playhead — re-encodes two real separate blobs ──────
function cutClip() {
  if (selectedClipIdx < 0 || selectedClipIdx >= clips.length) {
    speak("No clip selected to cut."); return;
  }
  const vid         = document.getElementById('mainVideo');
  const currentTime = vid.currentTime || 0;
  const clip        = clips[selectedClipIdx];
  const cutAt       = currentTime;                       // absolute time inside this clip
  const clipOffset  = clip.cutStart || 0;                // where this clip starts in the source blob

  if (cutAt <= 0.5 || cutAt >= clip.duration - 0.5) {
    speak("Playhead is too close to the edge to cut."); return;
  }

  speak("Cutting clip. Please wait.");
  showToast("✂ Cutting…");
  saveHistory();

  // Re-encode each segment by playing through a hidden video into a canvas recorder
  const splitIdx = selectedClipIdx;

  encodeSegment(clip, clipOffset, clipOffset + cutAt, clip.name + 'a')
    .then(beforeClip => {
      return encodeSegment(clip, clipOffset + cutAt, clipOffset + clip.duration, clip.name + 'b')
        .then(afterClip => {
          clips.splice(splitIdx, 1, beforeClip, afterClip);
          selectedClipIdx = splitIdx;
          renderClips(); renderTimeline();
          speak(`Cut done. ${beforeClip.name} is ${formatDur(beforeClip.duration)}, ${afterClip.name} is ${formatDur(afterClip.duration)}.`);
          showToast(`✂ Cut at ${formatDur(cutAt)}`);
        });
    })
    .catch(err => {
      console.error('Cut failed:', err);
      speak("Cut failed. Please try again.");
      showToast("✂ Cut failed");
    });
}

// Re-encodes a time segment [startSec, endSec] of a clip's blob into a new blob
function encodeSegment(clip, startSec, endSec, name) {
  return new Promise((resolve, reject) => {
    const duration = endSec - startSec;
    if (duration <= 0) { reject(new Error('Zero-length segment')); return; }

    // Hidden playback elements
    const hiddenVid = document.createElement('video');
    hiddenVid.src   = clip.url;
    hiddenVid.muted = true;
    hiddenVid.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px';
    document.body.appendChild(hiddenVid);

    const canvas  = document.createElement('canvas');
    const chunks  = [];
    let   recorder = null;
    let   rafId    = null;

    hiddenVid.addEventListener('loadedmetadata', () => {
      canvas.width  = hiddenVid.videoWidth  || 1280;
      canvas.height = hiddenVid.videoHeight || 720;
      const ctx = canvas.getContext('2d');

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9' : 'video/webm';

      // Capture audio from the hidden video
      const audioCtx  = new AudioContext();
      const source    = audioCtx.createMediaElementSource(hiddenVid);
      const dest      = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      // Also connect to speakers so ontimeupdate fires correctly (muted at element level)
      const gainNode  = audioCtx.createGain();
      gainNode.gain.value = 0;
      source.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      const videoStream = canvas.captureStream(30);
      const combined    = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);

      recorder = new MediaRecorder(combined, { mimeType });
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        cancelAnimationFrame(rafId);
        document.body.removeChild(hiddenVid);
        audioCtx.close();
        const blob   = new Blob(chunks, { type: 'video/webm' });
        const url    = URL.createObjectURL(blob);
        resolve({ id: Date.now() + Math.random(), blob, url, duration, name, cutStart: 0, song: clip.song || null });
      };

      // Draw loop
      const draw = () => {
        ctx.drawImage(hiddenVid, 0, 0, canvas.width, canvas.height);
        rafId = requestAnimationFrame(draw);
      };

      hiddenVid.currentTime = startSec;
      hiddenVid.addEventListener('seeked', () => {
        recorder.start(100);
        draw();
        hiddenVid.play();
      }, { once: true });

      hiddenVid.ontimeupdate = () => {
        if (hiddenVid.currentTime >= endSec - 0.05) {
          hiddenVid.pause();
          hiddenVid.ontimeupdate = null;
          recorder.stop();
        }
      };
    });

    hiddenVid.addEventListener('error', reject);
    hiddenVid.load();
  });
}

// ── Delete selected clip ───────────────────────────────────────
function deleteClip() {
  if (selectedClipIdx < 0 || selectedClipIdx >= clips.length) {
    speak("No clip selected to delete."); return;
  }
  saveHistory();
  const name = clips[selectedClipIdx].name;
  clips.splice(selectedClipIdx, 1);
  if (selectedClipIdx >= clips.length) selectedClipIdx = clips.length - 1;
  renderClips(); renderTimeline();
  speak(`${name} deleted.`);
  showToast(`🗑 ${name} deleted`);
}

// ── Clip selection ─────────────────────────────────────────────
function selectClip(n) {
  const idx = n - 1;
  if (idx < 0 || idx >= clips.length) { speak(`No clip ${n}.`); return; }
  selectedClipIdx = idx;
  renderClips(); highlightTimelineClip(idx, false);
  speak(`${clips[idx].name} selected.`);
  showToast(`Selected: ${clips[idx].name}`);
}

function nextClip() {
  if (!clips.length) { speak("No clips."); return; }
  selectedClipIdx = (selectedClipIdx + 1) % clips.length;
  renderClips(); highlightTimelineClip(selectedClipIdx, false);
  speak(`${clips[selectedClipIdx].name} selected.`);
}

function prevClip() {
  if (!clips.length) { speak("No clips."); return; }
  selectedClipIdx = (selectedClipIdx - 1 + clips.length) % clips.length;
  renderClips(); highlightTimelineClip(selectedClipIdx, false);
  speak(`${clips[selectedClipIdx].name} selected.`);
}

// ── Undo ───────────────────────────────────────────────────────
function saveHistory() {
  history.push(clips.map(c => ({ ...c, blob: null })));
  if (history.length > 20) history.shift();
}

function undo() {
  if (!history.length) { speak("Nothing to undo."); return; }
  const prev    = history.pop();
  const blobMap = {};
  clips.forEach(c => { if (c.blob) blobMap[c.id] = { blob: c.blob, url: c.url }; });
  clips = prev.map(c => ({ ...c, blob: blobMap[c.id]?.blob || null, url: blobMap[c.id]?.url || c.url }));
  if (selectedClipIdx >= clips.length) selectedClipIdx = clips.length - 1;
  renderClips(); renderTimeline();
  speak("Undo done."); showToast("↩ Undo");
}

// ── Song assignment ────────────────────────────────────────────
// One built-in royalty-free track (Public Domain / CC0)
const BUILT_IN_SONG = {
  title: 'Chill Vibes',
  url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
};

function addSongToClip() {
  if (selectedClipIdx < 0 || selectedClipIdx >= clips.length) {
    speak("No clip selected. Please select a clip first."); return;
  }
  clips[selectedClipIdx].song = BUILT_IN_SONG;
  renderClips();
  speak(`Song "${BUILT_IN_SONG.title}" added to ${clips[selectedClipIdx].name}. Say play to hear it.`);
  showToast(`🎵 Song added to ${clips[selectedClipIdx].name}`);
}

function removeSongFromClip() {
  if (selectedClipIdx < 0 || selectedClipIdx >= clips.length) {
    speak("No clip selected."); return;
  }
  if (!clips[selectedClipIdx].song) {
    speak("This clip has no song."); return;
  }
  clips[selectedClipIdx].song = null;
  stopSongAudio();
  renderClips();
  speak(`Song removed from ${clips[selectedClipIdx].name}.`);
  showToast(`🎵 Song removed`);
}


function exportAll() {
  if (!clips.length) { speak("No clips to export."); return; }
  clips.forEach(clip => {
    if (!clip.blob) return;
    const a = document.createElement('a');
    a.href     = clip.url;
    a.download = `SpeakToEdit_${clip.name.replace(/\s+/g, '_')}.webm`;
    a.click();
  });
  speak(`Exporting ${clips.length} clip${clips.length > 1 ? 's' : ''}.`);
  showToast(`⬇ Exporting ${clips.length} clip(s)…`);
}

// ── Helper ─────────────────────────────────────────────────────
function formatDur(secs) {
  secs = Math.round(secs);
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
}