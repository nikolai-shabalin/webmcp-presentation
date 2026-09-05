/* Animated interpretation of assets/brand-line.svg. No dependencies or network requests. */
(() => {
  'use strict';
  const canvas = document.querySelector('#brand-line');
  const ctx = canvas?.getContext('2d', { alpha: false });
  const slides = [...document.querySelectorAll('.slides > .slide')];
  if (!ctx || !slides.length) return;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const TAU = Math.PI * 2;
  const COUNT = 240;
  const random = (min, max) => min + Math.random() * (max - min);
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * t * (t * (t * 6 - 15) + 10);
  const source = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  source.setAttribute('d', 'M2124.69 247.519C1914.69 45.2036 950.452 -65.3526 654.277 63.612C418.93 166.09 563.525 380.716 841.508 490.635C1543.12 768.063 2154.03 493.548 1283.2 247.519C412.368 1.48999 125.58 325.512 5.2023 423.957');
  const length = source.getTotalLength();
  const brand = Array.from({ length: COUNT }, (_, i) => {
    const p = source.getPointAtLength(length * i / (COUNT - 1));
    return { x: (p.x - 1065.5) / 2131, y: (p.y - 308) / 2131 };
  });
  let width = 1;
  let height = 1;
  let fields = [];
  let points = [];
  let transition = null;
  let rest = null;
  let hiddenAt = null;
  let frame = 0;
  let scrolling = false;
  let scrollTimer = 0;
  let lastScrollY = scrollY;
  let bag = [];
  let lastShape = 'brand';

  // Equal arc-length spacing keeps a long curl from collapsing into a few vertices.
  function resample(raw) {
    const distances = [0];
    for (let i = 1; i < raw.length; i++) {
      distances[i] = distances[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y);
    }
    let segment = 1;
    return Array.from({ length: COUNT }, (_, i) => {
      const distance = distances.at(-1) * i / (COUNT - 1);
      while (segment < raw.length - 1 && distances[segment] < distance) segment++;
      const t = (distance - distances[segment - 1]) / (distances[segment] - distances[segment - 1] || 1);
      return { x: mix(raw[segment - 1].x, raw[segment].x, t), y: mix(raw[segment - 1].y, raw[segment].y, t) };
    });
  }

  function curve(kind) {
    if (kind === 'brand') return brand;
    const turns = random(1.6, 3.3);
    const lobes = Math.floor(random(2, 5));
    const phase = random(-.22, .22);
    const raw = Array.from({ length: 900 }, (_, i) => {
      const t = i / 899;
      const a = TAU * t;
      if (kind === 'heart') return {
        x: 16 * Math.sin(a) ** 3 / 34,
        y: -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 34
      };
      if (kind === 'ouroboros') {
        const r = .43 + .025 * Math.sin(3 * a + phase) * Math.sin(a / 2) ** 2;
        return { x: r * Math.cos(a), y: r * Math.sin(a) };
      }
      if (kind === 'spiral') {
        const r = mix(.045, .48, t);
        return { x: r * Math.cos(a * turns), y: r * Math.sin(a * turns) };
      }
      if (kind === 'infinity') return { x: .5 * Math.cos(a), y: .26 * Math.sin(2 * a) };
      return { x: mix(-.55, .55, t) + .2 * Math.sin(a * lobes), y: .24 * Math.cos(a * lobes) + .07 * Math.sin(a) };
    });
    return resample(raw);
  }

  function chooseShape() {
    if (!bag.length) bag = ['brand', 'heart', 'ouroboros', 'spiral', 'curls', 'infinity'];
    const options = bag.filter(kind => kind !== lastShape);
    const kind = options[Math.floor(Math.random() * options.length)] || bag[0];
    bag.splice(bag.indexOf(kind), 1);
    lastShape = kind;
    return kind;
  }

  function pose(kind, initial = false) {
    const size = kind === 'brand' ? width * (initial ? 1.2 : random(.85, 1.3)) : Math.min(width, height) * random(.72, 1.14);
    const angle = initial ? -.15 : random(-Math.PI, Math.PI) * (kind === 'heart' ? .12 : 1);
    const cx = initial ? .62 : random(.25, .85);
    const cy = initial ? .65 : random(.28, .78);
    return curve(kind).map(p => ({
      x: cx + (p.x * Math.cos(angle) - p.y * Math.sin(angle)) * size / width,
      y: cy + (p.x * Math.sin(angle) + p.y * Math.cos(angle)) * size / height
    }));
  }

  function normalize(list) {
    const x = Math.floor(list.reduce((sum, p) => sum + p.x, 0) / COUNT);
    const y = Math.floor(list.reduce((sum, p) => sum + p.y, 0) / COUNT);
    return list.map(p => ({ x: p.x - x, y: p.y - y }));
  }

  function settle(now) {
    rest = { points, start: now };
  }

  function sample(now) {
    if (!transition) {
      if (!rest || motion.matches) return;
      const elapsed = Math.max(0, now - rest.start);
      const phase = (elapsed / (lastShape === 'heart' ? 4800 : 7500)) % 1;
      const fade = ease(Math.min(1, elapsed / 1800));
      // Under 1% expansion: a soft double pulse for the heart, slow breathing elsewhere.
      const pulse = (.5 + .5 * Math.cos(TAU * (phase - .24))) ** 24
        + .45 * (.5 + .5 * Math.cos(TAU * (phase - .46))) ** 36;
      const expansion = fade * (lastShape === 'heart'
        ? .009 * pulse
        : .008 * (.5 - .5 * Math.cos(TAU * phase)));
      const cx = rest.points.reduce((sum, p) => sum + p.x, 0) / COUNT;
      const cy = rest.points.reduce((sum, p) => sum + p.y, 0) / COUNT;
      points = rest.points.map(p => ({
        x: cx + (p.x - cx) * (1 + expansion),
        y: cy + (p.y - cy) * (1 + expansion)
      }));
      return;
    }
    const t = Math.min(1, (now - transition.start) / transition.duration);
    const progress = ease(t);
    // A travelling bend gives the strand a little elasticity while it changes shape.
    const bend = Math.sin(Math.PI * t) * transition.bend;
    points = transition.from.map((p, i) => ({
      x: mix(p.x, transition.to[i].x, progress) + Math.sin(i / COUNT * TAU + t * TAU) * bend * height / width,
      y: mix(p.y, transition.to[i].y, progress) + Math.cos(i / COUNT * TAU + t * TAU) * bend
    }));
    if (t === 1) {
      points = normalize(transition.to);
      transition = null;
      settle(now);
      canvas.dataset.moving = 'false';
    }
  }

  function move() {
    const now = performance.now();
    sample(now);
    rest = null;
    points = normalize(points);
    const kind = chooseShape();
    const to = pose(kind);
    const wrap = Math.random() < .38;
    const axis = Math.random() < .5 ? 'x' : 'y';
    const direction = Math.random() < .5 ? -1 : 1;
    if (wrap) to.forEach(p => { p[axis] += direction; });
    canvas.dataset.shape = kind;
    canvas.dataset.route = wrap ? `wrap-${axis}` : 'morph';
    if (motion.matches) {
      points = normalize(to);
      transition = null;
      canvas.dataset.moving = 'false';
    } else {
      transition = { from: points, to, start: now, duration: random(2400, 3600), bend: random(.012, .04) };
      canvas.dataset.moving = 'true';
    }
    requestDraw();
  }

  function draw() {
    ctx.globalAlpha = 1;
    ctx.fillStyle = fields[0].color;
    ctx.fillRect(0, 0, width, height);
    // Move the original theme fields with native scrolling, behind the fixed strand.
    for (const field of fields) {
      const top = field.top - scrollY;
      if (top < height && top + field.height > 0) {
        ctx.fillStyle = field.color;
        ctx.fillRect(0, Math.floor(top), width, Math.ceil(field.height) + 1);
      }
    }
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    ctx.lineWidth = Math.max(3, Math.min(13, width * 16.4333 / 2131));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = .48;
    // Tile whole paths, never modulo individual vertices: no line across a seam.
    const pad = ctx.lineWidth / Math.min(width, height);
    for (let x = Math.ceil(-maxX - pad); x <= Math.floor(1 - minX + pad); x++) {
      for (let y = Math.ceil(-maxY - pad); y <= Math.floor(1 - minY + pad); y++) {
        const gradient = ctx.createLinearGradient(
          (minX + x) * width, (maxY + y) * height,
          (maxX + x) * width, (minY + y) * height
        );
        gradient.addColorStop(.128422, '#FF0066');
        gradient.addColorStop(.478017, '#C19BE2');
        gradient.addColorStop(.940358, '#00ADEE');
        ctx.strokeStyle = gradient;
        ctx.beginPath();
        points.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo']((p.x + x) * width, (p.y + y) * height));
        ctx.stroke();
      }
    }
  }

  function tick(now) {
    frame = 0;
    sample(now);
    draw();
    if (transition || (rest && !motion.matches)) requestDraw();
  }

  function requestDraw() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function resize() {
    const previousWidth = width;
    const previousHeight = height;
    width = innerWidth;
    height = innerHeight;
    // Preserve the shape's proportions when rotating a phone or entering fullscreen.
    const scale = Math.min(width, height) / Math.min(previousWidth, previousHeight);
    function reproject(list) {
      const cx = list.reduce((sum, p) => sum + p.x, 0) / COUNT;
      const cy = list.reduce((sum, p) => sum + p.y, 0) / COUNT;
      return list.map(p => ({
        x: cx + (p.x - cx) * previousWidth * scale / width,
        y: cy + (p.y - cy) * previousHeight * scale / height
      }));
    }
    if (points.length) points = reproject(points);
    if (rest) rest.points = reproject(rest.points);
    if (transition) {
      transition.from = reproject(transition.from);
      transition.to = reproject(transition.to);
    }
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fields = slides.map(slide => {
      const rect = slide.getBoundingClientRect();
      return { top: rect.top + scrollY, height: rect.height, color: getComputedStyle(slide).getPropertyValue('--bg').trim() };
    });
    // CSS custom properties can contain var(); computed background resolves the palette.
    for (let i = 0; i < fields.length; i++) {
      const style = getComputedStyle(slides[i]);
      const variable = fields[i].color.match(/^var\((--[\w-]+)\)$/)?.[1];
      if (variable) fields[i].color = style.getPropertyValue(variable).trim();
    }
    if (!points.length) points = pose('brand', true);
    requestDraw();
  }

  function beginScroll() {
    scrolling = true;
    clearTimeout(scrollTimer);
    // Fallback for browsers without scrollend; refreshed by every actual scroll event.
    scrollTimer = setTimeout(endScroll, 180);
  }
  function endScroll() {
    scrolling = false;
    clearTimeout(scrollTimer);
  }
  document.addEventListener('slide:move', () => { move(); beginScroll(); });
  addEventListener('scroll', () => {
    if (Math.abs(scrollY - lastScrollY) < .5) return;
    lastScrollY = scrollY;
    if (!scrolling) move();
    beginScroll();
    requestDraw();
  }, { passive: true });
  addEventListener('scrollend', endScroll);
  addEventListener('resize', resize);
  motion.addEventListener('change', () => {
    if (motion.matches && transition) {
      points = normalize(transition.to);
      transition = null;
      canvas.dataset.moving = 'false';
    }
    // Freeze the visible geometry on reduced motion; resume gently when re-enabled.
    rest = null;
    if (!motion.matches) settle(performance.now());
    requestDraw();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = performance.now();
      cancelAnimationFrame(frame);
      frame = 0;
    } else {
      const pause = hiddenAt === null ? 0 : performance.now() - hiddenAt;
      if (rest) rest.start += pause;
      if (transition) transition.start += pause;
      hiddenAt = null;
      requestDraw();
    }
  });
  canvas.dataset.shape = 'brand';
  canvas.dataset.moving = 'false';
  resize();
  settle(performance.now());
  draw();
  document.body.classList.add('has-brand-line');
})();
