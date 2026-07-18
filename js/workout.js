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
    status: 'idle', // 'idle' | 'countdown' | 'active' | 'rest' | 'complete'
    currentSet: 1,
    poseIndex: 0,
    secLeft: 0,
    restSecLeft: 0,
    countdownSecLeft: 0,
    elapsedSec: 0,
    timerId: null,
    sessionStartTimestamp: null,
    wakeLock: null
  };

  // Keep track of total poses completed in current session
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
      if (state.timerId) clearInterval(state.timerId);
      
      state.status = 'countdown';
      state.currentSet = 1;
      state.poseIndex = 0;
      state.secLeft = config.secPerPose;
      state.countdownSecLeft = config.countdownBeforeStart;
      state.restSecLeft = config.restBetweenSets;
      state.elapsedSec = 0;
      state.sessionStartTimestamp = Date.now();
      posesCompleted = 0;
      
      requestWakeLock();
      
      // Start procedural meditation music if enabled
      window.RISE_Audio.startMeditationMusic();

      // Announcement for countdown
      window.RISE_Audio.speak(`Workout starting in ${state.countdownSecLeft} seconds. Get ready.`);

      state.timerId = setInterval(() => this.tick(), 1000);
      this.triggerUIUpdate('workout_countdown');
    },

    pause() {
      if (state.status === 'idle' || state.status === 'complete') return;
      clearInterval(state.timerId);
      state.timerId = null;
      window.RISE_Audio.stopMeditationMusic();
      this.triggerUIUpdate('workout_paused');
    },

    resume() {
      if (state.timerId) return;
      window.RISE_Audio.startMeditationMusic();
      state.timerId = setInterval(() => this.tick(), 1000);
      this.triggerUIUpdate('workout_resumed');
    },

    stop() {
      if (state.timerId) clearInterval(state.timerId);
      state.timerId = null;
      state.status = 'idle';
      releaseWakeLock();
      window.RISE_Audio.stopMeditationMusic();
      this.triggerUIUpdate('workout_stopped');
    },

    tick() {
      state.elapsedSec++;

      if (state.status === 'countdown') {
        state.countdownSecLeft--;
        vibrate(30);
        
        if (state.countdownSecLeft > 0) {
          window.RISE_Audio.speak(String(state.countdownSecLeft));
        }

        if (state.countdownSecLeft <= 0) {
          state.status = 'active';
          vibrate([100, 50, 100]);
          window.RISE_Audio.playStepChime();
          this.announcePose();
        }
        this.triggerUIUpdate('workout_tick');
        return;
      }

      if (state.status === 'active') {
        state.secLeft--;
        if (state.secLeft <= 0) {
          posesCompleted++;
          this.nextPose();
        } else {
          // Speak 3, 2, 1 warnings on settings preference
          if (state.secLeft <= 3) {
            vibrate(20);
          }
          this.triggerUIUpdate('workout_tick');
        }
        return;
      }

      if (state.status === 'rest') {
        state.restSecLeft--;
        vibrate(30);
        
        if (state.restSecLeft <= 0) {
          this.startNextSet();
        } else {
          this.triggerUIUpdate('workout_tick');
        }
        return;
      }
    },

    nextPose() {
      state.poseIndex++;
      if (state.poseIndex >= POSES.length) {
        // Completed a full set of 12 poses
        if (state.currentSet >= config.sets) {
          this.completeWorkout();
        } else {
          // Go to rest screen between sets
          state.status = 'rest';
          state.restSecLeft = config.restBetweenSets;
          window.RISE_Audio.playRoundChime();
          vibrate([80, 50, 80]);
          
          if (config.restBetweenSets === 0) {
            this.startNextSet();
          } else {
            window.RISE_Audio.speak(`Set ${state.currentSet} complete. Rest for ${config.restBetweenSets} seconds.`);
            this.triggerUIUpdate('workout_rest_start');
          }
        }
      } else {
        // Normal pose transition
        state.secLeft = config.secPerPose;
        window.RISE_Audio.playStepChime();
        vibrate(40);
        this.announcePose();
        this.triggerUIUpdate('workout_pose_changed');
      }
    },

    prevPose() {
      if (state.status !== 'active') return;
      if (state.poseIndex > 0) {
        state.poseIndex--;
        state.secLeft = config.secPerPose;
        window.RISE_Audio.playStepChime();
        vibrate(40);
        this.announcePose();
        this.triggerUIUpdate('workout_pose_changed');
      } else if (state.currentSet > 1) {
        // Go back to previous set rest screen or end of previous set
        state.currentSet--;
        state.poseIndex = POSES.length - 1;
        state.secLeft = config.secPerPose;
        window.RISE_Audio.playStepChime();
        vibrate(40);
        this.announcePose();
        this.triggerUIUpdate('workout_pose_changed');
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
          state.status = 'rest';
          state.restSecLeft = config.restBetweenSets;
          window.RISE_Audio.playRoundChime();
          vibrate([80, 50, 80]);
          if (config.restBetweenSets === 0) {
            this.startNextSet();
          } else {
            this.triggerUIUpdate('workout_rest_start');
          }
        }
      } else {
        state.secLeft = config.secPerPose;
        window.RISE_Audio.playStepChime();
        vibrate(40);
        this.announcePose();
        this.triggerUIUpdate('workout_pose_changed');
      }
    },

    startNextSet() {
      state.currentSet++;
      state.poseIndex = 0;
      state.secLeft = config.secPerPose;
      state.status = 'active';
      window.RISE_Audio.playStepChime();
      vibrate([100, 50, 100]);
      this.announcePose();
      this.triggerUIUpdate('workout_set_started');
    },

    skipRest() {
      if (state.status !== 'rest') return;
      this.startNextSet();
    },

    announcePose() {
      const pose = POSES[state.poseIndex];
      window.RISE_Audio.speak(`Pose ${state.poseIndex + 1}: ${pose.name}.`);
    },

    completeWorkout() {
      clearInterval(state.timerId);
      state.timerId = null;
      state.status = 'complete';
      releaseWakeLock();

      window.RISE_Audio.playCompleteChime();
      vibrate([150, 50, 150, 50, 200]);
      window.RISE_Audio.speak("Namaste. Your yoga session is complete.");

      // Calculate statistics
      const totalPoses = posesCompleted;
      const totalSets = Math.min(config.sets, Math.ceil(totalPoses / 12));
      const calories = Math.round(totalPoses * 4.2); // ~4.2 kcal per pose

      const workoutResult = {
        date: new Date().toDateString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        duration: state.elapsedSec,
        sets: totalSets,
        poses: totalPoses,
        calories: calories,
        completionPercent: Math.round((totalPoses / (config.sets * 12)) * 100)
      };

      // Save workout history
      window.RISE_Storage.saveWorkout(workoutResult);

      // Handle XP and Gamification logic
      const user = window.RISE_Storage.getUser();
      
      // Streak update logic
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

      // Check if they completed their daily goal today
      const history = window.RISE_Storage.getHistory();
      const todayHistory = history.filter(h => new Date(h.timestamp).toDateString() === todayStr);
      const todaySets = todayHistory.reduce((sum, h) => sum + h.sets, 0) + totalSets;
      
      const goalCompleted = todaySets >= user.dailyGoalSets && (todaySets - totalSets) < user.dailyGoalSets;

      // XP Earned
      const xpEarned = window.RISE_Stats.calculateXpEarned(totalSets, user.currentStreak, goalCompleted);
      user.xp += xpEarned;
      
      // Update level
      const levelInfo = window.RISE_Stats.getLevelInfo(user.xp);
      const levelUpOccurred = user.level !== levelInfo.currentLevel;
      user.level = levelInfo.currentLevel;

      window.RISE_Storage.setUser(user);

      // Check achievements
      const unlockedAchievements = window.RISE_Stats.checkAchievements();

      // Attach result object for UI display
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

  // Expose
  window.RISE_Workout = WorkoutEngine;
})(window);
