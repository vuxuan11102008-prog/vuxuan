const canvas = document.getElementById("matrixCanvas");
const ctx = canvas.getContext("2d");
const sound = document.getElementById("sound");
sound.currentTime = 10;

function playSound() {
  sound.play().catch((e) => {
    console.log("Phát nhạc thất bại:", e);
  });
}

let W, H;
function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);
const characters = "HAPPYBIRTHDAYCHUCMUNGSINHNHATTUOIMOIZUIZE";
const fontSize = 20;
const columns = Math.floor(W / fontSize);
const drops = Array(columns).fill(1);

const texts = [
  "3",
  "2",
  "1", 
  "🎂",
  "17.10.2026",
  "HAPPY BIRTHDAY",
  "LINH GIANG",
];

const BASE_DISPLAY_TIME = 3000;
const EXPLOSION_TIME = 600;  
const CHAR_APPEAR_INTERVAL = 100;

let currentDisplayTime = BASE_DISPLAY_TIME;

const offCanvas = document.createElement('canvas');
const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

let targetPoints = [];
let dots = [];

let currentTextIndex = 0;
let currentCharIndex = 0;
let lastChangeTime = Date.now();
let lastCharTime = Date.now();

let state = "forming";
let explosionStartTime = 0;
let animationPaused = false;

let hue = 0;

let mouseX = -9999;
let mouseY = -9999;

let phase = "text";

const ALL_IMG_FILES = [
  ...Array.from({ length: 5 }, (_, i) => `Anh (${i + 1}).jpg`)
];
let currentImgIndex = 0;
let currentSlideImg = null;
let currentSlideImgLoaded = false;
const IMAGE_DISPLAY_TIME = 5000; 

function loadNextSlideImage(callback) {
  const img = new Image();
  img.onload = () => {
    currentSlideImg = img;
    currentSlideImgLoaded = true;
    if (callback) callback();
  };
  img.onerror = () => {
    currentSlideImg = null;
    currentSlideImgLoaded = false;
    if (callback) callback();
  };
  img.src = `./style/img/${ALL_IMG_FILES[currentImgIndex]}`;
}

function getTextPixels(text) {
  offCanvas.width = W;
  offCanvas.height = H;
  offCtx.clearRect(0, 0, W, H);

  let fontSizeOverlay = 500;
  offCtx.font = `bold ${fontSizeOverlay}px Arial`;
  while (offCtx.measureText(text).width > W * 0.9) {
    fontSizeOverlay -= 2;
    offCtx.font = `bold ${fontSizeOverlay}px Arial`;
  }
  offCtx.fillStyle = 'white';
  offCtx.textAlign = 'center';
  offCtx.textBaseline = 'middle';
  offCtx.fillText(text, W / 2, H / 2);

  const imageData = offCtx.getImageData(0, 0, W, H);
  const pixels = [];
  const gap = 6;
  for (let y = 0; y < H; y += gap) {
    for (let x = 0; x < W; x += gap) {
      const idx = (y * W + x) * 4;
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];
      const a = imageData.data[idx + 3];
      if (r + g + b > 200 && a > 128) {
        pixels.push({ x, y });
      }
    }
  }
  return pixels;
}

function getImagePixels(img) {
  offCanvas.width = W;
  offCanvas.height = H;
  offCtx.clearRect(0, 0, W, H);

  const maxW = W * 0.8;
  const maxH = H * 0.8;
  const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  const drawX = (W - drawW) / 2;
  const drawY = (H - drawH) / 2;

  offCtx.drawImage(img, drawX, drawY, drawW, drawH);

  const imageData = offCtx.getImageData(0, 0, W, H);
  const pixels = [];
  const gap = 6;
  for (let y = 0; y < H; y += gap) {
    for (let x = 0; x < W; x += gap) {
      const idx = (y * W + x) * 4;
      const a = imageData.data[idx + 3];
      if (a > 128) {
        pixels.push({
          x,
          y,
          r: imageData.data[idx],
          g: imageData.data[idx + 1],
          b: imageData.data[idx + 2]
        });
      }
    }
  }
  return pixels;
}

class Dot {
  constructor(targetX, targetY) {
    this.x = Math.random() * W;
    this.y = Math.random() * H;
    this.targetX = targetX;
    this.targetY = targetY;
    this.vx = 0;
    this.vy = 0;
    this.size = 3;
    this.color = null;
  }

  update() {
    if (state === "forming") {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const easing = 0.1;
      this.vx = (this.vx + dx * easing) * 0.75;
      this.vy = (this.vy + dy * easing) * 0.75;
      this.x += this.vx;
      this.y += this.vy;
    } else if (state === "exploding") {
      this.x += this.vx;
      this.y += this.vy;
      this.vx *= 1.09;  
      this.vy *= 1.09;
    }
  }

  draw(ctx) {
    ctx.fillStyle = this.color || `hsl(${(hue + this.x / W * 100) % 360}, 100%, 65%)`;
    ctx.fillRect(this.x, this.y, this.size, this.size);
  }
}

function initDots(text) {
  let partialText = text.substring(0, currentCharIndex);
  if (partialText.length === 0) partialText = " ";
  targetPoints = getTextPixels(partialText);
  if (dots.length === 0) {
    dots = targetPoints.map(p => new Dot(p.x, p.y));
  } else {
    for (let i = 0; i < dots.length; i++) {
      if (i < targetPoints.length) {
        dots[i].targetX = targetPoints[i].x;
        dots[i].targetY = targetPoints[i].y;
      } else {
        dots[i].targetX = Math.random() * W;
        dots[i].targetY = H + 100 + Math.random() * 200;
      }
    }
    if (targetPoints.length > dots.length) {
      const diff = targetPoints.length - dots.length;
      const startIndex = dots.length;
      for (let j = 0; j < diff; j++) {
        const p = targetPoints[startIndex + j];
        dots.push(new Dot(p.x, p.y));
      }
    }
  }
  state = "forming";
}

function explodeDots() {
  const cx = W / 2;
  const cy = H / 2;
  for (const dot of dots) {
    const dx = dot.x - cx;
    const dy = dot.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = 8 + Math.random() * 14;       // 8–22 px/frame
    dot.vx = (dx / len) * speed + (Math.random() - 0.5) * 8;
    dot.vy = (dy / len) * speed + (Math.random() - 0.5) * 8;
  }
}

function initImageDots(img) {
  targetPoints = getImagePixels(img);
  for (let i = 0; i < dots.length; i++) {
    if (i < targetPoints.length) {
      dots[i].targetX = targetPoints[i].x;
      dots[i].targetY = targetPoints[i].y;
      dots[i].color = `rgb(${targetPoints[i].r},${targetPoints[i].g},${targetPoints[i].b})`;
    } else {
      dots[i].targetX = Math.random() * W;
      dots[i].targetY = H + 200 + Math.random() * 300;
      dots[i].color = null;
    }
  }
  if (targetPoints.length > dots.length) {
    const startIndex = dots.length;
    const diff = targetPoints.length - dots.length;
    for (let j = 0; j < diff; j++) {
      const p = targetPoints[startIndex + j];
      const dot = new Dot(p.x, p.y);
      dot.color = `rgb(${p.r},${p.g},${p.b})`;
      dots.push(dot);
    }
  }
  state = "forming";
  if (currentImgIndex === 0) {
    showReadLetterButton();
    startPhotoRain();
  }
  startPhotoBlurCheck();
}

const PHOTO_FILES = Array.from({ length: 5 }, (_, i) => `Anh (${i + 1}).jpg`);
let photoRainActive = false;
let photoRainPaused = false;

function getTargetPhotoCount() {
  return window.innerWidth >= 768 ? 5 : 3;
}

function pausePhotoRain() {
  photoRainPaused = true;
  document.querySelectorAll('.falling-photo').forEach(p => {
    p.style.animationPlayState = 'paused';
  });
}

function resumePhotoRain() {
  photoRainPaused = false;
  document.querySelectorAll('.falling-photo').forEach(p => {
    p.style.animationPlayState = 'running';
  });
}

function spawnPhoto(delayMs = 0) {
  if (!photoRainActive) return;

  const doSpawn = () => {
    if (!photoRainActive || photoRainPaused) return;

    const container = document.getElementById('photoRain');
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const filename = PHOTO_FILES[Math.floor(Math.random() * PHOTO_FILES.length)];
    const size = 110 + Math.floor(Math.random() * 81);
    const left = size * 0.3 + Math.random() * (vw - size * 1.3);
    const rot = (Math.random() * 36 - 18).toFixed(1);
    const spin = (Math.random() * 12 - 6).toFixed(1);
    const duration = 4 + Math.random() * 2.5;

    const img = document.createElement('img');
    img.className = 'falling-photo';
    img.src = `./style/img/${filename}`;
    img.alt = '';
    img.width = size;
    img.height = size;
    img.style.left = `${left}px`;
    img.style.setProperty('--rot', `${rot}deg`);
    img.style.setProperty('--spin', `${spin}deg`);
    img.style.setProperty('--fall-dist', `${vh + size + 120}px`);
    img.style.animationDuration = `${duration}s`;

    img.addEventListener('animationend', () => {
      img.remove();
      spawnPhoto(); 
    }, { once: true });

    container.appendChild(img);
  };

  if (delayMs > 0) {
    setTimeout(doSpawn, delayMs);
  } else {
    doSpawn();
  }
}

function startPhotoRain() {
  const container = document.getElementById('photoRain');
  container.innerHTML = '';
  photoRainActive = true;

  const count = getTargetPhotoCount();
  const avgDur = 5250; 

  for (let i = 0; i < count; i++) {
    const delay = (i / count) * avgDur;
    spawnPhoto(delay);
  }
}

let photoBlurInterval = null;

function getSpecialImgScreenRect() {
  if (!currentSlideImgLoaded || !currentSlideImg) return null;
  const maxW = W * 0.8;
  const maxH = H * 0.8;
  const scale = Math.min(maxW / currentSlideImg.naturalWidth, maxH / currentSlideImg.naturalHeight);
  const w = currentSlideImg.naturalWidth * scale;
  const h = currentSlideImg.naturalHeight * scale;
  return {
    left: (W - w) / 2,
    top: (H - h) / 2,
    right: (W + w) / 2,
    bottom: (H + h) / 2
  };
}

function checkPhotoOverlap() {
  const sr = getSpecialImgScreenRect();
  if (!sr) return;
  document.querySelectorAll('.falling-photo').forEach(photo => {
    const pr = photo.getBoundingClientRect();
    const overlaps = pr.right > sr.left &&
      pr.left < sr.right &&
      pr.bottom > sr.top &&
      pr.top < sr.bottom;
    photo.classList.toggle('photo-dim', overlaps);
  });
}

function startPhotoBlurCheck() {
  if (photoBlurInterval) clearInterval(photoBlurInterval);
  photoBlurInterval = setInterval(checkPhotoOverlap, 80);
}

function drawMatrixRain() {
  hue = (hue + 1) % 360;

  ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
  ctx.fillRect(0, 0, W, H);

  ctx.font = fontSize + "px monospace";

  for (let i = 0; i < drops.length; i++) {
    const textChar = characters[Math.floor(Math.random() * characters.length)];
    ctx.fillStyle = `hsl(${(hue + i * 10) % 360}, 100%, 65%)`;
    ctx.fillText(textChar, i * fontSize, drops[i] * fontSize);

    if (drops[i] * fontSize > H || Math.random() > 0.975) {
      drops[i] = 0;
    }
    drops[i]++;
  }

  for (const dot of dots) {
    dot.update();
    dot.draw(ctx);
  }

  const now = Date.now();
  if (animationPaused) return;

  if (state === "forming") {
    if (phase === "text") {
      if (currentCharIndex < texts[currentTextIndex].length) {
        if (now - lastCharTime > CHAR_APPEAR_INTERVAL) {
          currentCharIndex++;
          initDots(texts[currentTextIndex]);
          lastCharTime = now;
        }
      } else if (now - lastChangeTime > currentDisplayTime) {
        state = "exploding";
        explosionStartTime = now;
        if (currentTextIndex >= texts.length - 1) {
          phase = "image";
          currentImgIndex = 0;
          currentSlideImgLoaded = false;
          loadNextSlideImage();
        }
        explodeDots();
      }
    } else if (phase === "image") {
      if (now - lastChangeTime > IMAGE_DISPLAY_TIME) {
        state = "exploding";
        explosionStartTime = now;
        currentImgIndex = (currentImgIndex + 1) % ALL_IMG_FILES.length;
        currentSlideImgLoaded = false;
        loadNextSlideImage();
        explodeDots();
      }
    }
  } else if (state === "exploding") {
    if (now - explosionStartTime > EXPLOSION_TIME) {
      if (phase === "image" && currentSlideImgLoaded) {
        initImageDots(currentSlideImg);
        lastChangeTime = now;
      } else if (phase === "image" && !currentSlideImgLoaded) {
        explosionStartTime = now;
      } else {
        currentTextIndex++;
        currentCharIndex = 0;
        const nextText = texts[currentTextIndex];
        currentDisplayTime = BASE_DISPLAY_TIME + (nextText.length > 5 ? 3000 : 0);
        initDots(nextText);
        lastChangeTime = now;
        lastCharTime = now;
        state = "forming";
      }
    }
  }
}

function startEffect() {
  const overlay = document.getElementById("giftOverlay");
  overlay.classList.add("hidden");

  playSound();

  currentDisplayTime = BASE_DISPLAY_TIME + (texts[0].length > 4 ? 2000 : 0);
  initDots(texts[currentTextIndex]);
  lastChangeTime = Date.now();
  lastCharTime = Date.now();

  setInterval(drawMatrixRain, 50);
}

document.getElementById("giftOverlay").addEventListener("click", startEffect);

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});
canvas.addEventListener("mouseleave", () => {
  mouseX = -9999;
  mouseY = -9999;
});

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  mouseX = touch.clientX - rect.left;
  mouseY = touch.clientY - rect.top;
}, { passive: false });
canvas.addEventListener("touchend", () => {
  mouseX = -9999;
  mouseY = -9999;
});

let letterText = '';
let twTimer = null;
let letterTypingDone = false; 
fetch('./style/letter.txt')
  .then(r => r.text())
  .then(text => { letterText = text.trim(); })
  .catch(() => { letterText = 'Không thể tải nội dung thư.'; });

function showReadLetterButton() {
  setTimeout(() => {
    const btn = document.getElementById('readLetterBtn');
    if (btn) btn.classList.add('visible');
  }, 3500);
}

function openLetter() {
  const overlay = document.getElementById('letterOverlay');
  overlay.classList.add('visible');

  pausePhotoRain();
  animationPaused = true;

  const paper = overlay.querySelector('.letter-paper');
  paper.style.animation = 'none';
  paper.offsetHeight;
  paper.style.animation = '';

  if (letterTypingDone) {
    renderLetterFull();
  } else {
    startTypewriter();
  }
}

function closeLetter() {
  document.getElementById('letterOverlay').classList.remove('visible');
  if (twTimer) { clearTimeout(twTimer); twTimer = null; }
  resumePhotoRain();
  animationPaused = false;
  lastChangeTime = Date.now(); 
}

function renderLetterFull() {
  const container = document.getElementById('letterContent');
  container.innerHTML = '';
  const paragraphs = letterText.split(/\n\n+/).filter(p => p.trim().length > 0);
  paragraphs.forEach((para, i) => {
    const p = document.createElement('p');
    para.split('\n').forEach((line, j) => {
      if (j > 0) p.appendChild(document.createElement('br'));
      p.appendChild(document.createTextNode(line));
    });
    container.appendChild(p);
  });
}

function startTypewriter() {
  const container = document.getElementById('letterContent');
  container.innerHTML = '';
  if (twTimer) { clearTimeout(twTimer); twTimer = null; }

  const paragraphs = letterText.split(/\n\n+/).filter(p => p.trim().length > 0);

  let paraIndex = 0;
  let charIndex = 0;
  let currentP = null;

  const cursor = document.createElement('span');
  cursor.className = 'letter-cursor';

  function nextParagraph() {
    if (paraIndex >= paragraphs.length) {
      if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
      letterTypingDone = true;
      return;
    }
    currentP = document.createElement('p');
    container.appendChild(currentP);
    currentP.appendChild(cursor); // con trỏ luôn ở cuối đoạn đang gõ
    charIndex = 0;
    typeChar();
  }

  function typeChar() {
    const para = paragraphs[paraIndex];
    if (charIndex < para.length) {
      const ch = para[charIndex];
      if (ch === '\n') {
        currentP.insertBefore(document.createElement('br'), cursor);
      } else {
        currentP.insertBefore(document.createTextNode(ch), cursor);
      }
      charIndex++;
      const scroll = container.closest('.letter-scroll');
      if (scroll) scroll.scrollTop = container.scrollHeight;
      twTimer = setTimeout(typeChar, 32);
    } else {      paraIndex++;
      twTimer = setTimeout(nextParagraph, 180);
    }
  }

  nextParagraph();
}

document.getElementById('readLetterBtn').addEventListener('click', openLetter);
document.getElementById('letterClose').addEventListener('click', closeLetter);
document.getElementById('letterOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('letterOverlay')) closeLetter();
});
