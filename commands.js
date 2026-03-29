// ═══════════════════════════════════════════════════════════════
// commands.js — Voice command parser & keyboard shortcuts
// ═══════════════════════════════════════════════════════════════

// ── Parse recognised speech into actions ──────────────────────
function handleCommand(cmd) {
  cmd = cmd.toLowerCase().trim();

  if      (cmd.includes('start record') || cmd.includes('begin record') || cmd === 'record') {
    if (!isRecording) voiceCmd('start recording');

  } else if (cmd.includes('stop record') || cmd.includes('end record') || cmd.includes('finish record')) {
    voiceCmd('stop recording');

  } else if (cmd === 'play' || cmd.includes('play clip') || cmd.startsWith('play ')) {
    voiceCmd('play');

  } else if (cmd === 'pause' || cmd === 'stop' || cmd === 'stop playing') {
    voiceCmd('pause');

  } else if (cmd === 'cut' || cmd.includes('cut here') || cmd.includes('cut clip')) {
    voiceCmd('cut');

  } else if (cmd.includes('delete clip') || cmd.includes('remove clip') || cmd.includes('delete this')) {
    voiceCmd('delete clip');

  } else if (cmd.includes('undo') || cmd.includes('go back')) {
    voiceCmd('undo');

  } else if (cmd.includes('export') || cmd.includes('download') || cmd.includes('save video')) {
    exportAll();

  } else if (cmd.includes('next clip') || cmd.includes('next video')) {
    nextClip();

  } else if (cmd.includes('previous clip') || cmd.includes('prev clip') || cmd.includes('last clip')) {
    prevClip();

  } else if (cmd.includes('select clip') || cmd.includes('clip number') || cmd.includes('go to clip')) {
    const match = cmd.match(/\d+/);
    if (match) selectClip(parseInt(match[0]));
    else speak("Please say which clip number. For example: select clip 2.");

  } else if (cmd.includes('add song') || cmd.includes('add music') || cmd.includes('music on')) {
    voiceCmd('add song');

  } else if (cmd.includes('remove song') || cmd.includes('remove music') || cmd.includes('music off')) {
    voiceCmd('remove song');

  } else if (cmd === 'help' || cmd.includes('what can you do') || cmd.includes('commands')) {
    speak("Commands: start recording, stop recording, play, pause, cut, delete clip, select clip 1 through 9, next clip, previous clip, undo, add song, remove song, export, and help.");
  }
}

// ── Dispatch named commands (used by buttons & voice parser) ───
function voiceCmd(cmd) {
  switch (cmd) {
    case 'start recording': startRecording();   break;
    case 'stop recording':  stopRecording();    break;
    case 'play':            playSelectedClip(); break;
    case 'pause':           pausePlayback();    break;
    case 'cut':             cutClip();          break;
    case 'delete clip':     deleteClip();       break;
    case 'add song':        addSongToClip();    break;
    case 'remove song':     removeSongFromClip(); break;
  }
}

// ── Keyboard shortcuts (fallback) ─────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space'   && !isRecording)            { e.preventDefault(); voiceCmd('start recording'); }
  if (e.code === 'Space'   && isRecording)             { e.preventDefault(); voiceCmd('stop recording'); }
  if (e.code === 'KeyP')                               { playSelectedClip(); }
  if (e.code === 'KeyC')                               { cutClip(); }
  if (e.code === 'Delete'  || e.code === 'Backspace')  { deleteClip(); }
  if (e.code === 'KeyZ'    && (e.ctrlKey || e.metaKey)){ undo(); }
});