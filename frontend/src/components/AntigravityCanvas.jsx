import React, { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

function safeAlpha(val, fallback = 1) {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(1, num));
}

function setAlpha(ctx, val) {
  ctx.globalAlpha = safeAlpha(val, 1);
}

function hexToRgba(hex, alpha = 1) {
  const a = safeAlpha(alpha, 1).toFixed(3);
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
    return `rgba(99, 102, 241, ${a})`;
  }
  let c = hex.substring(1);
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(99, 102, 241, ${a})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export default function AntigravityCanvas({ theme = 'hub', interactive = true }) {
  const canvasRef = useRef(null);
  const { isDark } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Palette per role - calibrated for dark glow vs light jewel-contrast
    const darkPalettes = {
      creator: ['#818cf8', '#6366f1', '#a855f7', '#c084fc', '#38bdf8', '#4f46e5'],
      buyer: ['#34d399', '#10b981', '#14b8a6', '#2dd4bf', '#06b6d4', '#059669'],
      moderator: ['#fbbf24', '#f59e0b', '#d97706', '#fcd34d', '#fef08a', '#ea580c'],
      hub: ['#818cf8', '#34d399', '#fbbf24', '#38bdf8', '#c084fc', '#f59e0b'],
    };

    const lightPalettes = {
      creator: ['#4f46e5', '#6366f1', '#7c3aed', '#2563eb', '#4338ca', '#9333ea'],
      buyer: ['#059669', '#10b981', '#0d9488', '#0284c7', '#047857', '#16a34a'],
      moderator: ['#d97706', '#b45309', '#f59e0b', '#ca8a04', '#92400e', '#ea580c'],
      hub: ['#4f46e5', '#059669', '#d97706', '#0284c7', '#7c3aed', '#b45309'],
    };

    const currentPaletteSet = isDark ? darkPalettes : lightPalettes;
    const colors = currentPaletteSet[theme] || currentPaletteSet.hub;
    const primaryColor = colors[0];

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse state with radius = 50 as requested
    const mouse = {
      x: width / 2,
      y: height / 2,
      targetX: width / 2,
      targetY: height / 2,
      radius: 50,
      active: false,
    };

    // Denser particle count (180 - 240 particles)
    const particleCount = Math.min(Math.floor((width * height) / 6200), 220);
    const particles = [];

    class Particle {
      constructor() {
        this.reset(true);
      }

      reset(initial = false) {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.7;
        this.vy = (Math.random() - 0.5) * 0.7;

        // Categorize into 3 visual layers for rich depth
        const rand = Math.random();
        if (rand < 0.6) {
          // Dust / micro-stars
          this.layer = 'dust';
          this.radius = Math.random() * 1.5 + 0.8;
          this.alpha = Math.random() * 0.45 + 0.2;
          this.mass = 1;
        } else if (rand < 0.9) {
          // Interactive medium nodes (connect with lines)
          this.layer = 'node';
          this.radius = Math.random() * 2.5 + 1.8;
          this.alpha = Math.random() * 0.6 + 0.35;
          this.mass = 1.8;
        } else {
          // Luminous celestial orbs (larger with soft bloom)
          this.layer = 'orb';
          this.radius = Math.random() * 3.5 + 3.2;
          this.alpha = Math.random() * 0.75 + 0.4;
          this.mass = 3;
        }

        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.pulseSpeed = Math.random() * 0.025 + 0.01;
        this.pulse = Math.random() * Math.PI * 2;
      }

      update() {
        // Zero-G drifting oscillations
        this.pulse += this.pulseSpeed;
        this.x += this.vx + Math.sin(this.pulse) * 0.25;
        this.y += this.vy + Math.cos(this.pulse) * 0.25;

        // Interactive Anti-Gravity Mouse Field (Radius 50)
        if (interactive && mouse.active) {
          const dx = this.x - mouse.x;
          const dy = this.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < mouse.radius && dist > 0) {
            const forceRatio = 1 - dist / mouse.radius;
            const force = forceRatio * 6;
            const angle = Math.atan2(dy, dx);
            this.vx += (Math.cos(angle) * force) / this.mass;
            this.vy += (Math.sin(angle) * force) / this.mass;
          }
        }

        // Damping to settle smoothly back into weightless floating
        this.vx *= 0.94;
        this.vy *= 0.94;

        // Wrap around viewport edges
        if (this.x < -20) this.x = width + 20;
        if (this.x > width + 20) this.x = -20;
        if (this.y < -20) this.y = height + 20;
        if (this.y > height + 20) this.y = -20;
      }

      draw() {
        ctx.save();
        const dynamicAlpha = this.alpha * (0.8 + Math.sin(this.pulse) * 0.25);
        setAlpha(ctx, dynamicAlpha);

        if (this.layer === 'orb') {
          ctx.shadowBlur = 14;
          ctx.shadowColor = this.color;
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.radius * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = this.color;
          setAlpha(ctx, dynamicAlpha * 0.3);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = this.layer === 'dust' ? 4 : 10;
        ctx.shadowColor = this.color;
        setAlpha(ctx, dynamicAlpha);
        ctx.fill();
        ctx.restore();
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    // Multi-ring concentric ripple effect on click
    const shockwaves = [];
    class RippleRing {
      constructor(x, y, color, delayFrames, speed = 5.5, maxRadius = 320, initialAlpha = 0.85) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.delay = delayFrames;
        this.radius = 4;
        this.speed = speed;
        this.maxRadius = maxRadius;
        this.alpha = initialAlpha;
        this.initialAlpha = initialAlpha;
        this.decay = 0.016;
      }

      update() {
        if (this.delay > 0) {
          this.delay--;
          return;
        }
        this.radius += this.speed;
        this.speed = Math.max(1.6, this.speed * 0.986);
        this.alpha -= this.decay;
      }

      draw() {
        if (this.delay > 0 || this.alpha <= 0.01 || this.radius <= 0) return;
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = this.color;
        setAlpha(ctx, this.alpha);
        ctx.lineWidth = Math.max(0.8, 2.8 * (this.alpha / this.initialAlpha));
        ctx.shadowBlur = 16;
        ctx.shadowColor = this.color;
        ctx.stroke();

        // Epicenter glow dot in early stage
        if (this.delay === 0 && this.radius < 25 && this.initialAlpha > 0.8) {
          ctx.beginPath();
          ctx.arc(this.x, this.y, Math.max(1, 8 - this.radius * 0.3), 0, Math.PI * 2);
          ctx.fillStyle = this.color;
          setAlpha(ctx, this.alpha);
          ctx.shadowBlur = 20;
          ctx.fill();
        }

        // Illuminate cyber grid intersection nodes along the expanding wavefront
        if (this.radius > 20 && this.radius < this.maxRadius) {
          const stepAngle = Math.PI / 6; // 12 radar pulse nodes along the circumference
          ctx.beginPath();
          for (let a = 0; a < Math.PI * 2; a += stepAngle) {
            const rx = this.x + Math.cos(a) * this.radius;
            const ry = this.y + Math.sin(a) * this.radius;
            const snapX = Math.round(rx / 50) * 50;
            const snapY = Math.round(ry / 50) * 50;
            ctx.moveTo(snapX + 2.5, snapY);
            ctx.arc(snapX, snapY, 2.5, 0, Math.PI * 2);
          }
          ctx.fillStyle = this.color;
          setAlpha(ctx, this.alpha * 0.85);
          ctx.shadowBlur = 12;
          ctx.shadowColor = this.color;
          ctx.fill();
        }

        ctx.restore();
      }
    }

    // Event listeners
    const handleMouseMove = (e) => {
      mouse.active = true;
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
    };

    const handleClick = (e) => {
      const clickColor = colors[Math.floor(Math.random() * colors.length)];

      // Spawn 4 concentric expanding ripple waves with sequential delay
      shockwaves.push(new RippleRing(e.clientX, e.clientY, clickColor, 0, 6.4, 340, 0.9));
      shockwaves.push(new RippleRing(e.clientX, e.clientY, clickColor, 7, 5.4, 300, 0.72));
      shockwaves.push(new RippleRing(e.clientX, e.clientY, clickColor, 14, 4.5, 260, 0.55));
      shockwaves.push(new RippleRing(e.clientX, e.clientY, clickColor, 22, 3.6, 210, 0.38));

      // Propel particles along the anti-gravity wave
      particles.forEach((p) => {
        const dx = p.x - e.clientX;
        const dy = p.y - e.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 260 && dist > 0) {
          const force = (1 - dist / 260) * 14;
          const angle = Math.atan2(dy, dx);
          p.vx += Math.cos(angle) * force;
          p.vy += Math.sin(angle) * force;
        }
      });
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseleave', handleMouseLeave);
      window.addEventListener('click', handleClick);
    }
    window.addEventListener('resize', handleResize);

    // Background Cyber Grid & Radar Scan state
    let scanY = 0;
    const gridSize = 50;

    // Animation Loop
    const render = () => {
      try {
        mouse.x += (mouse.targetX - mouse.x) * 0.16;
        mouse.y += (mouse.targetY - mouse.y) * 0.16;

        ctx.clearRect(0, 0, width, height);

        // 1. Draw Ambient Cyber Grid Matrix
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(15, 23, 42, 0.04)';
        ctx.lineWidth = 1;
        setAlpha(ctx, 1);

        for (let y = 0; y <= height; y += gridSize) {
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        }
        for (let x = 0; x <= width; x += gridSize) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }
        ctx.stroke();
        ctx.restore();

        // 2. Cyber Radar / Integrity Scan Sweep Beam
        scanY = (scanY + 0.8) % (height + 80);
        const topY = Math.max(0, scanY - 45);
        if (scanY > topY + 1) {
          ctx.save();
          const scanGrad = ctx.createLinearGradient(0, topY, 0, scanY);
          scanGrad.addColorStop(0, 'transparent');
          scanGrad.addColorStop(0.85, hexToRgba(primaryColor, isDark ? 0.06 : 0.04));
          scanGrad.addColorStop(1, hexToRgba(primaryColor, isDark ? 0.22 : 0.14));
          ctx.fillStyle = scanGrad;
          ctx.fillRect(0, topY, width, scanY - topY);

          ctx.beginPath();
          ctx.strokeStyle = hexToRgba(primaryColor, isDark ? 0.35 : 0.22);
          ctx.lineWidth = 1.2;
          ctx.shadowBlur = 8;
          ctx.shadowColor = primaryColor;
          ctx.moveTo(0, scanY);
          ctx.lineTo(width, scanY);
          ctx.stroke();
          ctx.restore();
        }

        // 3. Interactive Gravitational Spacetime Lensing & Illuminated Grid around Mouse
        if (interactive && mouse.active && Number.isFinite(mouse.x) && Number.isFinite(mouse.y)) {
          const spotlightR = 220;
          const minGX = Math.max(0, Math.floor((mouse.x - spotlightR) / gridSize) * gridSize);
          const maxGX = Math.min(width, Math.ceil((mouse.x + spotlightR) / gridSize) * gridSize);
          const minGY = Math.max(0, Math.floor((mouse.y - spotlightR) / gridSize) * gridSize);
          const maxGY = Math.min(height, Math.ceil((mouse.y + spotlightR) / gridSize) * gridSize);

          ctx.save();
          ctx.shadowBlur = 8;
          ctx.shadowColor = primaryColor;

          // Horizontal spotlight grid lines
          for (let gy = minGY; gy <= maxGY; gy += gridSize) {
            const distY = Math.abs(gy - mouse.y);
            if (distY <= spotlightR) {
              const lineAlpha = (1 - distY / spotlightR) * (isDark ? 0.35 : 0.22);
              ctx.beginPath();
              ctx.strokeStyle = hexToRgba(primaryColor, lineAlpha);
              ctx.lineWidth = 1.2;
              ctx.moveTo(minGX, gy);
              ctx.lineTo(maxGX, gy);
              ctx.stroke();
            }
          }

          // Vertical spotlight grid lines
          for (let gx = minGX; gx <= maxGX; gx += gridSize) {
            const distX = Math.abs(gx - mouse.x);
            if (distX <= spotlightR) {
              const lineAlpha = (1 - distX / spotlightR) * (isDark ? 0.35 : 0.22);
              ctx.beginPath();
              ctx.strokeStyle = hexToRgba(primaryColor, lineAlpha);
              ctx.lineWidth = 1.2;
              ctx.moveTo(gx, minGY);
              ctx.lineTo(gx, maxGY);
              ctx.stroke();
            }
          }

          // Glowing crosshairs '+' at grid intersections with gravitational lens deflection
          const crossSize = 4;
          for (let gx = minGX; gx <= maxGX; gx += gridSize) {
            for (let gy = minGY; gy <= maxGY; gy += gridSize) {
              const dx = gx - mouse.x;
              const dy = gy - mouse.y;
              const dist = Math.sqrt(dx * dx + dy * dy);

              if (dist < 190 && dist > 1) {
                const crossAlpha = (1 - dist / 190) * (isDark ? 0.75 : 0.55);
                const angle = Math.atan2(dy, dx);
                // Subtle spacetime gravitational repulsion away from cursor
                const warp = Math.max(0, 1 - dist / 130) * 10;
                const cx = gx + Math.cos(angle) * warp;
                const cy = gy + Math.sin(angle) * warp;

                ctx.strokeStyle = hexToRgba(primaryColor, crossAlpha);
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.moveTo(cx - crossSize, cy);
                ctx.lineTo(cx + crossSize, cy);
                ctx.moveTo(cx, cy - crossSize);
                ctx.lineTo(cx, cy + crossSize);
                ctx.stroke();
              }
            }
          }

          ctx.restore();
        }

        // 4. Ambient luminous cursor halo (Radius 50)
        if (interactive && mouse.active && Number.isFinite(mouse.x) && Number.isFinite(mouse.y)) {
          const glowRadius = mouse.radius;
          const grad = ctx.createRadialGradient(
            mouse.x,
            mouse.y,
            0,
            mouse.x,
            mouse.y,
            glowRadius
          );
          grad.addColorStop(0, hexToRgba(primaryColor, 0.25));
          grad.addColorStop(0.5, hexToRgba(primaryColor, 0.08));
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, glowRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        // 5. Constellation lines between medium/orb particles
        const activeNodes = particles.filter((p) => p.layer !== 'dust');
        for (let i = 0; i < activeNodes.length; i++) {
          for (let j = i + 1; j < activeNodes.length; j++) {
            const dx = activeNodes[i].x - activeNodes[j].x;
            const dy = activeNodes[i].y - activeNodes[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 95 && dist > 0) {
              const lineAlpha = (1 - dist / 95) * 0.2;
              ctx.beginPath();
              ctx.moveTo(activeNodes[i].x, activeNodes[i].y);
              ctx.lineTo(activeNodes[j].x, activeNodes[j].y);
              ctx.strokeStyle = activeNodes[i].color;
              setAlpha(ctx, lineAlpha);
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        }

        // 6. Draw and update particles
        particles.forEach((p) => {
          p.update();
          p.draw();
        });

        // 7. Draw and update shockwaves
        for (let i = shockwaves.length - 1; i >= 0; i--) {
          shockwaves[i].update();
          shockwaves[i].draw();
          if (shockwaves[i].alpha <= 0) {
            shockwaves.splice(i, 1);
          }
        }
      } catch (err) {
        console.error('[AntigravityCanvas Render Error]', err);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (interactive) {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseleave', handleMouseLeave);
        window.removeEventListener('click', handleClick);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [theme, isDark, interactive]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
