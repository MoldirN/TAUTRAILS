// ===== НАВБАР =====
const navbar = document.getElementById('navbar');
const burger = document.getElementById('burger');
const mobileMenu = document.getElementById('mobileMenu');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
});

burger?.addEventListener('click', () => {
  burger.classList.toggle('open');
  mobileMenu?.classList.toggle('open');
});

// Закрытие меню при клике на ссылку
document.querySelectorAll('.navbar__mobile-menu a').forEach(a => {
  a.addEventListener('click', () => {
    burger?.classList.remove('open');
    mobileMenu?.classList.remove('open');
  });
});

document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ===== АВТОРИЗАЦИЯ В NAVBAR =====
async function initNavAuth() {
  try {
<<<<<<< HEAD
    const res = await fetch('/api/auth/me', { credentials: 'include' });
=======
    const res = await fetch('/api/auth/me');
>>>>>>> b1ec530a5caf99bf04f1e98d06b5ced7160c874f
    if (res.ok) {
      const user = await res.json();
      document.getElementById('navAuthLinks').style.display = 'none';
      document.getElementById('navRegisterLink').style.display = 'none';
      document.getElementById('navUserMenu').style.display = 'flex';
      document.getElementById('navUsername').textContent = '👤 ' + user.username;

      // Мобильное меню
      const mobileLogin = document.getElementById('mobileLoginLink');
      const mobileRegister = document.getElementById('mobileRegisterLink');
      const mobileUserSec = document.getElementById('mobileUserSection');
      const mobileUser = document.getElementById('mobileUsername');
      if (mobileLogin) mobileLogin.style.display = 'none';
      if (mobileRegister) mobileRegister.style.display = 'none';
      if (mobileUserSec) mobileUserSec.style.display = 'flex';
      if (mobileUser) mobileUser.textContent = '👤 ' + user.username;

      if (user.role === 'admin') {
        document.getElementById('navAdminLink').style.display = 'block';
      }
    }
  } catch (e) {}

  document.getElementById('navLogout')?.addEventListener('click', async () => {
<<<<<<< HEAD
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    location.reload();
  });
  document.getElementById('mobileLogout')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
=======
    await fetch('/api/auth/logout', { method: 'POST' });
    location.reload();
  });
  document.getElementById('mobileLogout')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
>>>>>>> b1ec530a5caf99bf04f1e98d06b5ced7160c874f
    location.reload();
  });
}

// ===== УТИЛИТЫ =====
function difficultyLabel(d) {
  return { easy: 'Лёгкий', moderate: 'Средний', hard: 'Сложный' }[d] || d;
}
function formatTime(min) {
  if (!min) return '—';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h} ч ${m} мин` : `${h} ч`) : `${m} мин`;
}

// ===== КАРТОЧКА МАРШРУТА =====
function renderTrailCard(trail) {
  const diff = trail.difficulty;
  const hasImg = trail.cover_image;
  return `
    <a class="trail-card" href="/trail/${trail.id}">
      <div class="trail-card__cover ${hasImg ? '' : 'trail-card__cover--placeholder'}">
        ${hasImg
          ? `<img src="${trail.cover_image}" alt="${trail.name}" loading="lazy">`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1"><path d="M3 12l9-9 9 9M5 10v10h14V10"/></svg>`}
        <span class="trail-card__difficulty trail-card__difficulty--${diff}">${difficultyLabel(diff)}</span>
      </div>
      <div class="trail-card__body">
        <div class="trail-card__name">${trail.name}</div>
        <div class="trail-card__region">📍 ${trail.region}</div>
        <div class="trail-card__rating">
          <span class="star">★</span>
          <span class="value">${trail.rating || '—'}</span>
          <span class="count">${trail.review_count ? '(' + trail.review_count + ' отз.)' : ''}</span>
        </div>
        <div class="trail-card__stats">
          <div class="trail-card__stat">
            <strong>${trail.length_km ? trail.length_km + ' км' : '—'}</strong>
            <span>Длина</span>
          </div>
          <div class="trail-card__stat">
            <strong>${trail.elevation_gain ? trail.elevation_gain + ' м' : '—'}</strong>
            <span>Высота</span>
          </div>
          <div class="trail-card__stat">
            <strong>${formatTime(trail.est_time_min)}</strong>
            <span>Время</span>
          </div>
        </div>
      </div>
    </a>
  `;
}

// ===== ЗАГРУЗКА МАРШРУТОВ =====
let currentDifficulty = '';
let searchTimer = null;

async function loadTrails() {
  const grid = document.getElementById('trailsGrid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading"><div class="loading__spinner"></div></div>';

  const params = new URLSearchParams();
  if (currentDifficulty) params.set('difficulty', currentDifficulty);
  const search = document.getElementById('searchInput')?.value?.trim();
  if (search) params.set('search', search);

  try {
    const res = await fetch('/api/trails?' + params);
    const trails = await res.json();

    if (!trails.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M3 12l9-9 9 9M5 10v10h14V10"/></svg>
          <h3>Маршруты не найдены</h3>
          <p>Попробуйте изменить фильтры</p>
        </div>`;
      return;
    }
    grid.innerHTML = trails.map(renderTrailCard).join('');
  } catch (e) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><h3>Ошибка загрузки</h3><p>Проверьте соединение</p></div>';
  }
}

async function loadStats() {
  try {
    const res = await fetch('/api/trails/stats');
    if (!res.ok) throw new Error();
    const data = await res.json();

    document.getElementById('statTrails').textContent = data.trails || '0';
    document.getElementById('statReviews').textContent = data.reviews || '0';
    document.getElementById('statRating').textContent = data.rating ? data.rating + '★' : '—';
  } catch (e) {
    // fallback — считаем из списка маршрутов
    try {
      const trails = await fetch('/api/trails').then(r => r.json());
      const totalReviews = trails.reduce((s, t) => s + (t.review_count || 0), 0);
      const trailsWithRating = trails.filter(t => parseFloat(t.rating) > 0);
      const avgRating = trailsWithRating.length
        ? (trailsWithRating.reduce((s, t) => s + parseFloat(t.rating), 0) / trailsWithRating.length).toFixed(1)
        : null;
      document.getElementById('statTrails').textContent = trails.length || '0';
      document.getElementById('statReviews').textContent = totalReviews || '0';
      document.getElementById('statRating').textContent = avgRating ? avgRating + '★' : '—';
    } catch {}
  }
}

document.querySelectorAll('.filters__btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filters__btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDifficulty = btn.dataset.difficulty;
    loadTrails();
  });
});

document.getElementById('searchInput')?.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadTrails, 400);
});

// ===== HERO PARALLAX =====
window.addEventListener('scroll', () => {
  const scrolled = window.scrollY;
  const hero = document.querySelector('.hero');
  if (hero && scrolled < window.innerHeight) {
    const far = document.querySelector('.hero__mountain--far');
    const mid = document.querySelector('.hero__mountain--mid');
    const near = document.querySelector('.hero__mountain--near');
    if (far) far.style.transform = `translateY(${scrolled * 0.15}px)`;
    if (mid) mid.style.transform = `translateY(${scrolled * 0.25}px)`;
    if (near) near.style.transform = `translateY(${scrolled * 0.4}px)`;
  }
});

initNavAuth();
loadTrails();
loadStats();