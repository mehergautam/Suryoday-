/* RISE — Statistics & Gamification Module */

(function (window) {
  const LEVELS = [
    { name: 'Beginner', minXp: 0, maxXp: 499 },
    { name: 'Explorer', minXp: 500, maxXp: 1499 },
    { name: 'Warrior', minXp: 1500, maxXp: 2999 },
    { name: 'Yogi', minXp: 3000, maxXp: 5999 },
    { name: 'Master', minXp: 6000, maxXp: 9999 },
    { name: 'Sunrise Legend', minXp: 10000, maxXp: Infinity }
  ];

  const ACHIEVEMENTS_LIST = [
    { id: 'first_session', title: 'First Session', desc: 'Completed your first Surya Namaskar session.', icon: '🧘', xp: 50 },
    { id: 'streak_7', title: '7 Day Streak', desc: 'Maintained a consistent practice for 7 days.', icon: '🔥', xp: 150 },
    { id: 'streak_30', title: '30 Day Streak', desc: 'Practiced yoga for 30 consecutive days.', icon: '⚡', xp: 500 },
    { id: 'sessions_100', title: '100 Sessions', desc: 'Completed 100 total practice sessions.', icon: '💯', xp: 1000 },
    { id: 'sets_500', title: '500 Sets', desc: 'Completed 500 total sets of Surya Namaskar.', icon: '🏔', xp: 800 },
    { id: 'minutes_1000', title: '1000 Minutes', desc: 'Practiced yoga for a total of 1000 minutes.', icon: '☀', xp: 1000 },
    { id: 'sunrise_master', title: 'Sunrise Master', desc: 'Completed a workout before 8:00 AM.', icon: '🌅', xp: 200 },
    { id: 'consistency_king', title: 'Consistency King', desc: 'Achieved a consistency score of over 90%.', icon: '👑', xp: 300 }
  ];

  const StatsService = {
    // 1. XP and Level Calculations
    getLevelInfo(xp) {
      let level = LEVELS[0];
      for (let i = 0; i < LEVELS.length; i++) {
        if (xp >= LEVELS[i].minXp && xp <= LEVELS[i].maxXp) {
          level = LEVELS[i];
          break;
        }
      }

      const nextLevel = LEVELS[LEVELS.indexOf(level) + 1] || null;
      let percent = 100;
      let nextLevelXp = level.maxXp;
      
      if (nextLevel) {
        const range = level.maxXp - level.minXp + 1;
        const currentProgress = xp - level.minXp;
        percent = Math.min(100, Math.max(0, (currentProgress / range) * 100));
        nextLevelXp = level.maxXp + 1;
      }

      return {
        currentLevel: level.name,
        percent: percent,
        xpLeftToNext: nextLevel ? (nextLevel.minXp - xp) : 0,
        nextLevelName: nextLevel ? nextLevel.name : 'Max Level',
        minXp: level.minXp,
        maxXp: level.maxXp
      };
    },

    // Award XP based on sets, streak, and goal completion
    calculateXpEarned(setsCompleted, streakDays, goalCompleted) {
      let earned = setsCompleted * 50; // 50 XP per set
      if (goalCompleted) earned += 20; // 20 XP goal bonus
      earned += streakDays * 5; // 5 XP per active streak day
      return earned;
    },

    // 2. Streak and Goals
    checkAndUpdateStreak() {
      const user = window.RISE_Storage.getUser();
      const history = window.RISE_Storage.getHistory();
      
      if (history.length === 0) {
        user.currentStreak = 0;
        window.RISE_Storage.setUser(user);
        return;
      }

      const todayStr = new Date().toDateString();
      const yesterdayStr = new Date(Date.now() - 864e5).toDateString();
      
      // Group history dates
      const activeDates = new Set(history.map(h => SetDateStr(h.timestamp)));
      
      if (activeDates.has(todayStr)) {
        // Already practiced today, streak is safe
      } else if (activeDates.has(yesterdayStr)) {
        // Practiced yesterday, streak is maintained
      } else {
        // Gap of > 1 day, reset streak
        user.currentStreak = 0;
      }

      // Update longest streak
      if (user.currentStreak > user.longestStreak) {
        user.longestStreak = user.currentStreak;
      }

      window.RISE_Storage.setUser(user);
    },

    // Help format timestamp to readable date string
    _getDateString(timestamp) {
      return new Date(timestamp).toDateString();
    },

    // Check achievements list and return newly unlocked ids
    checkAchievements() {
      const user = window.RISE_Storage.getUser();
      const history = window.RISE_Storage.getHistory();
      
      const totalSessions = history.length;
      const totalSets = history.reduce((sum, h) => sum + h.sets, 0);
      const totalMinutes = history.reduce((sum, h) => sum + (h.duration / 60), 0);
      
      const newUnlockedIds = [];
      const currentUnlocked = new Set(user.achievements || []);

      ACHIEVEMENTS_LIST.forEach(ach => {
        if (currentUnlocked.has(ach.id)) return;

        let unlock = false;
        switch (ach.id) {
          case 'first_session':
            unlock = totalSessions >= 1;
            break;
          case 'streak_7':
            unlock = user.longestStreak >= 7;
            break;
          case 'streak_30':
            unlock = user.longestStreak >= 30;
            break;
          case 'sessions_100':
            unlock = totalSessions >= 100;
            break;
          case 'sets_500':
            unlock = totalSets >= 500;
            break;
          case 'minutes_1000':
            unlock = totalMinutes >= 1000;
            break;
          case 'sunrise_master':
            // Check if any session completed before 8:00 AM
            unlock = history.some(h => {
              const hour = new Date(h.timestamp).getHours();
              return hour < 8;
            });
            break;
          case 'consistency_king':
            unlock = this.getConsistencyScore(history) >= 90 && totalSessions >= 10;
            break;
        }

        if (unlock) {
          newUnlockedIds.push(ach.id);
          user.achievements.push(ach.id);
          // Award XP bonus
          user.xp += ach.xp;
        }
      });

      if (newUnlockedIds.length > 0) {
        // Re-evaluate level after XP change
        const levelInfo = this.getLevelInfo(user.xp);
        user.level = levelInfo.currentLevel;
        window.RISE_Storage.setUser(user);
      }

      return newUnlockedIds;
    },

    // Calculations
    getConsistencyScore(history) {
      if (history.length === 0) return 0;
      
      // Calculate fraction of active days in last 30 days
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 864e5);
      const activeDays = new Set();
      
      history.forEach(h => {
        if (h.timestamp >= thirtyDaysAgo) {
          activeDays.add(new Date(h.timestamp).toDateString());
        }
      });
      
      return Math.round((activeDays.size / 30) * 100);
    },

    // Get perfect weeks count in history
    getPerfectWeeks(history) {
      if (history.length === 0) return 0;
      
      // Map history days to ISO week numbers
      const weeks = {};
      history.forEach(h => {
        const d = new Date(h.timestamp);
        const wKey = this._getWeekKey(d);
        if (!weeks[wKey]) weeks[wKey] = new Set();
        weeks[wKey].add(d.getDay()); // 0 = Sunday, 1 = Monday, etc.
      });

      // A perfect week has active logs on at least 5 different days (as standard wellness metric) or all 7.
      // Let's require 5+ active days for a perfect week.
      let perfectCount = 0;
      for (const wKey in weeks) {
        if (weeks[wKey].size >= 5) {
          perfectCount++;
        }
      }
      return perfectCount;
    },

    _getWeekKey(date) {
      const oneJan = new Date(date.getFullYear(), 0, 1);
      const numberOfDays = Math.floor((date - oneJan) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil((date.getDay() + 1 + numberOfDays) / 7);
      return `${date.getFullYear()}-W${weekNumber}`;
    },

    // 3. Dynamic Charts (Pure SVG Strings)
    generateWeeklyLineChart(history) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const today = new Date();
      const chartWidth = 352;
      const chartHeight = 120;
      const padding = 20;

      // Initialize 7 days data (minutes practiced)
      const weeklyData = Array(7).fill(0).map((_, i) => {
        const d = new Date();
        d.setDate(today.getDate() - (6 - i));
        return {
          label: days[d.getDay()],
          dateStr: d.toDateString(),
          value: 0 // minutes
        };
      });

      // Fill data from history
      history.forEach(h => {
        const hDateStr = new Date(h.timestamp).toDateString();
        const found = weeklyData.find(w => w.dateStr === hDateStr);
        if (found) {
          found.value += Math.round(h.duration / 60);
        }
      });

      const maxVal = Math.max(...weeklyData.map(w => w.value), 10); // min height scaling factor

      // Calculate SVG points
      const points = weeklyData.map((d, i) => {
        const x = padding + (i * (chartWidth - 2 * padding) / 6);
        const y = chartHeight - padding - (d.value * (chartHeight - 2 * padding) / maxVal);
        return { x, y, val: d.value, label: d.label };
      });

      // Build path strings
      let pathD = `M ${points[0].x} ${points[0].y}`;
      let areaD = `M ${points[0].x} ${chartHeight - padding} L ${points[0].x} ${points[0].y}`;
      
      for (let i = 1; i < points.length; i++) {
        // Curve interpolation helper
        const cpX1 = points[i-1].x + (points[i].x - points[i-1].x) / 2;
        const cpY1 = points[i-1].y;
        const cpX2 = points[i-1].x + (points[i].x - points[i-1].x) / 2;
        const cpY2 = points[i].y;
        
        pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${points[i].x} ${points[i].y}`;
        areaD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${points[i].x} ${points[i].y}`;
      }
      areaD += ` L ${points[points.length-1].x} ${chartHeight - padding} Z`;

      // Generate SVG markup
      let svg = `
        <svg viewBox="0 0 ${chartWidth} ${chartHeight}" class="stats-svg">
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#FFB000" stop-opacity="0.3"></stop>
              <stop offset="100%" stop-color="#FFB000" stop-opacity="0.0"></stop>
            </linearGradient>
          </defs>
          
          <!-- Grid lines -->
          <line x1="${padding}" y1="${padding}" x2="${chartWidth - padding}" y2="${padding}" stroke="rgba(255,255,255,0.03)" stroke-width="1"></line>
          <line x1="${padding}" y1="${chartHeight/2}" x2="${chartWidth - padding}" y2="${chartHeight/2}" stroke="rgba(255,255,255,0.03)" stroke-width="1"></line>
          <line x1="${padding}" y1="${chartHeight - padding}" x2="${chartWidth - padding}" y2="${chartHeight - padding}" stroke="rgba(255,255,255,0.08)" stroke-width="1"></line>

          <!-- Area under curve -->
          <path d="${areaD}" fill="url(#chartGrad)"></path>

          <!-- Smooth Line -->
          <path d="${pathD}" fill="none" stroke="#FFB000" stroke-width="2.5" stroke-linecap="round"></path>

          <!-- Data Points & Labels -->
      `;

      points.forEach(p => {
        svg += `
          <circle cx="${p.x}" cy="${p.y}" r="4" fill="#FFB000" stroke="#0B0F17" stroke-width="1.5"></circle>
          <text x="${p.x}" y="${chartHeight - 4}" fill="#94A3B8" font-size="9" text-anchor="middle" font-family="Inter, sans-serif">${p.label}</text>
          ${p.val > 0 ? `<text x="${p.x}" y="${p.y - 8}" fill="#FFFFFF" font-size="9" font-weight="600" text-anchor="middle" font-family="Inter, sans-serif">${p.val}m</text>` : ''}
        `;
      });

      svg += `</svg>`;
      return svg;
    },

    generateMonthlyBarChart(history) {
      const chartWidth = 352;
      const chartHeight = 120;
      const padding = 20;

      // Group history into the last 4 weeks
      const weeklySets = [0, 0, 0, 0]; // Index 3 is this week, index 2 is last week, etc.
      const now = Date.now();
      const weekMs = 7 * 864e5;

      history.forEach(h => {
        const age = now - h.timestamp;
        const weekIndex = 3 - Math.floor(age / weekMs);
        if (weekIndex >= 0 && weekIndex <= 3) {
          weeklySets[weekIndex] += h.sets;
        }
      });

      const maxSets = Math.max(...weeklySets, 5);
      const barWidth = 36;
      const gap = (chartWidth - 2 * padding - 4 * barWidth) / 3;

      let svg = `
        <svg viewBox="0 0 ${chartWidth} ${chartHeight}" class="stats-svg">
          <line x1="${padding}" y1="${chartHeight - padding}" x2="${chartWidth - padding}" y2="${chartHeight - padding}" stroke="rgba(255,255,255,0.08)" stroke-width="1"></line>
      `;

      weeklySets.forEach((sets, i) => {
        const x = padding + i * (barWidth + gap);
        const barHeight = Math.max(4, (sets * (chartHeight - 2 * padding) / maxSets));
        const y = chartHeight - padding - barHeight;
        const label = i === 3 ? 'This Wk' : i === 2 ? 'Last Wk' : `Wk -${3 - i}`;

        // Golden rounded bar
        svg += `
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="6" fill="#FFB000" opacity="${0.4 + (i * 0.2)}"></rect>
          <text x="${x + barWidth/2}" y="${chartHeight - 4}" fill="#94A3B8" font-size="9" text-anchor="middle" font-family="Inter, sans-serif">${label}</text>
          ${sets > 0 ? `<text x="${x + barWidth/2}" y="${y - 6}" fill="#FFFFFF" font-size="9" font-weight="600" text-anchor="middle" font-family="Inter, sans-serif">${sets} sets</text>` : ''}
        `;
      });

      svg += `</svg>`;
      return svg;
    },

    // 4. Contribution Calendar (GitHub Style)
    // Renders 24 weeks of active days
    generateContributionCalendar(history) {
      const activeDays = {}; // Key: YYYY-MM-DD, Value: sets completed
      history.forEach(h => {
        const d = new Date(h.timestamp);
        const yyyymmdd = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        activeDays[yyyymmdd] = (activeDays[yyyymmdd] || 0) + h.sets;
      });

      const today = new Date();
      // Go back 23 weeks to the start of the week (Sunday)
      const startDate = new Date();
      startDate.setDate(today.getDate() - (23 * 7) - today.getDay());

      let html = '<div class="calendar-grid">';
      
      // Build columns (weeks)
      for (let w = 0; w < 24; w++) {
        html += '<div class="calendar-column">';
        for (let d = 0; d < 7; d++) {
          const currentDate = new Date(startDate.getTime());
          currentDate.setDate(startDate.getDate() + (w * 7) + d);
          
          if (currentDate > today) {
            // Future days are disabled/hidden
            html += '<div class="calendar-day empty"></div>';
            continue;
          }

          const yyyymmdd = currentDate.getFullYear() + '-' + String(currentDate.getMonth() + 1).padStart(2, '0') + '-' + String(currentDate.getDate()).padStart(2, '0');
          const setsCount = activeDays[yyyymmdd] || 0;
          
          let colorClass = 'lvl-0';
          if (setsCount > 0) {
            if (setsCount <= 2) colorClass = 'lvl-1';
            else if (setsCount <= 5) colorClass = 'lvl-2';
            else if (setsCount <= 10) colorClass = 'lvl-3';
            else colorClass = 'lvl-4';
          }

          const dateLabel = currentDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
          const hoverText = setsCount > 0 
            ? `${setsCount} sets completed on ${dateLabel}`
            : `No activity on ${dateLabel}`;

          html += `<div class="calendar-day ${colorClass}" 
                        data-date="${yyyymmdd}" 
                        title="${hoverText}"
                        onclick="RISE_UI.showDayDetails('${yyyymmdd}')">
                  </div>`;
        }
        html += '</div>';
      }
      html += '</div>';
      return html;
    }
  };

  function SetDateStr(ts) {
    return new Date(ts).toDateString();
  }

  // Expose
  window.RISE_Stats = StatsService;
  window.RISE_AchievementsList = ACHIEVEMENTS_LIST;
})(window);
