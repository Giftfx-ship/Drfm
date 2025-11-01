// script.js

/* ---------------------------
   Utility / DOM shortcuts
----------------------------*/
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

/* ---------------------------
   Live Clock & Date & Year
----------------------------*/
function updateClock(){
  const now = new Date();
  const clockEl = $('#clock');
  const dateEl = $('#date');
  const small = $('#clock-small');
  const yearFooter = $('#year-footer');
  const giveYear = $('#give-year');

  if(clockEl) clockEl.textContent = now.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit', second:'2-digit'});
  if(dateEl) dateEl.textContent = now.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  if(small) small.textContent = now.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
  if(yearFooter) yearFooter.textContent = now.getFullYear();
  if(giveYear) giveYear.textContent = now.getFullYear();
}
setInterval(updateClock, 1000);
updateClock();

/* ---------------------------
   Reveal on scroll
----------------------------*/
const revealEls = document.querySelectorAll('.reveal');
const obs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if(e.isIntersecting){
      e.target.classList.add('visible');
    }
  });
}, {threshold: 0.12});

revealEls.forEach(el => obs.observe(el));

/* ---------------------------
   Burger menu (mobile)
----------------------------*/
const burger = $('#burger');
const navLinks = $('.nav-links');
if(burger){
  burger.addEventListener('click', ()=> {
    if(navLinks.style.display === 'flex'){
      navLinks.style.display = 'none';
    } else {
      navLinks.style.display = 'flex';
      navLinks.style.flexDirection = 'column';
      navLinks.style.position = 'absolute';
      navLinks.style.right = '20px';
      navLinks.style.top = '70px';
      navLinks.style.background = 'linear-gradient(180deg, rgba(2,20,40,0.9), rgba(2,20,40,0.75))';
      navLinks.style.padding = '14px';
      navLinks.style.borderRadius = '10px';
    }
  });
}

/* ---------------------------
   Background particle lights (canvas)
----------------------------*/
const canvas = document.getElementById('bg-canvas');
const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
let particles = [];
const particleCount = 40;

function resizeCanvas(){
  if(!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function initParticles(){
  particles = [];
  for(let i=0;i<particleCount;i++){
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 2 + Math.random()*4,
      vx: (Math.random()-0.5) * 0.4,
      vy: (Math.random()-0.5) * 0.4,
      hue: 190 + Math.random()*60,
      life: Math.random()*1.2 + 0.4
    });
  }
}
if(ctx){ initParticles(); }

function renderParticles(){
  if(!ctx) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.002;
    if(p.x < -20) p.x = canvas.width + 20;
    if(p.x > canvas.width + 20) p.x = -20;
    if(p.y < -20) p.y = canvas.height + 20;
    if(p.y > canvas.height + 20) p.y = -20;
    if(p.life <= 0){
      p.x = Math.random() * canvas.width;
      p.y = Math.random() * canvas.height;
      p.life = Math.random()*1.2 + 0.4;
    }
    // glow
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r*8);
    gradient.addColorStop(0, `hsla(${p.hue}, 95%, 60%, 0.9)`);
    gradient.addColorStop(0.4, `hsla(${p.hue}, 95%, 55%, 0.35)`);
    gradient.addColorStop(1, `hsla(${p.hue}, 95%, 55%, 0)`);
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(p.x, p.y, p.r*6, 0, Math.PI*2);
    ctx.fill();
  });
  requestAnimationFrame(renderParticles);
}
renderParticles();

/* ---------------------------
   Background music toggle (optional)
   - Note: audio src is empty; set an mp3 URL if you want music.
----------------------------*/
const musicToggle = $('#music-toggle');
const bgMusic = $('#bg-music');
if(musicToggle && bgMusic){
  let playing = false;
  musicToggle.addEventListener('click', ()=>{
    if(!bgMusic.src){
      // placeholder: show message
      alert('No background music file is set. Place an mp3 and set the audio src in the HTML (id="bg-music").');
      return;
    }
    if(!playing){
      bgMusic.play().catch(e=> console.warn('Auto-play prevented', e));
      musicToggle.textContent = 'Pause Music';
      musicToggle.classList.remove('ghost');
      playing = true;
    } else {
      bgMusic.pause();
      musicToggle.textContent = 'Play Music';
      musicToggle.classList.add('ghost');
      playing = false;
    }
    musicToggle.setAttribute('aria-pressed', String(playing));
  });
}

/* ---------------------------
   Prefill / Accessibility helpers
----------------------------*/
document.addEventListener('DOMContentLoaded', ()=>{
  // reveal first sections quickly
  setTimeout(()=> {
    document.querySelectorAll('.reveal').forEach((el, i) => {
      setTimeout(()=> el.classList.add('visible'), 200 + i*120);
    });
  }, 300);
});
