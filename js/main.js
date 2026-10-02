    /* =====================================================================
       1. 60 FPS PURPLE MOVING DESIGN WITH GLOW (Inside 3D Laptop Screen)
       Draws fluid animated sine-based glowing plasma ribbons and cosmic particles
       simulating the glowing purple flow seen in the reference image.
       ===================================================================== */
    const canvas = document.getElementById('laptopCanvas');
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let width, height;
    let time = 0;

    // Glowing particle system inside laptop
    const particles = [];
    const PARTICLE_COUNT = 38;

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = canvas.width = rect.width * dpr;
      height = canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }

    class Particle {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * (width / (window.devicePixelRatio || 1));
        this.y = Math.random() * (height / (window.devicePixelRatio || 1));
        this.size = Math.random() * 2.2 + 0.8;
        this.speedX = (Math.random() - 0.5) * 0.7;
        this.speedY = -Math.random() * 0.9 - 0.2;
        this.alpha = Math.random() * 0.7 + 0.3;
        this.hue = Math.random() > 0.4 ? 275 : 215; // Purple & Cyan mix
      }
      update(w, h) {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.y < 0 || this.x < 0 || this.x > w) {
          this.reset();
          this.y = h + 10;
        }
      }
      draw(c) {
        c.save();
        c.shadowBlur = 10;
        c.shadowColor = `hsla(${this.hue}, 90%, 65%, ${this.alpha})`;
        c.fillStyle = `hsla(${this.hue}, 90%, 75%, ${this.alpha})`;
        c.beginPath();
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(new Particle());
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // 60FPS fluid rendering loop
    function renderGlowingPurpleWave() {
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);

      // Soft clear with trail
      ctx.fillStyle = 'rgba(7, 10, 20, 0.28)';
      ctx.fillRect(0, 0, w, h);

      time += 0.022;

      // Draw background radiant purple ambient glow
      const gradPulse = ctx.createRadialGradient(
        w * 0.75 + Math.sin(time * 0.8) * 40,
        h * 0.45 + Math.cos(time * 0.9) * 30,
        10,
        w * 0.7,
        h * 0.5,
        w * 0.65
      );
      gradPulse.addColorStop(0, 'rgba(157, 93, 253, 0.45)');
      gradPulse.addColorStop(0.35, 'rgba(124, 58, 237, 0.22)');
      gradPulse.addColorStop(0.7, 'rgba(59, 130, 246, 0.08)');
      gradPulse.addColorStop(1, 'transparent');

      ctx.fillStyle = gradPulse;
      ctx.fillRect(0, 0, w, h);

      // Render 5 layered flowing glowing ribbons with 60fps trigonometric calculus
      const ribbons = [
        { amp: 48, freq: 0.007, speed: 1.4, color: 'rgba(192, 132, 252, 0.75)', blur: 24, offsetY: 0.42 },
        { amp: 62, freq: 0.005, speed: 1.1, color: 'rgba(147, 51, 234, 0.65)', blur: 32, offsetY: 0.52 },
        { amp: 36, freq: 0.009, speed: 1.8, color: 'rgba(168, 85, 247, 0.85)', blur: 18, offsetY: 0.35 },
        { amp: 75, freq: 0.004, speed: 0.8, color: 'rgba(79, 70, 229, 0.5)', blur: 40, offsetY: 0.62 },
        { amp: 25, freq: 0.012, speed: 2.2, color: 'rgba(216, 180, 254, 0.95)', blur: 12, offsetY: 0.38 }
      ];

      ribbons.forEach((rib, index) => {
        ctx.save();
        ctx.shadowBlur = rib.blur;
        ctx.shadowColor = rib.color;
        ctx.strokeStyle = rib.color;
        ctx.lineWidth = 3.5 - index * 0.4;
        ctx.beginPath();

        const baseY = h * rib.offsetY;

        for (let x = 0; x <= w; x += 6) {
          const wave1 = Math.sin(x * rib.freq + time * rib.speed) * rib.amp;
          const wave2 = Math.cos(x * rib.freq * 1.5 - time * rib.speed * 0.7) * (rib.amp * 0.45);
          const swirl = Math.sin(time + x * 0.003) * 18;
          const y = baseY + wave1 + wave2 + swirl;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        ctx.restore();
      });

      // Update & Draw Glowing Particles
      particles.forEach(p => {
        p.update(w, h);
        p.draw(ctx);
      });

      animationFrameId = requestAnimationFrame(renderGlowingPurpleWave);
    }

    renderGlowingPurpleWave();

    /* =====================================================================
       1b. SAME MOVING-LINES EFFECT, FULL-PAGE BACKGROUND VERSION
       Reuses the ribbon/particle system above but renders full-viewport,
       fixed behind all content, at a lower opacity so it stays ambient.
       ===================================================================== */
    (function () {
      const bgCanvas = document.getElementById('bgLinesCanvas');
      if (!bgCanvas) return;
      const bctx = bgCanvas.getContext('2d');
      let bw, bh, btime = 0;

      const bgParticles = [];
      const BG_PARTICLE_COUNT = 60;

      function resizeBgCanvas() {
        const dpr = window.devicePixelRatio || 1;
        bw = bgCanvas.width = window.innerWidth * dpr;
        bh = bgCanvas.height = window.innerHeight * dpr;
        bgCanvas.style.width = window.innerWidth + 'px';
        bgCanvas.style.height = window.innerHeight + 'px';
        bctx.setTransform(1, 0, 0, 1, 0, 0);
        bctx.scale(dpr, dpr);
      }

      class BgParticle {
        constructor() { this.reset(); }
        reset() {
          this.x = Math.random() * window.innerWidth;
          this.y = Math.random() * window.innerHeight;
          this.size = Math.random() * 2 + 0.6;
          this.speedX = (Math.random() - 0.5) * 0.5;
          this.speedY = -Math.random() * 0.6 - 0.15;
          this.alpha = Math.random() * 0.5 + 0.2;
          this.hue = Math.random() > 0.4 ? 275 : 215;
        }
        update(w, h) {
          this.x += this.speedX;
          this.y += this.speedY;
          if (this.y < 0 || this.x < 0 || this.x > w) {
            this.reset();
            this.y = h + 10;
          }
        }
        draw(c) {
          c.save();
          c.shadowBlur = 8;
          c.shadowColor = `hsla(${this.hue}, 90%, 65%, ${this.alpha})`;
          c.fillStyle = `hsla(${this.hue}, 90%, 75%, ${this.alpha})`;
          c.beginPath();
          c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          c.fill();
          c.restore();
        }
      }

      for (let i = 0; i < BG_PARTICLE_COUNT; i++) bgParticles.push(new BgParticle());

      window.addEventListener('resize', resizeBgCanvas);
      resizeBgCanvas();

      const bgRibbons = [
        { amp: 70, freq: 0.0035, speed: 1.1, color: 'rgba(192, 132, 252, 0.35)', blur: 20, offsetY: 0.30 },
        { amp: 90, freq: 0.0025, speed: 0.85, color: 'rgba(147, 51, 234, 0.30)', blur: 26, offsetY: 0.55 },
        { amp: 55, freq: 0.0045, speed: 1.4, color: 'rgba(168, 85, 247, 0.4)', blur: 14, offsetY: 0.72 },
        { amp: 110, freq: 0.002, speed: 0.6, color: 'rgba(79, 70, 229, 0.22)', blur: 32, offsetY: 0.15 },
        { amp: 40, freq: 0.006, speed: 1.8, color: 'rgba(216, 180, 254, 0.45)', blur: 10, offsetY: 0.85 }
      ];

      function renderBgLines() {
        const w = window.innerWidth;
        const h = window.innerHeight;

        bctx.clearRect(0, 0, w, h);

        btime += 0.016;

        bgRibbons.forEach((rib, index) => {
          bctx.save();
          bctx.shadowBlur = rib.blur;
          bctx.shadowColor = rib.color;
          bctx.strokeStyle = rib.color;
          bctx.lineWidth = 2.4 - index * 0.25;
          bctx.beginPath();

          const baseY = h * rib.offsetY;

          for (let x = 0; x <= w; x += 8) {
            const wave1 = Math.sin(x * rib.freq + btime * rib.speed) * rib.amp;
            const wave2 = Math.cos(x * rib.freq * 1.5 - btime * rib.speed * 0.7) * (rib.amp * 0.4);
            const swirl = Math.sin(btime + x * 0.0025) * 22;
            const y = baseY + wave1 + wave2 + swirl;

            if (x === 0) bctx.moveTo(x, y);
            else bctx.lineTo(x, y);
          }
          bctx.stroke();
          bctx.restore();
        });

        bgParticles.forEach(p => {
          p.update(w, h);
          p.draw(bctx);
        });

        requestAnimationFrame(renderBgLines);
      }

      renderBgLines();
    })();

    /* =====================================================================
       2. 60 FPS INTERACTIVE 3D GYRO / MOUSE PARALLAX FOR LAPTOP RIG
       ===================================================================== */
    const laptopRig = document.getElementById('laptopRig');
    let targetRotX = 10;
    let targetRotY = -13;
    let currentRotX = 10;
    let currentRotY = -13;

    window.addEventListener('mousemove', (e) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx;
      const dy = (e.clientY - cy) / cy;

      targetRotY = -13 + dx * 16;
      targetRotX = 10 - dy * 12;
    });

    function smoothLaptopTransform() {
      // Linear interpolation (lerp) for 60fps buttery movement
      currentRotX += (targetRotX - currentRotX) * 0.08;
      currentRotY += (targetRotY - currentRotY) * 0.08;

      if (laptopRig) {
        laptopRig.style.transform = `rotateY(${currentRotY.toFixed(2)}deg) rotateX(${currentRotX.toFixed(2)}deg) rotateZ(1.5deg)`;
      }
      requestAnimationFrame(smoothLaptopTransform);
    }
    smoothLaptopTransform();

    /* =====================================================================
       3. INTERACTIVE HELPER FUNCTIONS
       ===================================================================== */
    function highlightServiceCard(id) {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.borderColor = '#c084fc';
        el.style.boxShadow = '0 0 35px rgba(168, 85, 247, 0.7)';
        setTimeout(() => {
          el.style.borderColor = '';
          el.style.boxShadow = '';
        }, 1600);
      }
    }

    function showToast(msg) {
      const toast = document.getElementById('actionToast');
      const toastMsg = document.getElementById('toastMessage');
      toastMsg.innerText = msg;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 4000);
    }

    function handleFormSubmit(e) {
      e.preventDefault();
      const name = document.getElementById('name').value;
      showToast(`Thank you ${name}! Usama Abu Bakr received your request.`);
      e.target.reset();
    }

    // Nav active link tracking
    const sections = document.querySelectorAll('section[id]');
    const navAnchors = document.querySelectorAll('.nav-links a');

    window.addEventListener('scroll', () => {
      let current = '';
      sections.forEach(sec => {
        const top = sec.offsetTop - 120;
        if (window.scrollY >= top) {
          current = sec.getAttribute('id');
        }
      });
      navAnchors.forEach(a => {
        a.classList.remove('active');
        if (a.getAttribute('href') === `#${current}`) {
          a.classList.add('active');
        }
      });
    });

    function filterPortfolio(category) {
      const cards = document.querySelectorAll('.portfolio-item-card');
      const buttons = document.querySelectorAll('.portfolio-filter-btn');

      buttons.forEach(btn => btn.classList.remove('active'));
      const activeBtn = document.getElementById(`filter-${category}`);
      if (activeBtn) activeBtn.classList.add('active');

      cards.forEach(card => {
        const cardCat = card.getAttribute('data-category');
        if (category === 'all' || cardCat === category) {
          card.style.display = 'flex';
          card.style.opacity = '1';
        } else {
          card.style.display = 'none';
        }
      });
    }

    function openLightbox(imageSrc, title, clientName) {
      const modal = document.getElementById('imageLightbox');
      const img = document.getElementById('lightboxImg');
      const titleEl = document.getElementById('lightboxTitle');
      const clientEl = document.getElementById('lightboxClient');
      const newTabBtn = document.getElementById('lightboxNewTabBtn');

      if (modal && img) {
        img.src = imageSrc;
        if (titleEl) titleEl.innerText = title;
        if (clientEl) clientEl.innerText = clientName || 'Client Showcase';
        if (newTabBtn) newTabBtn.href = imageSrc;

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    }

    function closeLightbox(e) {
      const modal = document.getElementById('imageLightbox');
      if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeLightbox();
      }
    });

// LIGHTBOX FULL VIEWER
let currentActiveLightboxSrc = '';

function openLightbox(imageSrc, title, clientName) {
  const modal = document.getElementById('imageLightbox');
  const img = document.getElementById('lightboxImg');
  const titleEl = document.getElementById('lightboxTitle');
  const clientEl = document.getElementById('lightboxClient');

  if (modal && img) {
    currentActiveLightboxSrc = imageSrc;
    img.src = imageSrc;
    if (titleEl) titleEl.innerText = title;
    if (clientEl) clientEl.innerText = clientName || 'Client Showcase';

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Scroll to top of image inside modal
    const body = modal.querySelector('.lightbox-body');
    if (body) body.scrollTop = 0;
  }
}

function openFullInNewTab() {
  if (currentActiveLightboxSrc) {
    window.open(currentActiveLightboxSrc, '_blank');
  }
}

function closeLightbox(e) {
  const modal = document.getElementById('imageLightbox');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLightbox();
  }
});
