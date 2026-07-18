/* RISE — Storage Module */

(function (window) {
  const STORAGE_KEYS = {
    USER: 'rise_user',
    HISTORY: 'rise_history',
    SETTINGS: 'rise_settings'
  };

  const DEFAULT_SETTINGS = {
    musicEnabled: true,
    voiceEnabled: true,
    hapticsEnabled: true,
    autoPauseEnabled: true,
    language: 'en',
    reminderTime: '08:00'
  };

  const DEFAULT_USER = {
    uid: null,
    name: 'Guest Yogi',
    email: '',
    isGuest: true,
    xp: 0,
    level: 'Beginner',
    dailyGoalSets: 3,
    currentStreak: 0,
    longestStreak: 0,
    lastPracticeDate: '',
    perfectWeeks: 0,
    achievements: [] // array of unlocked achievement ids
  };

  const StorageService = {
    // Basic helpers
    get(key, fallback = null) {
      try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : fallback;
      } catch (e) {
        console.error('Error reading from localStorage', e);
        return fallback;
      }
    },

    set(key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch (e) {
        console.error('Error writing to localStorage', e);
      }
    },

    // User Profile
    getUser() {
      let user = this.get(STORAGE_KEYS.USER);
      if (!user) {
        // Migrate legacy keys if they exist
        const legacyStreak = +localStorage.getItem('r_streak') || 0;
        const legacyLastDate = localStorage.getItem('r_lastDate') || '';
        
        user = { 
          ...DEFAULT_USER,
          currentStreak: legacyStreak,
          longestStreak: legacyStreak,
          lastPracticeDate: legacyLastDate
        };
        this.setUser(user);
        
        // Clean up legacy keys
        localStorage.removeItem('r_streak');
        localStorage.removeItem('r_lastDate');
        localStorage.removeItem('r_daily');
      }
      return user;
    },

    setUser(user) {
      this.set(STORAGE_KEYS.USER, user);
      // Synchronize back to the mock registered user database key if logged in
      if (user && !user.isGuest && user.email) {
        const existingUsers = this.get('rise_mock_db_users', {});
        if (existingUsers[user.email]) {
          existingUsers[user.email].xp = user.xp;
          existingUsers[user.email].level = user.level;
          existingUsers[user.email].currentStreak = user.currentStreak;
          existingUsers[user.email].longestStreak = user.longestStreak;
          existingUsers[user.email].lastPracticeDate = user.lastPracticeDate;
          existingUsers[user.email].perfectWeeks = user.perfectWeeks;
          existingUsers[user.email].achievements = user.achievements;
          existingUsers[user.email].dailyGoalSets = user.dailyGoalSets;
          this.set('rise_mock_db_users', existingUsers);
        }
      }
      // Trigger a custom event so UI can react to user changes
      window.dispatchEvent(new CustomEvent('rise_user_changed', { detail: user }));
    },

    // Settings
    getSettings() {
      let settings = this.get(STORAGE_KEYS.SETTINGS);
      if (!settings) {
        settings = { ...DEFAULT_SETTINGS };
        this.setSettings(settings);
      }
      return settings;
    },

    setSettings(settings) {
      this.set(STORAGE_KEYS.SETTINGS, settings);
      window.dispatchEvent(new CustomEvent('rise_settings_changed', { detail: settings }));
    },

    // Workout History
    getHistory() {
      return this.get(STORAGE_KEYS.HISTORY, []);
    },

    saveWorkout(workout) {
      const history = this.getHistory();
      history.push({
        id: 'wo_' + Date.now(),
        date: workout.date || new Date().toDateString(),
        time: workout.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        duration: workout.duration, // in seconds
        sets: workout.sets,
        poses: workout.poses,
        calories: workout.calories,
        completionPercent: workout.completionPercent || 100
      });
      this.set(STORAGE_KEYS.HISTORY, history);
      window.dispatchEvent(new CustomEvent('rise_history_changed', { detail: history }));
    },

    clearAll() {
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      window.location.reload();
    }
  };

  // Expose to window namespace
  window.RISE_Storage = StorageService;
})(window);
