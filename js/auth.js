/* RISE — Authentication Module */

(function (window) {
  // Array of listeners for auth state changes
  const authStateListeners = [];

  const AuthService = {
    // Check if user is currently signed in
    get currentUser() {
      const user = window.RISE_Storage.getUser();
      return user.uid ? user : null;
    },

    // Attach listener for auth state changes (similar to firebase.auth().onAuthStateChanged)
    onAuthStateChanged(callback) {
      if (typeof callback === 'function') {
        authStateListeners.push(callback);
        // Call immediately with current state
        callback(this.currentUser);
      }
      // Return unsubscribe function
      return () => {
        const index = authStateListeners.indexOf(callback);
        if (index > -1) authStateListeners.splice(index, 1);
      };
    },

    // Notify all listeners
    _notifyStateChanged(user) {
      authStateListeners.forEach(callback => {
        try {
          callback(user);
        } catch (e) {
          console.error('Error in auth state change listener', e);
        }
      });
    },

    // Sign Up with Email and Password
    signUp(email, password, name) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (!email || !password || !name) {
            return reject(new Error('Please fill in all fields.'));
          }
          if (password.length < 6) {
            return reject(new Error('Password must be at least 6 characters.'));
          }

          // Mock checking if user exists
          const existingUsers = RISE_Storage.get('rise_mock_db_users', {});
          if (existingUsers[email]) {
            return reject(new Error('An account with this email already exists.'));
          }

          // Save to mock DB
          existingUsers[email] = { password, name, xp: 0, level: 'Beginner', currentStreak: 0, longestStreak: 0 };
          RISE_Storage.set('rise_mock_db_users', existingUsers);

          // Log in the user
          const user = {
            uid: 'uid_' + Math.random().toString(36).substr(2, 9),
            name: name,
            email: email,
            isGuest: false,
            xp: 0,
            level: 'Beginner',
            dailyGoalSets: 3,
            currentStreak: 0,
            longestStreak: 0,
            lastPracticeDate: '',
            perfectWeeks: 0,
            achievements: []
          };
          RISE_Storage.setUser(user);
          this._notifyStateChanged(user);
          resolve(user);
        }, 800); // Simulate network latency
      });
    },

    // Login with Email and Password
    login(email, password) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (!email || !password) {
            return reject(new Error('Please enter email and password.'));
          }

          const existingUsers = RISE_Storage.get('rise_mock_db_users', {});
          const mockUser = existingUsers[email];

          if (!mockUser || mockUser.password !== password) {
            return reject(new Error('Invalid email or password.'));
          }

          // Log in the user
          const user = {
            uid: 'uid_' + email.replace(/[^a-zA-Z0-9]/g, ''),
            name: mockUser.name,
            email: email,
            isGuest: false,
            xp: mockUser.xp || 0,
            level: mockUser.level || 'Beginner',
            dailyGoalSets: mockUser.dailyGoalSets || 3,
            currentStreak: mockUser.currentStreak || 0,
            longestStreak: mockUser.longestStreak || 0,
            lastPracticeDate: mockUser.lastPracticeDate || '',
            perfectWeeks: mockUser.perfectWeeks || 0,
            achievements: mockUser.achievements || []
          };
          RISE_Storage.setUser(user);
          this._notifyStateChanged(user);
          resolve(user);
        }, 800); // Simulate network latency
      });
    },

    // Continue as Guest
    loginAsGuest() {
      return new Promise((resolve) => {
        setTimeout(() => {
          const guestNames = ['Zen Master', 'Lotus Flower', 'Morning Sunrise', 'Quiet Mind', 'Flex Yogi', 'Prana Breather'];
          const randomName = guestNames[Math.floor(Math.random() * guestNames.length)];
          const user = {
            uid: 'guest_' + Math.random().toString(36).substr(2, 9),
            name: 'Guest ' + randomName,
            email: '',
            isGuest: true,
            xp: 0,
            level: 'Beginner',
            dailyGoalSets: 3,
            currentStreak: 0,
            longestStreak: 0,
            lastPracticeDate: '',
            perfectWeeks: 0,
            achievements: []
          };
          RISE_Storage.setUser(user);
          this._notifyStateChanged(user);
          resolve(user);
        }, 300);
      });
    },

    // Forgot Password
    forgotPassword(email) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (!email) {
            return reject(new Error('Please enter your email address.'));
          }
          const existingUsers = RISE_Storage.get('rise_mock_db_users', {});
          if (!existingUsers[email]) {
            return reject(new Error('No user found with this email.'));
          }
          // Mock password reset email send
          resolve('A reset link has been sent to your email.');
        }, 600);
      });
    },

    // Logout
    logout() {
      // Clear user data (or write back guest stats to mock database/local storage if desired)
      const user = RISE_Storage.getUser();
      if (!user.isGuest && user.email) {
        // Write stats back to mock DB users list
        const existingUsers = RISE_Storage.get('rise_mock_db_users', {});
        if (existingUsers[user.email]) {
          existingUsers[user.email].xp = user.xp;
          existingUsers[user.email].level = user.level;
          existingUsers[user.email].currentStreak = user.currentStreak;
          existingUsers[user.email].longestStreak = user.longestStreak;
          existingUsers[user.email].lastPracticeDate = user.lastPracticeDate;
          existingUsers[user.email].perfectWeeks = user.perfectWeeks;
          existingUsers[user.email].achievements = user.achievements;
          existingUsers[user.email].dailyGoalSets = user.dailyGoalSets;
          RISE_Storage.set('rise_mock_db_users', existingUsers);
        }
      }

      // Reset to default empty user in Storage
      RISE_Storage.setUser({
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
        achievements: []
      });
      this._notifyStateChanged(null);
    }
  };

  // Expose to window namespace
  window.RISE_Auth = AuthService;
})(window);
