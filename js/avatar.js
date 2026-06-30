// CorrectMe Canvas-based Avatar Engine
// Render 2D expressive character with 4 states: idle, listening, thinking, speaking

export class Avatar {
  constructor(canvas, audioEngine = null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audioEngine = audioEngine;
    
    this.state = 'idle'; // 'idle' | 'listening' | 'thinking' | 'speaking'
    
    // Position and size (will be updated dynamically on resize)
    this.x = 0;
    this.y = 0;
    this.baseRadius = 90;
    this.radius = 90;
    
    // Visual states for animation
    this.scale = 1.0;
    this.blinkTimer = 0;
    this.blinkDuration = 10; // frames for blink
    this.isBlinking = false;
    
    // Eyes parameter
    this.eyeHeight = 22;
    this.eyeWidth = 14;
    this.eyeSpacing = 30;
    this.pupilSize = 6;
    this.pupilXOffset = 0;
    this.pupilYOffset = 0;
    this.targetPupilX = 0;
    this.targetPupilY = 0;
    
    // Mouth parameter
    this.mouthWidth = 40;
    this.mouthHeight = 10;
    
    // Ripples (for listening state)
    this.ripples = [];
    this.rippleSpawnTimer = 0;
    
    // Thinking state parameters
    this.thinkingAngle = 0;
    
    // Speaking state parameters
    this.speakCycle = 0;
    this.speakVolume = 0; // Simulated volume [0, 1]
    
    // Mouse tracking for eyes
    window.addEventListener('mousemove', (e) => this.trackMouse(e));
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    
    this.x = rect.width / 2;
    this.y = rect.height / 2;
    
    // Scale avatar size slightly based on canvas width
    this.baseRadius = Math.min(rect.width, rect.height) * 0.28;
    if (this.baseRadius < 60) this.baseRadius = 60;
    if (this.baseRadius > 110) this.baseRadius = 110;
    this.radius = this.baseRadius;
  }

  trackMouse(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - this.x;
    const mouseY = e.clientY - rect.top - this.y;
    
    // Calculate angle & distance
    const dist = Math.sqrt(mouseX * mouseX + mouseY * mouseY);
    const maxDist = 200;
    const strength = Math.min(dist / maxDist, 1.0) * 4; // max offset is 4px
    const angle = Math.atan2(mouseY, mouseX);
    
    this.targetPupilX = Math.cos(angle) * strength;
    this.targetPupilY = Math.sin(angle) * strength;
  }

  setState(newState) {
    if (this.state === newState) return;
    this.state = newState;
    
    // Reset or prepare specific state parameters
    if (newState === 'listening') {
      this.ripples = [];
      this.rippleSpawnTimer = 0;
    } else if (newState === 'thinking') {
      this.thinkingAngle = 0;
    } else if (newState === 'speaking') {
      this.speakCycle = 0;
      this.speakVolume = 0.5;
    }
  }

  update() {
    // 1. Gentle breathing scale pulse (faster in listening/speaking, slower in idle)
    const time = Date.now() * 0.001;
    let pulseSpeed = 2;
    let pulseAmt = 0.02;
    
    if (this.state === 'idle') {
      pulseSpeed = 2;
      pulseAmt = 0.015;
    } else if (this.state === 'listening') {
      pulseSpeed = 4;
      pulseAmt = 0.03;
    } else if (this.state === 'speaking') {
      pulseSpeed = 6;
      pulseAmt = 0.04;
    } else if (this.state === 'thinking') {
      pulseSpeed = 1;
      pulseAmt = 0.01;
    }
    
    this.scale = 1.0 + Math.sin(time * pulseSpeed) * pulseAmt;
    this.radius = this.baseRadius * this.scale;
    
    // 2. Pupil interpolation for smooth movement
    this.pupilXOffset += (this.targetPupilX - this.pupilXOffset) * 0.1;
    this.pupilYOffset += (this.targetPupilY - this.pupilYOffset) * 0.1;

    // 3. Eye blinking logic (only in Idle/Listening/Speaking, not Thinking)
    if (this.state !== 'thinking') {
      this.blinkTimer++;
      if (!this.isBlinking && Math.random() < 0.007 && this.blinkTimer > 100) {
        this.isBlinking = true;
        this.blinkTimer = 0;
      }
      if (this.isBlinking) {
        if (this.blinkTimer >= this.blinkDuration) {
          this.isBlinking = false;
          this.blinkTimer = 0;
        }
      }
    }

    // 4. Update Ripples for Listening state
    if (this.state === 'listening') {
      this.rippleSpawnTimer++;
      if (this.rippleSpawnTimer > 40) {
        this.ripples.push({ r: this.radius, alpha: 0.5 });
        this.rippleSpawnTimer = 0;
      }
      
      this.ripples.forEach((rp, idx) => {
        rp.r += 1.8;
        rp.alpha -= 0.008;
        if (rp.alpha <= 0) {
          this.ripples.splice(idx, 1);
        }
      });
    }

    // 5. Update Thinking state parameters
    if (this.state === 'thinking') {
      this.thinkingAngle += 0.06;
    }

    // 6. Update Speaking state parameters (mouth flutter & body scaling)
    if (this.state === 'speaking') {
      if (this.audioEngine && this.audioEngine.isElevenLabsPlaying) {
        this.speakVolume = this.audioEngine.getVolume();
      } else {
        this.speakCycle += 0.25;
        this.speakVolume = 0.3 + Math.sin(this.speakCycle) * 0.4 + Math.random() * 0.3;
        this.speakVolume = Math.max(0, Math.min(1, this.speakVolume));
      }
      
      // Add extra scale flutter based on speech amplitude
      this.radius += this.speakVolume * 6;
    }
  }

  draw() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);
    this.ctx.clearRect(0, 0, width, height);

    this.ctx.save();
    
    // Draw Listening ripples first (under the body)
    if (this.state === 'listening') {
      this.ripples.forEach(rp => {
        this.ctx.beginPath();
        this.ctx.arc(this.x, this.y, rp.r, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(74, 144, 217, ${rp.alpha})`;
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
      });
    }

    // Draw Main Body Shadow
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    this.ctx.shadowColor = 'rgba(74, 144, 217, 0.4)';
    this.ctx.shadowBlur = 30;
    this.ctx.shadowOffsetY = 10;
    
    // Main Body Gradient
    const gradient = this.ctx.createRadialGradient(
      this.x - this.radius * 0.3, this.y - this.radius * 0.3, this.radius * 0.1,
      this.x, this.y, this.radius
    );
    gradient.addColorStop(0, '#5A9DF0');
    gradient.addColorStop(0.5, '#4A90D9');
    gradient.addColorStop(1, '#2E75BD');
    this.ctx.fillStyle = gradient;
    this.ctx.fill();
    
    // Reset shadow
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetY = 0;

    // Draw Face elements
    if (this.state === 'thinking') {
      this.drawThinkingFace();
    } else {
      this.drawEyes();
      this.drawMouth();
    }

    this.ctx.restore();
  }

  drawEyes() {
    const leftEyeX = this.x - this.eyeSpacing;
    const rightEyeX = this.x + this.eyeSpacing;
    const eyeY = this.y - 12;

    let currentEyeHeight = this.eyeHeight;
    
    // Apply blink
    if (this.isBlinking) {
      const half = this.blinkDuration / 2;
      const progress = this.blinkTimer < half 
        ? this.blinkTimer / half 
        : (this.blinkDuration - this.blinkTimer) / half;
      currentEyeHeight = this.eyeHeight * (1.0 - progress * 0.95);
    }
    
    // Specific state overrides for eyes
    if (this.state === 'listening') {
      // Wide open eyes
      currentEyeHeight = this.eyeHeight * 1.15;
    } else if (this.state === 'speaking') {
      // Slightly squinty/animated based on volume
      currentEyeHeight = this.eyeHeight * (0.85 + (1.0 - this.speakVolume) * 0.2);
    }

    // Draw both eyes
    [leftEyeX, rightEyeX].forEach((ex, index) => {
      this.ctx.save();
      this.ctx.beginPath();
      // Draw white of the eye (ellipse)
      this.ctx.ellipse(ex, eyeY, this.eyeWidth, currentEyeHeight, 0, 0, Math.PI * 2);
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.fill();
      
      // Draw pupils (unless eyes are closed)
      if (currentEyeHeight > 3) {
        this.ctx.beginPath();
        // Pupil placement offset by tracking + blink adjustment
        const pupilX = ex + this.pupilXOffset;
        const pupilY = eyeY + this.pupilYOffset;
        
        // Pupil radius
        let pRadius = this.pupilSize;
        if (this.state === 'listening') pRadius = this.pupilSize * 1.1;
        
        this.ctx.arc(pupilX, pupilY, pRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = '#1D212A';
        this.ctx.fill();
        
        // Pupil highlight (small white dot)
        this.ctx.beginPath();
        this.ctx.arc(pupilX - 2, pupilY - 2, 2, 0, Math.PI * 2);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fill();
      }
      this.ctx.restore();
    });
  }

  drawMouth() {
    const mouthY = this.y + 20;
    
    this.ctx.save();
    this.ctx.beginPath();
    
    if (this.state === 'idle') {
      // Gentle smiling mouth
      this.ctx.moveTo(this.x - this.mouthWidth / 2, mouthY);
      this.ctx.quadraticCurveTo(this.x, mouthY + this.mouthHeight, this.x + this.mouthWidth / 2, mouthY);
      this.ctx.strokeStyle = '#FFFFFF';
      this.ctx.lineWidth = 5;
      this.ctx.lineCap = 'round';
      this.ctx.stroke();
    } 
    else if (this.state === 'listening') {
      // Small "O" or open mouth representing listening eagerly
      const listenWidth = this.mouthWidth * 0.6;
      const listenHeight = 8;
      this.ctx.ellipse(this.x, mouthY + 2, listenWidth / 2, listenHeight, 0, 0, Math.PI * 2);
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.fill();
    } 
    else if (this.state === 'speaking') {
      // Mouth opening/closing synced to speakVolume
      const currentMouthHeight = Math.max(2, this.mouthHeight * 2.5 * this.speakVolume);
      const currentMouthWidth = this.mouthWidth * (0.8 + this.speakVolume * 0.3);
      
      this.ctx.ellipse(this.x, mouthY + 2, currentMouthWidth / 2, currentMouthHeight, 0, 0, Math.PI * 2);
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.fill();
      
      // Inside mouth dark shading
      this.ctx.beginPath();
      this.ctx.ellipse(this.x, mouthY + 2, currentMouthWidth / 2.4, currentMouthHeight * 0.8, 0, 0, Math.PI * 2);
      this.ctx.fillStyle = '#22609A';
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawThinkingFace() {
    // Drawn when processing: no eyes/mouth, instead a spinning circle of 3 dots
    const centerY = this.y - 5;
    const dotCount = 3;
    const radius = 25; // radius of the circle they rotate around
    
    for (let i = 0; i < dotCount; i++) {
      // Math to find position of the dots based on time/thinkingAngle
      const angle = this.thinkingAngle + (i * Math.PI * 2) / dotCount;
      const dotX = this.x + Math.cos(angle) * radius;
      const dotY = centerY + Math.sin(angle) * radius;
      
      // Calculate dot size (smooth pulse)
      const pulse = 1.0 + Math.sin(this.thinkingAngle * 2 + i) * 0.35;
      const size = 7 * pulse;
      
      // Gradient / Fade color
      this.ctx.beginPath();
      this.ctx.arc(dotX, dotY, size, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + 0.6 * pulse})`;
      this.ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
      this.ctx.shadowBlur = 10;
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    }
    
    // Subtle flat curve below for processing mouth
    const mouthY = this.y + 24;
    this.ctx.beginPath();
    this.ctx.moveTo(this.x - 15, mouthY);
    this.ctx.lineTo(this.x + 15, mouthY);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    this.ctx.lineWidth = 4;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();
  }

  animate() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.animate());
  }
}
