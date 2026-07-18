/* RISE — App Entry Point & Coordinator */

(function (window) {
  window.RISE_trimmedCache = {};

  // Auto-trim transparent padding to normalize visual size and baseline of pose images
  function preloadAndTrimPoses() {
    const poses = window.RISE_Workout.poses;
    
    poses.forEach(p => {
      const url = `assets/poses/${p.file}`;
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; 
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        
        let imageData;
        try {
          imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch (e) {
          // CORS fallback if running from raw file protocol in some strict environments
          window.RISE_trimmedCache[p.file] = url;
          return;
        }
        
        const data = imageData.data;
        let top = 0, bottom = canvas.height, left = 0, right = canvas.width;
        
        // Find top bound
        for (let y = 0; y < canvas.height; y++) {
          let empty = true;
          for (let x = 0; x < canvas.width; x++) { 
            if (data[(y * canvas.width + x) * 4 + 3] > 10) { 
              empty = false; 
              break; 
            } 
          }
          if (!empty) { top = y; break; }
        }
        
        // Find bottom bound
        for (let y = canvas.height - 1; y >= 0; y--) {
          let empty = true;
          for (let x = 0; x < canvas.width; x++) { 
            if (data[(y * canvas.width + x) * 4 + 3] > 10) { 
              empty = false; 
              break; 
            } 
          }
          if (!empty) { bottom = y; break; }
        }
        
        // Find left bound
        for (let x = 0; x < canvas.width; x++) {
          let empty = true;
          for (let y = 0; y < canvas.height; y++) { 
            if (data[(y * canvas.width + x) * 4 + 3] > 10) { 
              empty = false; 
              break; 
            } 
          }
          if (!empty) { left = x; break; }
        }
        
        // Find right bound
        for (let x = canvas.width - 1; x >= 0; x--) {
          let empty = true;
          for (let y = 0; y < canvas.height; y++) { 
            if (data[(y * canvas.width + x) * 4 + 3] > 10) { 
              empty = false; 
              break; 
            } 
          }
          if (!empty) { right = x; break; }
        }
        
        let w = right - left, h = bottom - top;
        if (w <= 0 || h <= 0) { 
          window.RISE_trimmedCache[p.file] = url; 
          return; 
        }
        
        const pad = 2; // slight safety pad
        top = Math.max(0, top - pad); 
        bottom = Math.min(canvas.height, bottom + pad);
        left = Math.max(0, left - pad); 
        right = Math.min(canvas.width, right + pad);
        w = right - left; 
        h = bottom - top;
        
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = w; 
        cropCanvas.height = h;
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.drawImage(canvas, left, top, w, h, 0, 0, w, h);
        
        window.RISE_trimmedCache[p.file] = cropCanvas.toDataURL('image/png');
      };
      
      img.src = url;
    });
  }

  // Initialize all elements once content is loaded
  document.addEventListener('DOMContentLoaded', () => {
    // 1. Preload and trim images in background
    preloadAndTrimPoses();
    
    // 2. Initialize UI layout and bindings
    window.RISE_UI.init();
    
    // 3. Verify streaks on startup
    window.RISE_Stats.checkAndUpdateStreak();
  });
})(window);
