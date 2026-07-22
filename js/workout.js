/* RISE — Workout Engine Module */

(function (window) {
  const POSES = [
    { name: 'Pranamasana', file: 'pose-01-pranamasana.png.png', sanskrit: 'प्रणामासन', translation: 'Prayer Pose' },
    { name: 'Hasta Uttanasana', file: 'pose-02-hasta-uttanasana.png.png', sanskrit: 'हस्त उत्तानासन', translation: 'Raised Arms Pose' },
    { name: 'Hasta Padasana', file: 'pose-03-hasta-padasana.png.png', sanskrit: 'हस्त पादासन', translation: 'Hand to Foot Pose' },
    { name: 'Ashwa Sanchalanasana', file: 'pose-04-ashwa-sanchalanasana-left.png.png', sanskrit: 'अश्व संचालनासन', translation: 'Equestrian Pose (Left)' },
    { name: 'Dandasana', file: 'pose-05-dandasana.png.png', sanskrit: 'दंडासन', translation: 'Plank Pose' },
    { name: 'Ashtanga Namaskara', file: 'pose-06-ashtanga-namaskara.png.png', sanskrit: 'अष्टांग नमस्कार', translation: 'Eight-Limbed Pose' },
    { name: 'Bhujangasana', file: 'pose-07-bhujangasana.png.png', sanskrit: 'भुजंगासन', translation: 'Cobra Pose' },
    { name: 'Parvatasana', file: 'pose-08-parvatasana.png.png', sanskrit: 'पर्वतासन', translation: 'Mountain Pose' },
    { name: 'Ashwa Sanchalanasana', file: 'pose-09-ashwa-sanchalanasana-right.png.png', sanskrit: 'अश्व संचालनासन', translation: 'Equestrian Pose (Right)' },
    { name: 'Hasta Padasana', file: 'pose-03-hasta-padasana.png.png', sanskrit: 'हस्त पादासन', translation: 'Hand to Foot Pose' },
    { name: 'Hasta Uttanasana', file: 'pose-02-hasta-uttanasana.png.png', sanskrit: 'हस्त उत्तानासन', translation: 'Raised Arms Pose' },
    { name: 'Pranamasana', file: 'pose-01-pranamasana.png.png', sanskrit: 'प्रणामासन', translation: 'Prayer Pose' }
  ];

  let config = {
    sets: 3,
    secPerPose: 8,
    restBetweenSets: 15,
    countdownBeforeStart: 5
  };

  let state = {
    status: 'idle',
    currentSet: 1,
    poseIndex: 0,
    secLeft: 0,
    restSecLeft: 0,
    countdownSecLeft: 0,
    elapsedSec: 0,
    timerId: null,
    sessionStartTimestamp: null,
    wakeLock: null,
    phaseStartedAt: 0,
    phaseDurationMs: 0,
    phaseRemainingMs: 0,
    rafHandle: null
  };

  let posesCompleted = 0;

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        state.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) {}
  }

  function releaseWakeLock() {
    if (state.wakeLock) {
      state.wakeLock.release().catch(() => {});
      state.wakeLock = null;
    }
  }

  function vibrate(pattern) {
    const settings = window.RISE_Storage.getSettings();
    if (settings.hapticsEnabled && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

  const WorkoutEngine = {
    get poses() { return POSES; },
    get state() { return state; },
    get config() { return config; },

    configure(sets, secPerPose, rest, countdown) {
      config.sets = Math.max(1, Math.min(50, sets));
      config.secPerPose = Math.max(5, Math.min(60, secPerPose));
      config.restBetweenSets = Math.max(0, Math.min(120, rest));
      config.countdownBeforeStart = Math.max(3, Math.min(10, countdown));
    },

    start() {
      this.clearLoop();
      state.status = 'countdown';
      state.currentSet = 1;
      state.poseIndex = 0;
      state.secLeft = config.secPerPose;
      state.countdownSecLeft = config.countdownBeforeStart;
      state.restSecLeft = config.restBetweenSets;
      state.elapsedSec = 0;
      state.sessionStartTimestamp = performance.now();
      state.phaseStartedAt = performance.now();
      state.phaseDurationMs = config.countdownBeforeStart * 1000;
      state.phaseRemainingMs = state.phaseDurationMs;
      posesCompleted = 0;

      requestWakeLock();
      window.RISE_Audio.startMeditationMusic();
      this.startLoop();
      this.triggerUIUpdate('workout_countdown');
    },

    pause() {
      if (state.status === 'idle' || state.status === 'complete' || !state.rafHandle) return;
      state.phaseRemainingMs = Math.max(0, state.phaseDurationMs - (performance.now() - state.phaseStartedAt));
      state.phaseStartedAt = 0;
      this.clearLoop();
      window.RISE_Audio.stopMeditationMusic();
      this.triggerUIUpdate('workout_paused');
    },

    resume() {
      if (state.rafHandle || state.status === 'idle' || state.status === 'complete') return;
      if (state.phaseRemainingMs <= 0) {
        this.start();
        return;
      }
      state.phaseStartedAt = performance.now();
      window.RISE_Audio.startMeditationMusic();
      this.startLoop();
      this.triggerUIUpdate('workout_resumed');
    },

    stop() {
      this.clearLoop();
      state.status = 'idle';
      state.phaseRemainingMs = 0;
      state.phaseDurationMs = 0;
      releaseWakeLock();
      window.RISE_Audio.stopMeditationMusic();
      this.triggerUIUpdate('workout_stopped');
    },

    clearLoop() {
      if (state.rafHandle) {
        cancelAnimationFrame(state.rafHandle);
      }
      state.rafHandle = null;
      state.timerId = null;
    },

    startLoop() {
      this.clearLoop();
      state.timerId = 1;
      state.rafHandle = requestAnimationFrame((time) => this.stepFrame(time));
    },

    stepFrame(now) {
      if (!state.phaseStartedAt) {
        state.rafHandle = null;
        state.timerId = null;
        return;
      }

      const elapsedMs = now - state.phaseStartedAt;
      state.elapsedSec = Math.max(0, Math.floor((now - state.sessionStartTimestamp) / 1000));
      state.phaseRemainingMs = Math.max(0, state.phaseDurationMs - elapsedMs);

      if (state.status === 'countdown') {
        const nextDisplay = Math.max(0, Math.ceil(state.phaseRemainingMs / 1000));
        if (nextDisplay !== state.countdownSecLeft) {
          state.countdownSecLeft = nextDisplay;
          if (state.countdownSecLeft <= 3) {
            vibrate(20);
          }
          this.triggerUIUpdate('workout_tick');
        }

        if (state.phaseRemainingMs <= 0) {
          state.countdownSecLeft = 0;
          vibrate([100, 50, 100]);
          window.RISE_Audio.playStepChime();
          this.beginActivePhase();
          return;
        }
      } else if (state.status === 'active') {
        const nextDisplay = Math.max(0, Math.ceil(state.phaseRemainingMs / 1000));
        if (nextDisplay !== state.secLeft) {
          state.secLeft = nextDisplay;
          if (state.secLeft <= 3) {
            vibrate(20);
          }
          this.triggerUIUpdate('workout_tick');
        }

        if (state.phaseRemainingMs <= 0) {
          posesCompleted++;
          this.nextPose();
          return;
        }
      } else if (state.status === 'rest') {
        const nextDisplay = Math.max(0, Math.ceil(state.phaseRemainingMs / 1000));
        if (nextDisplay !== state.restSecLeft) {
          state.restSecLeft = nextDisplay;
          this.triggerUIUpdate('workout_tick');
        }

        if (state.phaseRemainingMs <= 0) {
          this.startNextSet();
          return;
        }
      }

      state.rafHandle = requestAnimationFrame((time) => this.stepFrame(time));
    },

    beginActivePhase() {
      state.status = 'active';
      state.secLeft = config.secPerPose;
      state.phaseDurationMs = config.secPerPose * 1000;
      state.phaseRemainingMs = state.phaseDurationMs;
      state.phaseStartedAt = performance.now();
      window.RISE_Audio.playStepChime();
      vibrate(40);
      this.startLoop();
      this.triggerUIUpdate('workout_pose_changed');
    },

    beginRestPhase() {
      state.status = 'rest';
      state.restSecLeft = config.restBetweenSets;
      state.phaseDurationMs = Math.max(0, config.restBetweenSets * 1000);
      state.phaseRemainingMs = state.phaseDurationMs;
      state.phaseStartedAt = performance.now();
      window.RISE_Audio.playRoundChime();
      vibrate([80, 50, 80]);
      this.startLoop();
      this.triggerUIUpdate('workout_rest_start');
    },

    nextPose() {
      state.poseIndex++;
      if (state.poseIndex >= POSES.length) {
        if (state.currentSet >= config.sets) {
          this.completeWorkout();
        } else {
          this.beginRestPhase();
        }
      } else {
        this.beginActivePhase();
      }
    },

    prevPose() {
      if (state.status !== 'active') return;
      if (state.poseIndex > 0) {
        state.poseIndex--;
        state.secLeft = config.secPerPose;
        window.RISE_Audio.playStepChime();
        vibrate(40);
        this.beginActivePhase();
      } else if (state.currentSet > 1) {
        state.currentSet--;
        state.poseIndex = POSES.length - 1;
        state.secLeft = config.secPerPose;
        window.RISE_Audio.playStepChime();
        vibrate(40);
        this.beginActivePhase();
      }
    },

    skipPose() {
      if (state.status !== 'active') return;
      posesCompleted++;
      state.poseIndex++;
      if (state.poseIndex >= POSES.length) {
        if (state.currentSet >= config.sets) {
          this.completeWorkout();
        } else {
          this.beginRestPhase();
        }
      } else {
        this.beginActivePhase();
      }
    },

    startNextSet() {
      state.currentSet++;
      state.poseIndex = 0;
      state.secLeft = config.secPerPose;
      state.status = 'active';
      window.RISE_Audio.playStepChime();
      vibrate([100, 50, 100]);
      this.beginActivePhase();
      this.triggerUIUpdate('workout_set_started');
    },

    skipRest() {
      if (state.status !== 'rest') return;
      this.startNextSet();
    },

    completeWorkout() {
      this.clearLoop();
      state.status = 'complete';
      state.phaseRemainingMs = 0;
      state.phaseDurationMs = 0;
      releaseWakeLock();
      window.RISE_Audio.stopMeditationMusic();
      window.RISE_Audio.playCompleteChime();
      vibrate([150, 50, 150, 50, 200]);

      const totalPoses = posesCompleted;
      const totalSets = Math.min(config.sets, Math.ceil(totalPoses / 12));
      const calories = Math.round(totalPoses * 4.2);

      const workoutResult = {
        date: new Date().toDateString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        duration: state.elapsedSec,
        sets: totalSets,
        poses: totalPoses,
        calories: calories,
        completionPercent: Math.round((totalPoses / (config.sets * 12)) * 100)
      };

      window.RISE_Storage.saveWorkout(workoutResult);

      const user = window.RISE_Storage.getUser();
      const todayStr = new Date().toDateString();
      const yesterdayStr = new Date(Date.now() - 864e5).toDateString();

      if (user.lastPracticeDate === yesterdayStr) {
        user.currentStreak++;
      } else if (user.lastPracticeDate === todayStr) {
        // already practiced today, keep streak
      } else {
        user.currentStreak = 1;
      }
      user.lastPracticeDate = todayStr;

      if (user.currentStreak > user.longestStreak) {
        user.longestStreak = user.currentStreak;
      }

      const history = window.RISE_Storage.getHistory();
      const todayHistory = history.filter(h => new Date(h.timestamp).toDateString() === todayStr);
      const todaySets = todayHistory.reduce((sum, h) => sum + h.sets, 0) + totalSets;
      const goalCompleted = todaySets >= user.dailyGoalSets && (todaySets - totalSets) < user.dailyGoalSets;

      const xpEarned = window.RISE_Stats.calculateXpEarned(totalSets, user.currentStreak, goalCompleted);
      user.xp += xpEarned;

      const levelInfo = window.RISE_Stats.getLevelInfo(user.xp);
      const levelUpOccurred = user.level !== levelInfo.currentLevel;
      user.level = levelInfo.currentLevel;

      window.RISE_Storage.setUser(user);
      const unlockedAchievements = window.RISE_Stats.checkAchievements();

      state.lastWorkoutSummary = {
        ...workoutResult,
        xpEarned: xpEarned,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        levelUpOccurred: levelUpOccurred,
        newLevel: user.level,
        unlockedAchievementsCount: unlockedAchievements.length
      };

      this.triggerUIUpdate('workout_complete');
    },

    triggerUIUpdate(event) {
      window.dispatchEvent(new CustomEvent('rise_workout_event', {
        detail: {
          event: event,
          state: { ...state },
          config: { ...config }
        }
      }));
    }
  };

  window.RISE_Workout = WorkoutEngine;
})(window);
