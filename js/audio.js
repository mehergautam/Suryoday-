/* RISE — Audio & Speech Module */

(function (window) {
  let audioCtx = null;
  let droneNodes = []; // References to active synth nodes for stopping
  let droneTimer = null;
  let musicPlaying = false;

  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume context if suspended (common browser security policy)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Bell tones: Create multi-harmonic bell chime
  function playBell(freq, startDelay, duration, gainValue) {
    try {
      const ctx = getAudioContext();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2500;
      filter.connect(ctx.destination);

      // Bell has a fundamental frequency and higher inharmonic partials
      const partials = [1, 2.01, 3.0, 4.2];
      const start = ctx.currentTime + startDelay;

      partials.forEach((mult, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * mult, start);

        const peakGain = gainValue / (index + 1.5);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration - 0.02);

        osc.connect(gain);
        gain.connect(filter);

        osc.start(start);
        osc.stop(start + duration);
      });
    } catch (e) {
      console.warn('Audio Context error during bell play', e);
    }
  }

  // Procedural Music: Synthesize infinite ambient drone music
  function createAmbientDrone() {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Master low-pass filter to make it soft and warm
      const masterFilter = ctx.createBiquadFilter();
      masterFilter.type = 'lowpass';
      masterFilter.frequency.setValueAtTime(450, now);
      masterFilter.Q.setValueAtTime(1.0, now);
      masterFilter.connect(ctx.destination);

      // Slow LFO sweeping the filter frequency to add organic movement
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.06, now); // 1 sweep every 16 seconds
      lfoGain.gain.setValueAtTime(150, now);    // sweep +/- 150 Hz
      lfo.connect(lfoGain);
      lfoGain.connect(masterFilter.frequency);
      lfo.start(now);
      droneNodes.push(lfo);

      // Base drone note: C2 (65.41 Hz) + G2 (97.99 Hz) for nice fifth harmony
      const frequencies = [65.41, 97.99, 130.81, 195.99];
      const droneGain = ctx.createGain();
      droneGain.gain.setValueAtTime(0.0001, now);
      droneGain.gain.linearRampToValueAtTime(0.06, now + 4); // smooth fade in
      droneGain.connect(masterFilter);

      frequencies.forEach(f => {
        const osc = ctx.createOscillator();
        // mix triangle and sine waves for a rich warm pad
        osc.type = Math.random() > 0.5 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f + (Math.random() * 0.4 - 0.2), now); // slight detune

        osc.connect(droneGain);
        osc.start(now);
        droneNodes.push(osc);
      });

      droneNodes.push(droneGain);
      droneNodes.push(masterFilter);

      // Schedule soft high ambient notes (C Major Pentatonic: C4, E4, G4, A4, C5)
      const pentatonic = [261.63, 329.63, 392.00, 440.00, 523.25];

      function playNextSoftNote() {
        if (!musicPlaying) return;
        const now = ctx.currentTime;
        const noteFreq = pentatonic[Math.floor(Math.random() * pentatonic.length)];

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(noteFreq, now);

        gain.gain.setValueAtTime(0.0001, now);
        // extremely slow swell and decay (breathing effect)
        gain.gain.linearRampToValueAtTime(0.015, now + 3);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 9);

        osc.connect(gain);
        gain.connect(masterFilter);

        osc.start(now);
        osc.stop(now + 10);

        // Schedule next random note in 4-7 seconds
        droneTimer = setTimeout(playNextSoftNote, 4000 + Math.random() * 3000);
      }

      playNextSoftNote();
    } catch (e) {
      console.warn('Audio Context error during drone setup', e);
    }
  }

  const AudioService = {
    // 1. Play individual pose transition chime
    playStepChime() {
      const settings = window.RISE_Storage.getSettings();
      if (!settings.musicEnabled) return; // mapped to sound/music preference
      playBell(523.25, 0, 0.8, 0.15); // C5 note
    },

    // 2. Play set completed chime
    playRoundChime() {
      const settings = window.RISE_Storage.getSettings();
      if (!settings.musicEnabled) return;
      playBell(523.25, 0, 0.5, 0.12);
      playBell(659.25, 0.15, 0.6, 0.12); // E5 note
      playBell(783.99, 0.30, 0.9, 0.15); // G5 note
    },

    // 3. Play session complete chime
    playCompleteChime() {
      const settings = window.RISE_Storage.getSettings();
      if (!settings.musicEnabled) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        playBell(f, i * 0.15, 1.2, 0.12);
      });
    },

    // 4. Start procedural meditation music
    startMeditationMusic() {
      const settings = window.RISE_Storage.getSettings();
      if (!settings.musicEnabled || musicPlaying) return;
      musicPlaying = true;
      droneNodes = [];
      createAmbientDrone();
    },

    // 5. Stop procedural meditation music with a quick fade-out
    stopMeditationMusic() {
      if (!musicPlaying) return;
      musicPlaying = false;
      clearTimeout(droneTimer);

      const ctx = getAudioContext();
      const fadeTime = 1.5;

      droneNodes.forEach(node => {
        if (node instanceof AudioParam || node.gain) {
          // If it's a gain node, ramp it down
          try {
            const currentVal = node.gain.value;
            node.gain.setValueAtTime(currentVal, ctx.currentTime);
            node.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + fadeTime);
          } catch(e){}
        }
      });

      // Stop oscillators and disconnect nodes after fade out completes
      setTimeout(() => {
        droneNodes.forEach(node => {
          try {
            if (typeof node.stop === 'function') {
              node.stop();
            }
            if (typeof node.disconnect === 'function') {
              node.disconnect();
            }
          } catch (e) {}
        });
        droneNodes = [];
      }, fadeTime * 1000);
    },

    // 6. Voice synthesis announcements (Disabled per requirements)
    speak(text) {
      return;
    }
  };

  // Expose to window namespace
  window.RISE_Audio = AudioService;
})(window);
