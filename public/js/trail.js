function difficultyLabel(d) {
  return { easy: 'Лёгкий', moderate: 'Средний', hard: 'Сложный' }[d] || d;
}
function trailTypeLabel(t) {
  return { 'out-and-back': 'Туда-обратно', 'loop': 'Петля', 'point-to-point': 'Из точки в точку' }[t] || t;
}
function formatTime(min) {
  if (!min) return '—';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h} ч ${m} мин` : `${h} ч`) : `${m} мин`;
}
function starsHtml(n) {
  n = Math.round(n);
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}
function formatDate(str) {
  return new Date(str).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

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

let currentUser = null;

async function initNavAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      currentUser = await res.json();

      document.getElementById('navAuthLinks').style.display = 'none';
      document.getElementById('navRegisterLink').style.display = 'none';
      document.getElementById('navUserMenu').style.display = 'flex';
      document.getElementById('navUsername').textContent = '👤 ' + currentUser.username;

      const mobileLogin = document.getElementById('mobileLoginLink');
      const mobileRegister = document.getElementById('mobileRegisterLink');
      const mobileUserSec = document.getElementById('mobileUserSection');
      const mobileUser = document.getElementById('mobileUsername');
      if (mobileLogin) mobileLogin.style.display = 'none';
      if (mobileRegister) mobileRegister.style.display = 'none';
      if (mobileUserSec) mobileUserSec.style.display = 'flex';
      if (mobileUser) mobileUser.textContent = '👤 ' + currentUser.username;

      if (currentUser.role === 'admin') {
        document.getElementById('navAdminLink').style.display = 'block';
      }

      // Показываем форму отзыва авторизованному
      document.getElementById('reviewGuest').style.display = 'none';
      document.getElementById('reviewFormBlock').style.display = 'block';
      document.getElementById('reviewUserAvatar').textContent = currentUser.username.charAt(0).toUpperCase();
      document.getElementById('reviewUserName').textContent = currentUser.username;

    } else {
      // Кнопка входа с редиректом обратно на эту страницу
      const loginBtn = document.getElementById('reviewLoginBtn');
      if (loginBtn) loginBtn.href = '/login?redirect=' + encodeURIComponent(location.pathname);
    }
  } catch (e) {}

  document.getElementById('navLogout')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.reload();
  });
  document.getElementById('mobileLogout')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.reload();
  });
}

// ===== МАРШРУТ =====
const trailId = location.pathname.split('/trail/')[1];
let map = null;

function initMap(lat, lng, name) {
  if (!lat || !lng) return;
  document.getElementById('mapCard').style.display = 'block';
  document.getElementById('mapCoords').textContent =
    `Координаты: ${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`;
  if (map) { map.remove(); map = null; }
  map = L.map('trailMap', { zoomControl: true, scrollWheelZoom: false }).setView([lat, lng], 13);
  L.tileLayer('https://tile2.maps.2gis.com/tiles?x={x}&y={y}&z={z}&v=1&ts=online_hd', {
    attribution: '© <a href="https://2gis.kz" target="_blank">2GIS</a>', maxZoom: 18
  }).addTo(map);
  L.marker([lat, lng], {
    icon: L.divIcon({ html: '<div class="map-marker">🏔️</div>', className: '', iconSize: [40,40], iconAnchor: [20,40] })
  }).addTo(map).bindPopup(`<strong style="color:#111">${name}</strong>`).openPopup();
  setTimeout(() => map.invalidateSize(), 300);
}

function renderGallery(images, coverImage) {
  const gallery = document.getElementById('trailGallery');
  const allImages = [];
  if (coverImage) allImages.push(coverImage);
  images.forEach(img => { if (img.image_path !== coverImage) allImages.push(img.image_path); });
  if (allImages.length <= 1) return;
  gallery.style.display = 'grid';
  gallery.innerHTML = allImages.map((src, i) => `
    <div class="trail-gallery__item ${i===0?'trail-gallery__item--main':''}" onclick="openLightbox('${src}')">
      <img src="${src}" alt="Фото ${i+1}" loading="lazy">
    </div>
  `).join('');
}

function openLightbox(src) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `<div class="lightbox__overlay"></div><img class="lightbox__img" src="${src}" alt=""><button class="lightbox__close">×</button>`;
  document.body.appendChild(lb);
  setTimeout(() => lb.classList.add('open'), 10);
  lb.querySelector('.lightbox__overlay').onclick = () => lb.remove();
  lb.querySelector('.lightbox__close').onclick = () => lb.remove();
}

async function loadTrail() {
  try {
    const res = await fetch(`/api/trails/${trailId}`);
    if (!res.ok) throw new Error();
    renderTrail(await res.json());
  } catch {
    document.getElementById('trailHeroInfo').innerHTML = '<p style="color:#ef4444">Маршрут не найден</p>';
  }
}

function renderTrail(trail) {
  document.title = trail.name + ' — TAUTRAILS';

  const placeholder = document.getElementById('trailHeroPlaceholder');
  if (trail.cover_image) {
    const img = document.createElement('img');
    img.src = trail.cover_image; img.className = 'trail-hero__img'; img.alt = trail.name;
    placeholder.replaceWith(img);
  }

  document.getElementById('trailHeroInfo').innerHTML = `
    <span class="trail-hero__difficulty trail-hero__difficulty--${trail.difficulty}">${difficultyLabel(trail.difficulty)}</span>
    <h1 class="trail-hero__title">${trail.name}</h1>
    <div class="trail-hero__meta">
      <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;display:inline;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${trail.region}</span>
      <span>${starsHtml(trail.rating||0)} ${trail.rating||'—'} (${trail.review_count} отзывов)</span>
      <span>${trailTypeLabel(trail.trail_type)}</span>
    </div>
  `;

  document.getElementById('trailStatsBar').innerHTML = `
    <div class="trail-stats-bar__item"><strong>${trail.length_km ? trail.length_km+' км':'—'}</strong><span>Длина</span></div>
    <div class="trail-stats-bar__item"><strong>${trail.elevation_gain ? trail.elevation_gain+' м':'—'}</strong><span>Набор высоты</span></div>
    <div class="trail-stats-bar__item"><strong>${formatTime(trail.est_time_min)}</strong><span>Время</span></div>
    <div class="trail-stats-bar__item"><strong>${trail.activity_count||0}</strong><span>Активностей</span></div>
  `;

  document.getElementById('trailDesc').textContent = trail.description || 'Описание отсутствует.';
  renderGallery(trail.images||[], trail.cover_image);
  if (trail.latitude && trail.longitude) initMap(trail.latitude, trail.longitude, trail.name);

  const nat = trail.surface_natural||0, unk = trail.surface_unknown||0, stp = trail.surface_steps||0;
  const total = Math.max(nat+unk+stp, 100);
  document.getElementById('surfaceBar').innerHTML = `
    <div class="surface-card__bar-natural" style="width:${nat/total*100}%"></div>
    <div class="surface-card__bar-unknown" style="width:${unk/total*100}%"></div>
    <div class="surface-card__bar-steps" style="width:${stp/total*100}%"></div>
  `;
  document.getElementById('surfaceItems').innerHTML = `
    <div class="surface-card__item"><div class="surface-card__item-left"><div class="surface-card__item-dot" style="background:#a0724a;"></div>Природная</div><div class="surface-card__item-right">${nat}% / ${((trail.length_km||0)*nat/100).toFixed(1)} км</div></div>
    <div class="surface-card__item"><div class="surface-card__item-left"><div class="surface-card__item-dot" style="background:#888;"></div>Неизвестная</div><div class="surface-card__item-right">${unk}% / ${((trail.length_km||0)*unk/100).toFixed(1)} км</div></div>
    <div class="surface-card__item"><div class="surface-card__item-left"><div class="surface-card__item-dot" style="background:#ef4444;"></div>Ступени</div><div class="surface-card__item-right">${stp}% / ${((trail.length_km||0)*stp/100).toFixed(1)} км</div></div>
  `;

  // Звёзды генерируются JS — не хардкод в HTML
  document.getElementById('ratingBig').textContent = trail.rating || '—';
  document.getElementById('ratingStars').textContent = trail.rating ? starsHtml(trail.rating) : '';
  document.getElementById('ratingCount').textContent = `${trail.review_count} отзывов · ${trail.activity_count} активностей`;

  renderReviews(trail.reviews||[]);
  document.getElementById('trailContent').style.display = 'block';
}

function renderReviews(reviews) {
  const el = document.getElementById('reviewsItems');
  if (!reviews.length) {
    el.innerHTML = '<p style="color:#556655;font-size:14px;padding:16px 0;">Отзывов пока нет. Будьте первым!</p>';
    return;
  }
el.innerHTML = reviews.map(r => {
  const canEdit =
    currentUser &&
    (currentUser.role === 'admin' || currentUser.id === r.user_id);

  return `
    <div class="reviews-list__item">
      <div class="reviews-list__header">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="reviews-list__avatar">${r.author_name.charAt(0).toUpperCase()}</div>

          <div>
            <span class="reviews-list__author">${r.author_name}</span>
            <div class="reviews-list__date">${formatDate(r.created_at)}</div>
          </div>
        </div>

        ${r.sticker ? `<span class="review-sticker-display">${r.sticker}</span>` : ''}
      </div>

      <div class="reviews-list__stars">${starsHtml(r.rating)}</div>

      ${r.comment ? `<p class="reviews-list__text">${r.comment}</p>` : ''}

      ${
        canEdit
          ? `
          <div style="display:flex;gap:10px;margin-top:12px;">
            <button class="btn btn--secondary"
              onclick="editReview(${r.id}, '${r.author_name.replace(/'/g, "\\'")}', ${r.rating}, '${(r.comment || '').replace(/'/g, "\\'")}', '${r.sticker || ''}')">
              ✏️ Редактировать
            </button>

            <button class="btn btn--danger"
              onclick="deleteReview(${r.id})">
              🗑️ Удалить
            </button>
          </div>
          `
          : ''
      }
    </div>
  `;
}).join('');
}

// ===== СТИКЕРЫ =====
let selectedSticker = null;
document.querySelectorAll('.sticker-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sticker-btn').forEach(b => b.classList.remove('active'));
    selectedSticker = selectedSticker === btn.dataset.sticker ? null : btn.dataset.sticker;
    if (selectedSticker) btn.classList.add('active');
  });
});

// ===== ЗВЁЗДЫ =====
let selectedRating = 0;
document.querySelectorAll('.review-form__stars label').forEach(label => {
  label.addEventListener('click', () => {
    selectedRating = parseInt(label.dataset.val);
    document.querySelectorAll('.review-form__stars label').forEach((l, i) => {
      l.classList.toggle('selected', i < selectedRating);
      l.style.color = i < selectedRating ? '#4ade80' : '';
    });
  });
  label.addEventListener('mouseenter', () => {
    const val = parseInt(label.dataset.val);
    document.querySelectorAll('.review-form__stars label').forEach((l, i) => {
      l.style.color = i < val ? '#4ade80' : '';
    });
  });
  label.addEventListener('mouseleave', () => {
    document.querySelectorAll('.review-form__stars label').forEach((l, i) => {
      l.style.color = i < selectedRating ? '#4ade80' : '';
    });
  });
});

// ===== ОТПРАВКА ОТЗЫВА =====
document.getElementById('submitReview')?.addEventListener('click', async () => {
  const alertEl = document.getElementById('reviewAlert');
  if (!currentUser) {
    window.location.href = '/login?redirect=' + encodeURIComponent(location.pathname);
    return;
  }
  if (!selectedRating) {
    alertEl.className = 'alert alert--error show';
    alertEl.textContent = 'Выберите оценку';
    return;
  }
  const btn = document.getElementById('submitReview');
  btn.disabled = true; btn.textContent = 'Отправка...';
  try {
    const res = await fetch(`/api/trails/${trailId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author_name: currentUser.username,
        rating: selectedRating,
        comment: document.getElementById('reviewText').value.trim(),
        sticker: selectedSticker,
        user_id: currentUser.id
      })
    });
    if (!res.ok) throw new Error();
    alertEl.className = 'alert alert--success show';
    alertEl.textContent = '✅ Отзыв добавлен! Спасибо.';
    document.getElementById('reviewText').value = '';
    selectedRating = 0; selectedSticker = null;
    document.querySelectorAll('.review-form__stars label').forEach(l => { l.classList.remove('selected'); l.style.color = ''; });
    document.querySelectorAll('.sticker-btn').forEach(b => b.classList.remove('active'));
    setTimeout(() => loadTrail(), 1000);
  } catch {
    alertEl.className = 'alert alert--error show';
    alertEl.textContent = 'Ошибка. Попробуйте снова.';
  }
  btn.disabled = false; btn.textContent = 'Отправить отзыв';
});

// ===== РЕДАКТИРОВАНИЕ ОТЗЫВА =====
async function editReview(id, author, rating, comment, sticker) {

  const newAuthor = prompt('Автор:', author);
  if (newAuthor === null) return;

  const newRating = prompt('Оценка (1-5):', rating);
  if (newRating === null) return;

  const newSticker = prompt('Стикер:', sticker || '');
  if (newSticker === null) return;

  const newComment = prompt('Комментарий:', comment || '');
  if (newComment === null) return;

  const res = await fetch(`/api/trails/reviews/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      author_name: newAuthor,
      rating: Number(newRating),
      sticker: newSticker,
      comment: newComment
    })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || 'Ошибка');
    return;
  }

  loadTrail();
}

// ===== УДАЛЕНИЕ ОТЗЫВА =====
async function deleteReview(id) {

  if (!confirm('Вы действительно хотите удалить этот отзыв?')) return;

  const res = await fetch(`/api/trails/reviews/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || 'Ошибка');
    return;
  }

  loadTrail();
}

initNavAuth();
loadTrail();