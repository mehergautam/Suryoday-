/* RISE — UI & Rendering Controller Module */

(function (window) {
  const $ = id => document.getElementById(id);

  // In-app Notification Toast system
  function showToast(message, title = 'Notification', icon = '🔔') {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        <div class="toast-text">${message}</div>
      </div>
    `;
    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('active'), 50);
    
    // Remove after duration
    setTimeout(() => {
      toast.classList.remove('active');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  const UIController = {
    init() {
      this.bindNavigation();
      this.bindAuthForms();
      this.bindSessionConfig();
      this.bindSettings();
      this.bindWorkoutControls();
      
      // Setup observers
      window.RISE_Auth.onAuthStateChanged(user => this.handleAuthStateChange(user));
      window.addEventListener('rise_workout_event', e => this.handleWorkoutEvent(e.detail));
      
      // Listen for background auto-pause (page visibility changes)
      document.addEventListener('visibilitychange', () => {
        const settings = window.RISE_Storage.getSettings();
        if (document.visibilityState !== 'visible' && settings.autoPauseEnabled && window.RISE_Workout.state.status === 'active') {
          window.RISE_Workout.pause();
          showToast('Workout paused automatically', 'Auto-Pause', '⏸');
        }
      });

      // Initial live configuration summary update
      this.updateConfigSummary();
      this.renderRecentActivity();
    },

    showToast,

    // 1. Auth & State Handlers
    handleAuthStateChange(user) {
      if (!user) {
        // Show Auth Screen
        this.goScreen('auth');
        $('bottomNav').classList.add('hidden');
      } else {
        // User logged in, transition to Home
        this.goScreen('home');
        $('bottomNav').classList.remove('hidden');
        this.updateUserProfileUI(user);
        this.updateHomeGoalCard();
        this.renderStatsPage();
        this.renderAchievementsGrid();
      }
    },

    updateUserProfileUI(user) {
      // Set greeting
      const h = new Date().getHours();
      $('greeting').textContent = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';

      // Update Profile Details
      $('profileName').textContent = user.name;
      $('profileEmail').textContent = user.isGuest ? 'Guest Session' : user.email;
      
      // Level info
      const levelInfo = window.RISE_Stats.getLevelInfo(user.xp);
      $('profileLevel').textContent = levelInfo.currentLevel;
      $('profileLevelSub').textContent = `${user.xp} XP total`;
      $('profileXpProgress').style.width = `${levelInfo.percent}%`;
      $('profileXpLabel').textContent = levelInfo.xpLeftToNext > 0 
        ? `${levelInfo.xpLeftToNext} XP to next level (${levelInfo.nextLevelName})`
        : 'Maximum Level reached!';
        
      // Streaks on profile
      $('profileCurrentStreak').textContent = user.currentStreak;
      $('profileLongestStreak').textContent = user.longestStreak;
      $('profileStreakText').textContent = user.currentStreak === 1 ? 'day active' : 'days streak';

      // Stats summaries
      const history = window.RISE_Storage.getHistory();
      $('profileTotalSessions').textContent = history.length;
      $('profileTotalSets').textContent = history.reduce((sum, h) => sum + h.sets, 0);
      
      const totalMinutes = history.reduce((sum, h) => sum + (h.duration / 60), 0);
      $('profilePracticeTime').textContent = Math.round(totalMinutes) + 'm';
    },

    updateHomeGoalCard() {
      const user = window.RISE_Storage.getUser();
      const history = window.RISE_Storage.getHistory();
      const todayStr = new Date().toDateString();
      
      // Calculate today's completed sets
      const todaySets = history
        .filter(h => new Date(h.timestamp).toDateString() === todayStr)
        .reduce((sum, h) => sum + h.sets, 0);

      const goal = user.dailyGoalSets || 3;
      const percent = Math.min(100, Math.round((todaySets / goal) * 100));

      $('homeGoalTitle').textContent = `Today's Goal: ${goal} Sets`;
      $('homeGoalProgressText').textContent = `${todaySets} of ${goal} completed`;
      $('homeGoalProgressFill').style.width = `${percent}%`;

      // Estimated XP
      const estXp = window.RISE_Stats.calculateXpEarned(window.RISE_Workout.config.sets, user.currentStreak, todaySets < goal && (todaySets + window.RISE_Workout.config.sets) >= goal);
      $('homeGoalXpEstimate').textContent = `+${estXp} XP Reward`;
      
      // Streak on Home
      $('homeStreakVal').textContent = user.currentStreak;
    },

    // 2. Navigation
    goScreen(screenName) {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      
      setTimeout(() => {
        const targetScreen = $(screenName + 'Screen');
        if (targetScreen) {
          targetScreen.classList.add('active');
        }

        // Handle background switches
        document.querySelectorAll('.bg-layer').forEach(b => b.style.opacity = '0');
        if (screenName === 'workout' || screenName === 'complete') {
          $('workoutBg').style.opacity = '1';
          $('bottomNav').classList.add('hidden');
        } else {
          $('homeBg').style.opacity = '1';
          if (window.RISE_Auth.currentUser) {
            $('bottomNav').classList.remove('hidden');
          }
        }
      }, 50);

      // Manage active nav buttons
      document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
      const activeBtn = $('nav' + screenName.charAt(0).toUpperCase() + screenName.slice(1) + 'Btn');
      if (activeBtn) activeBtn.classList.add('active');
    },

    bindNavigation() {
      $('navHomeBtn').onclick = () => this.goScreen('home');
      $('navStatsBtn').onclick = () => {
        this.goScreen('stats');
        this.renderStatsPage();
      };
      $('navAchievementsBtn').onclick = () => {
        this.goScreen('achievements');
        this.renderAchievementsGrid();
      };
      $('navProfileBtn').onclick = () => this.goScreen('profile');
      
      // Log out
      $('settingsLogoutBtn').onclick = () => {
        window.RISE_Auth.logout();
      };
    },

    // 3. Auth Form Bindings
    bindAuthForms() {
      // Toggle Auth Tabs
      $('tabLogin').onclick = () => {
        $('tabLogin').classList.add('active');
        $('tabSignup').classList.remove('active');
        $('loginForm').classList.remove('hidden');
        $('signupForm').classList.add('hidden');
        $('forgotForm').classList.add('hidden');
      };

      $('tabSignup').onclick = () => {
        $('tabLogin').classList.remove('active');
        $('tabSignup').classList.add('active');
        $('loginForm').classList.add('hidden');
        $('signupForm').classList.remove('hidden');
        $('forgotForm').classList.add('hidden');
      };

      $('showForgotLink').onclick = (e) => {
        e.preventDefault();
        $('loginForm').classList.add('hidden');
        $('forgotForm').classList.remove('hidden');
      };

      $('backToLoginLink').onclick = (e) => {
        e.preventDefault();
        $('loginForm').classList.remove('hidden');
        $('forgotForm').classList.add('hidden');
      };

      // Form Submissions
      $('loginFormSubmit').onclick = async () => {
        const email = $('loginEmail').value.trim();
        const password = $('loginPassword').value;
        const btn = $('loginFormSubmit');
        
        try {
          btn.disabled = true;
          btn.textContent = 'Signing In...';
          await window.RISE_Auth.login(email, password);
          showToast('Welcome back to RISE!', 'Signed In', '🔑');
        } catch (err) {
          showToast(err.message, 'Sign In Error', '❌');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Sign In';
        }
      };

      $('signupFormSubmit').onclick = async () => {
        const name = $('signupName').value.trim();
        const email = $('signupEmail').value.trim();
        const password = $('signupPassword').value;
        const btn = $('signupFormSubmit');

        try {
          btn.disabled = true;
          btn.textContent = 'Creating Account...';
          await window.RISE_Auth.signUp(email, password, name);
          showToast('Account created successfully!', 'Signed Up', '🎉');
        } catch (err) {
          showToast(err.message, 'Registration Error', '❌');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Sign Up';
        }
      };

      $('forgotFormSubmit').onclick = async () => {
        const email = $('forgotEmail').value.trim();
        const btn = $('forgotFormSubmit');

        try {
          btn.disabled = true;
          btn.textContent = 'Sending Link...';
          const msg = await window.RISE_Auth.forgotPassword(email);
          showToast(msg, 'Password Reset', '✉️');
          $('forgotForm').classList.add('hidden');
          $('loginForm').classList.remove('hidden');
        } catch (err) {
          showToast(err.message, 'Error', '❌');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Send Reset Link';
        }
      };

      $('guestLoginBtn').onclick = async () => {
        const btn = $('guestLoginBtn');
        try {
          btn.disabled = true;
          btn.textContent = 'Loading Guest...';
          await window.RISE_Auth.loginAsGuest();
          showToast('Logged in as Guest Yogi', 'Guest Session', '🧘');
        } catch (err) {
          showToast('Unable to start guest session.', 'Error', '❌');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Continue as Guest';
        }
      };
    },

    // 4. Session Configuration Steppers
    bindSessionConfig() {
      // Load current configuration values from WorkoutEngine
      const engineConfig = window.RISE_Workout.config;
      
      const updateValue = (id, val) => {
        $(id).textContent = val;
        this.updateConfigSummary();
        this.updateHomeGoalCard();
      };

      // Sets
      $('configSetsMinus').onclick = () => {
        engineConfig.sets = Math.max(1, engineConfig.sets - 1);
        updateValue('configSetsVal', engineConfig.sets);
      };
      $('configSetsPlus').onclick = () => {
        engineConfig.sets = Math.min(50, engineConfig.sets + 1);
        updateValue('configSetsVal', engineConfig.sets);
      };

      // Seconds per pose
      $('configSecMinus').onclick = () => {
        engineConfig.secPerPose = Math.max(5, engineConfig.secPerPose - 1);
        updateValue('configSecVal', engineConfig.secPerPose);
      };
      $('configSecPlus').onclick = () => {
        engineConfig.secPerPose = Math.min(60, engineConfig.secPerPose + 1);
        updateValue('configSecVal', engineConfig.secPerPose);
      };

      // Rest time
      $('configRestMinus').onclick = () => {
        engineConfig.restBetweenSets = Math.max(0, engineConfig.restBetweenSets - 5);
        updateValue('configRestVal', engineConfig.restBetweenSets + 's');
      };
      $('configRestPlus').onclick = () => {
        engineConfig.restBetweenSets = Math.min(120, engineConfig.restBetweenSets + 5);
        updateValue('configRestVal', engineConfig.restBetweenSets + 's');
      };

      // Countdown
      $('configCdMinus').onclick = () => {
        engineConfig.countdownBeforeStart = Math.max(3, engineConfig.countdownBeforeStart - 1);
        updateValue('configCdVal', engineConfig.countdownBeforeStart + 's');
      };
      $('configCdPlus').onclick = () => {
        engineConfig.countdownBeforeStart = Math.min(10, engineConfig.countdownBeforeStart + 1);
        updateValue('configCdVal', engineConfig.countdownBeforeStart + 's');
      };

      // Start Session button
      $('startConfigBtn').onclick = () => {
        this.goScreen('workout');
        window.RISE_Workout.start();
      };

      // Quick Start button
      $('quickStartBtn').onclick = () => {
        window.RISE_Workout.configure(1, 8, 15, 5); // default values
        this.goScreen('workout');
        window.RISE_Workout.start();
      };

      // Continue Last Session
      $('continueLastBtn').onclick = () => {
        const history = window.RISE_Storage.getHistory();
        if (history.length > 0) {
          const last = history[history.length - 1];
          const sets = last.sets || 1;
          const duration = last.duration || 96;
          const secPerPose = Math.max(5, Math.min(60, Math.round(duration / (sets * 12))));
          // Use previous workout settings
          window.RISE_Workout.configure(sets, secPerPose, 15, 5);
          // Set inputs in config card
          $('configSetsVal').textContent = sets;
          $('configSecVal').textContent = secPerPose;
          this.goScreen('workout');
          window.RISE_Workout.start();
        } else {
          showToast('No previous sessions recorded. Starting fresh!', 'RISE', 'ℹ️');
        }
      };
    },

    updateConfigSummary() {
      const sets = window.RISE_Workout.config.sets;
      const secPerPose = window.RISE_Workout.config.secPerPose;
      const rest = window.RISE_Workout.config.restBetweenSets;
      const cd = window.RISE_Workout.config.countdownBeforeStart;

      const totalPoses = sets * 12;
      const durationSec = (totalPoses * secPerPose) + ((sets - 1) * rest) + cd;
      const durationMin = Math.ceil(durationSec / 60);
      const calories = Math.round(totalPoses * 4.2);

      $('summaryPoses').textContent = totalPoses;
      $('summaryDuration').textContent = `~${durationMin}m`;
      $('summaryRest').textContent = `${(sets - 1) * rest}s`;
      $('summaryCalories').textContent = `${calories} kcal`;
    },

    renderRecentActivity() {
      const history = window.RISE_Storage.getHistory();
      const recentContainer = $('recentActivityList');
      if (!recentContainer) return;
      
      recentContainer.innerHTML = '';
      if (history.length === 0) {
        recentContainer.innerHTML = '<div class="no-activity">No recent workouts. Shuru karo!</div>';
        $('continueLastBtn').classList.add('hidden');
        return;
      }
      
      $('continueLastBtn').classList.remove('hidden');

      // Take last 2 workouts
      const recent = [...history].reverse().slice(0, 2);
      recent.forEach(h => {
        const durationMin = Math.round(h.duration / 60);
        const item = document.createElement('div');
        item.className = 'recent-activity-item';
        item.innerHTML = `
          <div class="activity-left">
            <span class="activity-sets">${h.sets} Set${h.sets > 1 ? 's' : ''}</span>
            <span class="activity-date">${h.date} at ${h.time}</span>
          </div>
          <div class="activity-right">
            <span class="activity-cal">${h.calories} kcal</span>
            <span class="activity-dur">${durationMin} mins</span>
          </div>
        `;
        // Click to view details
        item.onclick = () => this.showWorkoutDetailPopup(h);
        recentContainer.appendChild(item);
      });
    },

    // 5. Workout screen bindings & animation
    bindWorkoutControls() {
      $('woPlayPause').onclick = () => {
        const status = window.RISE_Workout.state.status;
        if (window.RISE_Workout.state.timerId) {
          window.RISE_Workout.pause();
        } else {
          window.RISE_Workout.resume();
        }
      };
      
      $('woPrev').onclick = () => window.RISE_Workout.prevPose();
      $('woMore').onclick = () => window.RISE_Workout.skipPose();
      
      $('woClose').onclick = () => {
        const confirmExit = confirm("Are you sure you want to stop this session?");
        if (confirmExit) {
          window.RISE_Workout.stop();
          this.goScreen('home');
        }
      };

      // Rest Screen Controls
      $('skipRestBtn').onclick = () => window.RISE_Workout.skipRest();
      $('continueRestBtn').onclick = () => window.RISE_Workout.skipRest();

      $('doneBtn').onclick = () => {
        this.goScreen('home');
        // Refresh home stats
        this.updateHomeGoalCard();
        this.renderRecentActivity();
      };
    },

    handleWorkoutEvent(data) {
      const { event, state, config } = data;
      
      // Update Timer rings
      const CIRC = 2 * Math.PI * 98; // r=98, matches SVG timer ring
      
      if (event === 'workout_countdown') {
        $('workoutCountdownOverlay').classList.add('active');
        $('workoutCountdownNumber').textContent = state.countdownSecLeft;
        // Hide rest screen
        $('workoutRestOverlay').classList.remove('active');
      }

      if (event === 'workout_tick') {
        if (state.status === 'countdown') {
          $('workoutCountdownNumber').textContent = state.countdownSecLeft;
          // Scale countdown number animation
          $('workoutCountdownNumber').style.transform = 'scale(1.2)';
          setTimeout(() => {
            $('workoutCountdownNumber').style.transform = 'scale(1)';
          }, 200);
        } else if (state.status === 'active') {
          $('workoutCountdownOverlay').classList.remove('active');
          $('timerCount').textContent = String(state.secLeft).padStart(3, '0');
          
          const frac = 1 - (state.secLeft / config.secPerPose);
          $('timerRing').style.strokeDashoffset = CIRC * (1 - frac);
        } else if (state.status === 'rest') {
          $('restTimerCount').textContent = state.restSecLeft;
          const restCIRC = 2 * Math.PI * 50;
          const restFrac = 1 - (state.restSecLeft / config.restBetweenSets);
          $('restRingCircle').style.strokeDashoffset = restCIRC * (1 - restFrac);
        }
      }

      if (event === 'workout_pose_changed' || event === 'workout_set_started') {
        $('workoutCountdownOverlay').classList.remove('active');
        $('workoutRestOverlay').classList.remove('active');
        this.renderActivePose(state.poseIndex, state.currentSet, config.sets, config.secPerPose);
      }

      if (event === 'workout_rest_start') {
        $('workoutRestOverlay').classList.add('active');
        $('restTimerCount').textContent = state.restSecLeft;
        $('restNextSetLabel').textContent = `Set ${state.currentSet + 1} of ${config.sets}`;
        // Draw rest progress circle
        const restCIRC = 2 * Math.PI * 50;
        $('restRingCircle').style.strokeDasharray = restCIRC;
        $('restRingCircle').style.strokeDashoffset = 0;
      }

      if (event === 'workout_paused') {
        $('icoPlay').style.display = 'block';
        $('icoPause').style.display = 'none';
      }

      if (event === 'workout_resumed') {
        $('icoPlay').style.display = 'none';
        $('icoPause').style.display = 'block';
      }

      if (event === 'workout_complete') {
        this.showWorkoutCompleteScreen(state.lastWorkoutSummary);
      }
    },

    renderActivePose(poseIndex, currentSet, totalSets, secPerPose) {
      const poses = window.RISE_Workout.poses;
      const p = poses[poseIndex];
      const nextP = poses[poseIndex + 1] || null;

      // Update text details
      $('timerSet').textContent = `Set ${currentSet} of ${totalSets}`;
      $('timerRep').textContent = `${poseIndex + 1} / 12 Poses`;
      $('woPoseName').textContent = p.name;
      $('woSanskritName').textContent = p.sanskrit + ` (${p.translation})`;
      $('woStep').textContent = `Pose ${poseIndex + 1} of 12`;
      $('woProgress').textContent = `Set ${currentSet}/${totalSets}`;

      // Progress bar fill (0 to 100)
      const totalPoses = totalSets * 12;
      const currentPosesCompleted = ((currentSet - 1) * 12) + poseIndex;
      $('woProgressFill').style.width = `${(currentPosesCompleted / totalPoses) * 100}%`;

      // Next Pose Premium Card — update name span only
      const nextNameEl = $('woNextPoseName');
      if (nextP) {
        nextNameEl.textContent = nextP.name;
      } else if (currentSet === totalSets) {
        nextNameEl.textContent = 'Workout Complete 🌟';
      } else {
        nextNameEl.textContent = 'Set Rest';
      }

      // Smooth slide-fade transition for pose image
      const img = $('poseImage');
      img.style.transform = 'translateX(-20px)';
      img.style.opacity = '0';
      
      setTimeout(() => {
        img.src = (window.RISE_trimmedCache && window.RISE_trimmedCache[p.file]) || `assets/poses/${p.file}`;
        img.style.transform = 'translateX(0)';
        img.style.opacity = '1';
      }, 200);

      // Reset timer ring stroke to full immediately on transition
      $('timerRing').style.strokeDashoffset = 0;

      // Play/Pause icon check
      $('icoPlay').style.display = 'none';
      $('icoPause').style.display = 'block';
    },

    showWorkoutCompleteScreen(summary) {
      // Transition to Complete Screen
      this.goScreen('complete');

      // Populate Completion UI fields
      $('completeSets').textContent = summary.sets;
      $('completePoses').textContent = summary.poses;
      
      const mins = Math.floor(summary.duration / 60);
      const secs = summary.duration % 60;
      $('completeDuration').textContent = `${mins}m ${secs}s`;
      
      $('completeCalories').textContent = summary.calories;
      $('completeXp').textContent = `+${summary.xpEarned} XP`;
      $('completeCurrentStreak').textContent = summary.currentStreak;
      $('completeLongestStreak').textContent = summary.longestStreak;

      // Unlocks info
      const unlockedText = $('completeAchievementsUnlock');
      if (summary.unlockedAchievementsCount > 0) {
        unlockedText.textContent = `Unlocked ${summary.unlockedAchievementsCount} new Badge${summary.unlockedAchievementsCount > 1 ? 's' : ''}!`;
        unlockedText.classList.add('visible');
      } else {
        unlockedText.classList.remove('visible');
      }

      if (summary.levelUpOccurred) {
        showToast(`Congratulations! You leveled up to ${summary.newLevel}!`, 'Level Up!', '🏆');
      }
    },

    // 6. Statistics Page Rendering
    renderStatsPage() {
      const history = window.RISE_Storage.getHistory();
      const user = window.RISE_Storage.getUser();

      // Stats summaries
      $('statsTotalSessions').textContent = history.length;
      $('statsConsistency').textContent = window.RISE_Stats.getConsistencyScore(history) + '%';
      
      const totalMinutes = history.reduce((sum, h) => sum + (h.duration / 60), 0);
      $('statsTotalPractice').textContent = Math.round(totalMinutes) + ' min';

      const avgDuration = history.length > 0 ? (totalMinutes / history.length) : 0;
      $('statsAvgDuration').textContent = Math.round(avgDuration) + ' min';

      $('statsTotalCalories').textContent = history.reduce((sum, h) => sum + h.calories, 0) + ' kcal';
      $('statsAvgSets').textContent = history.length > 0 
        ? (history.reduce((sum, h) => sum + h.sets, 0) / history.length).toFixed(1) 
        : '0.0';

      $('statsCurrentStreak').textContent = user.currentStreak;
      $('statsLongestStreak').textContent = user.longestStreak;
      $('statsPerfectWeeks').textContent = window.RISE_Stats.getPerfectWeeks(history);

      // Render charts
      $('statsWeeklyChart').innerHTML = window.RISE_Stats.generateWeeklyLineChart(history);
      $('statsMonthlyChart').innerHTML = window.RISE_Stats.generateMonthlyBarChart(history);

      // Render calendar
      $('statsCalendarContainer').innerHTML = window.RISE_Stats.generateContributionCalendar(history);

      // Render history logs
      this.renderFullHistoryList();
    },

    renderFullHistoryList() {
      const history = window.RISE_Storage.getHistory();
      const container = $('statsHistoryList');
      if (!container) return;

      container.innerHTML = '';
      if (history.length === 0) {
        container.innerHTML = '<div class="no-activity">No sessions recorded yet. Complete a workout to see history!</div>';
        return;
      }

      // Reverse history list (newest first)
      const list = [...history].reverse();
      list.forEach(h => {
        const item = document.createElement('div');
        item.className = 'history-log-item';
        item.innerHTML = `
          <div class="log-left">
            <span class="log-title">${h.sets} Set${h.sets > 1 ? 's' : ''} Surya Namaskar</span>
            <span class="log-date">${h.date} • ${h.time}</span>
          </div>
          <div class="log-right">
            <span class="log-percent">${h.completionPercent}% Complete</span>
            <span class="log-details-arrow">›</span>
          </div>
        `;
        item.onclick = () => this.showWorkoutDetailPopup(h);
        container.appendChild(item);
      });
    },

    showWorkoutDetailPopup(h) {
      // Create detailed modal
      const modal = document.createElement('div');
      modal.className = 'details-modal-overlay';
      modal.onclick = (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      };

      const durationMin = Math.floor(h.duration / 60);
      const durationSec = h.duration % 60;

      modal.innerHTML = `
        <div class="details-modal-card">
          <div class="modal-header">
            <h3>Workout Summary</h3>
            <button class="modal-close" onclick="this.closest('.details-modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body">
            <div class="modal-main-stat">
              <span class="modal-stat-val">${h.sets} Sets</span>
              <span class="modal-stat-lbl">${h.poses} Poses Completed</span>
            </div>
            
            <div class="modal-stats-grid">
              <div class="modal-grid-item">
                <span class="m-lbl">Date</span>
                <span class="m-val">${h.date}</span>
              </div>
              <div class="modal-grid-item">
                <span class="m-lbl">Time Started</span>
                <span class="m-val">${h.time}</span>
              </div>
              <div class="modal-grid-item">
                <span class="m-lbl">Duration</span>
                <span class="m-val">${durationMin}m ${durationSec}s</span>
              </div>
              <div class="modal-grid-item">
                <span class="m-lbl">Calories</span>
                <span class="m-val">${h.calories} kcal</span>
              </div>
              <div class="modal-grid-item">
                <span class="m-lbl">XP Earned</span>
                <span class="m-val">+${h.sets * 50} XP</span>
              </div>
              <div class="modal-grid-item">
                <span class="m-lbl">Completion %</span>
                <span class="m-val">${h.completionPercent}%</span>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    },

    showDayDetails(dateStr) {
      const history = window.RISE_Storage.getHistory();
      const dayWorkouts = history.filter(h => {
        const d = new Date(h.timestamp);
        const yyyymmdd = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        return yyyymmdd === dateStr;
      });

      if (dayWorkouts.length === 0) {
        showToast('No workouts completed on this day.', 'Calendar Activity', '📅');
        return;
      }

      // If there are workouts, display the detail popup for the first one or a summary
      const totalSets = dayWorkouts.reduce((sum, h) => sum + h.sets, 0);
      const totalDur = dayWorkouts.reduce((sum, h) => sum + h.duration, 0);
      const totalCal = dayWorkouts.reduce((sum, h) => sum + h.calories, 0);
      
      const formattedDate = new Date(dayWorkouts[0].timestamp).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

      const modal = document.createElement('div');
      modal.className = 'details-modal-overlay';
      modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
      };

      const durationMin = Math.floor(totalDur / 60);

      modal.innerHTML = `
        <div class="details-modal-card">
          <div class="modal-header">
            <h3>${formattedDate}</h3>
            <button class="modal-close" onclick="this.closest('.details-modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body">
            <div class="modal-main-stat">
              <span class="modal-stat-val">${totalSets} Set${totalSets > 1 ? 's' : ''}</span>
              <span class="modal-stat-lbl">Daily Total Activity</span>
            </div>
            
            <div class="modal-stats-grid" style="grid-template-columns: 1fr 1fr;">
              <div class="modal-grid-item">
                <span class="m-lbl">Total Workouts</span>
                <span class="m-val">${dayWorkouts.length} session${dayWorkouts.length > 1 ? 's' : ''}</span>
              </div>
              <div class="modal-grid-item">
                <span class="m-lbl">Total Practice</span>
                <span class="m-val">${durationMin} minutes</span>
              </div>
              <div class="modal-grid-item">
                <span class="m-lbl">Total Energy Burnt</span>
                <span class="m-val">${totalCal} kcal</span>
              </div>
              <div class="modal-grid-item">
                <span class="m-lbl">Goal Status</span>
                <span class="m-val" style="color: #FFB000;">Daily Goal Completed</span>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    },

    // 7. Achievements Grid Rendering
    renderAchievementsGrid() {
      const user = window.RISE_Storage.getUser();
      const container = $('achievementsGrid');
      if (!container) return;

      container.innerHTML = '';
      const unlockedIds = new Set(user.achievements || []);

      window.RISE_AchievementsList.forEach(ach => {
        const isUnlocked = unlockedIds.has(ach.id);
        const card = document.createElement('div');
        card.className = `achievement-card ${isUnlocked ? 'unlocked' : 'locked'}`;
        card.innerHTML = `
          <div class="ach-icon-container">
            <span class="ach-icon">${ach.icon}</span>
          </div>
          <div class="ach-details">
            <h4 class="ach-title">${ach.title}</h4>
            <p class="ach-desc">${ach.desc}</p>
            <span class="ach-xp-reward">+${ach.xp} XP</span>
          </div>
          ${isUnlocked ? '<span class="unlocked-badge">✓ Unlocked</span>' : '<span class="unlocked-badge locked">🔒 Locked</span>'}
        `;
        container.appendChild(card);
      });
    },

    // 8. Settings Form Bindings
    bindSettings() {
      const settings = window.RISE_Storage.getSettings();

      // Bind switches initial states
      $('settingsMusic').checked = settings.musicEnabled;
      $('settingsVoice').checked = settings.voiceEnabled;
      $('settingsHaptics').checked = settings.hapticsEnabled;
      $('settingsAutoPause').checked = settings.autoPauseEnabled;
      $('settingsLanguage').value = settings.language;
      $('settingsReminder').value = settings.reminderTime;

      // Handle changes
      const updateSettings = () => {
        window.RISE_Storage.setSettings({
          musicEnabled: $('settingsMusic').checked,
          voiceEnabled: $('settingsVoice').checked,
          hapticsEnabled: $('settingsHaptics').checked,
          autoPauseEnabled: $('settingsAutoPause').checked,
          language: $('settingsLanguage').value,
          reminderTime: $('settingsReminder').value
        });
      };

      $('settingsMusic').onchange = updateSettings;
      $('settingsVoice').onchange = updateSettings;
      $('settingsHaptics').onchange = updateSettings;
      $('settingsAutoPause').onchange = updateSettings;
      $('settingsLanguage').onchange = updateSettings;
      $('settingsReminder').onchange = () => {
        updateSettings();
        showToast(`Practice reminder scheduled for ${$('settingsReminder').value}`, 'Settings', '⏰');
      };

      // About & Privacy Modals
      $('aboutBtn').onclick = () => {
        const modal = document.createElement('div');
        modal.className = 'details-modal-overlay';
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        modal.innerHTML = `
          <div class="details-modal-card">
            <div class="modal-header">
              <h3>About RISE</h3>
              <button class="modal-close" onclick="this.closest('.details-modal-overlay').remove()">×</button>
            </div>
            <div class="modal-body" style="color: #94A3B8; font-size: 13px; line-height: 1.6;">
              <p style="margin-bottom: 12px;"><strong>RISE v2.0</strong> is a premium wellness application designed to gamify and simplify your daily Surya Namaskar (Sun Salutation) practice.</p>
              <p style="margin-bottom: 12px;">Created with state-of-the-art Web Audio synthesizers, clean modular architecture, and offline analytics, RISE matches the premium user experiences of Apple Fitness and Nike Training Club.</p>
              <p>Designed for yoga practitioners of all levels. Namaste 🙏</p>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      };

      $('privacyBtn').onclick = () => {
        const modal = document.createElement('div');
        modal.className = 'details-modal-overlay';
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        modal.innerHTML = `
          <div class="details-modal-card">
            <div class="modal-header">
              <h3>Privacy Policy</h3>
              <button class="modal-close" onclick="this.closest('.details-modal-overlay').remove()">×</button>
            </div>
            <div class="modal-body" style="color: #94A3B8; font-size: 13px; line-height: 1.6;">
              <p style="margin-bottom: 12px;"><strong>Your Privacy Matters.</strong> RISE works completely client-side. None of your workout configurations, profile information, or statistics are transmitted to remote servers.</p>
              <p style="margin-bottom: 12px;">All details remain encrypted inside your local sandbox utilizing HTML5 Local Storage.</p>
              <p>If you connect database services in the future, your configurations will migrate seamlessly using the pre-structured interfaces.</p>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      };
    }
  };

  // Expose
  window.RISE_UI = UIController;
})(window);
