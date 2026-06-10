let editingId = null;

const loginPage = document.getElementById('loginPage');
const adminPage = document.getElementById('adminPage');
const loginAlert = document.getElementById('loginAlert');

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const user = await res.json();
      if (user.role === 'admin') showAdmin();
    }
  } catch {}
}

function showAdmin() {
  loginPage.style.display = 'none';
  adminPage.style.display = 'flex';
  loadStats();
  loadAdminTrails();
}

// ===== ЛОГИН =====
document.getElementById('loginBtn')?.addEventListener('click', async () => {
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();

  if (res.ok && data.role === 'admin') {
    showAdmin();
  } else if (res.ok) {
    loginAlert.className = 'alert alert--error show';
    loginAlert.textContent = 'Нет прав администратора';
  } else {
    loginAlert.className = 'alert alert--error show';
    loginAlert.textContent = data.error || 'Ошибка входа';
  }
});

document.getElementById('loginPassword')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('loginBtn').click();
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/login';
});

// ===== НАВИГАЦИЯ =====
const views = ['dashboard', 'trails', 'users', 'reviews'];
const viewTitles = { dashboard: 'ДАШБОРД', trails: 'МАРШРУТЫ', users: 'ПОЛЬЗОВАТЕЛИ', reviews: 'ОТЗЫВЫ' };

document.querySelectorAll('.admin-sidebar__item').forEach(item => {
  item.addEventListener('click', () => {
    const view = item.dataset.view;
    document.querySelectorAll('.admin-sidebar__item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    views.forEach(v => {
      const el = document.getElementById('view' + v.charAt(0).toUpperCase() + v.slice(1));
      if (el) el.style.display = v === view ? 'block' : 'none';
    });

    document.getElementById('viewTitle').textContent = viewTitles[view] || view.toUpperCase();

    if (view === 'users') loadUsers();
    if (view === 'reviews') loadReviews();
    if (view === 'trails') loadAdminTrails();

    if (window.innerWidth < 768) {
      document.getElementById('adminSidebar').classList.add('hidden');
    }
  });
});

document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('adminSidebar').classList.toggle('hidden');
});

// ===== СТАТИСТИКА =====
async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats');
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('dashTrails').textContent = data.trails;
    document.getElementById('dashReviews').textContent = data.reviews;
    document.getElementById('dashUsers').textContent = data.users;
    document.getElementById('dashRating').textContent = data.avgRating + ' ★';
  } catch {}
}

// ===== МАРШРУТЫ =====
async function loadAdminTrails() {
  const tbody = document.getElementById('trailsTableBody');
  try {
    const res = await fetch('/api/admin/trails');
    if (!res.ok) return;
    const trails = await res.json();

    if (!trails.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#556655;">Маршрутов нет</td></tr>';
      return;
    }

    const diffLabel = { easy: 'Лёгкий', moderate: 'Средний', hard: 'Сложный' };
    const diffColor = { easy: '#4ade80', moderate: '#f59e0b', hard: '#ef4444' };

    tbody.innerHTML = trails.map(t => `
      <tr>
        <td>
          ${t.cover_image
            ? `<img src="${t.cover_image}" style="width:60px;height:40px;object-fit:cover;border-radius:6px;">`
            : `<div style="width:60px;height:40px;background:#1a2e1a;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:18px;">🏔️</div>`}
        </td>
        <td class="admin-table__name">${t.name}</td>
        <td><span style="color:${diffColor[t.difficulty]};font-weight:700;">${diffLabel[t.difficulty]}</span></td>
        <td>${t.length_km ? t.length_km + ' км' : '—'}</td>
        <td>★ ${t.rating || '—'}</td>
        <td>
          <div class="admin-table__actions">
            <button class="btn btn--secondary btn--sm" onclick="openEdit(${t.id})">✏️ Изменить</button>
            <button class="btn btn--danger btn--sm" onclick="deleteTrail(${t.id}, '${t.name.replace(/'/g, "\\'")}')">🗑️ Удалить</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:#ef4444;">Ошибка загрузки</td></tr>';
  }
}

// ===== ПОЛЬЗОВАТЕЛИ =====
async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  try {
    const res = await fetch('/api/admin/users');
    if (!res.ok) return;
    const users = await res.json();

    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#556655;">Пользователей нет</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => `
      <tr>
        <td style="color:#556655;">#${u.id}</td>
        <td style="font-weight:600;">${u.username}</td>
        <td style="color:#8a9e8a;">${u.email || '—'}</td>
        <td>
          <span style="color:${u.role === 'admin' ? '#4ade80' : '#8a9e8a'}; font-weight:600;">
            ${u.role === 'admin' ? '👑 Админ' : '👤 Пользователь'}
          </span>
        </td>
        <td>
          <span style="color:${u.is_banned ? '#ef4444' : '#4ade80'};">
            ${u.is_banned ? '🚫 Заблокирован' : '✅ Активен'}
          </span>
        </td>
        <td style="color:#556655; font-size:12px;">${new Date(u.created_at).toLocaleDateString('ru-RU')}</td>
        <td>
          <div class="admin-table__actions">
            ${u.role !== 'admin' ? `
              <button class="btn btn--sm ${u.is_banned ? 'btn--primary' : 'btn--secondary'}"
                onclick="toggleBan(${u.id}, this)">
                ${u.is_banned ? '🔓 Разблокировать' : '🚫 Заблокировать'}
              </button>
              <button class="btn btn--danger btn--sm" onclick="deleteUser(${u.id}, '${u.username}')">
                🗑️ Удалить
              </button>
            ` : '<span style="color:#556655; font-size:12px;">Защищён</span>'}
          </div>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:#ef4444;">Ошибка загрузки</td></tr>';
  }
}

async function toggleBan(id, btn) {
  try {
    const res = await fetch(`/api/admin/users/${id}/ban`, { method: 'PUT' });
    const data = await res.json();
    if (res.ok) loadUsers();
  } catch {}
}
window.toggleBan = toggleBan;

async function deleteUser(id, name) {
  if (!confirm(`Удалить пользователя "${name}"? Все его отзывы тоже будут удалены.`)) return;
  try {
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    loadUsers();
    loadStats();
  } catch {}
}
window.deleteUser = deleteUser;

// ===== ОТЗЫВЫ =====
async function loadReviews() {
  const tbody = document.getElementById('reviewsTableBody');
  try {
    const res = await fetch('/api/admin/reviews');
    if (!res.ok) return;
    const reviews = await res.json();

    if (!reviews.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#556655;">Отзывов нет</td></tr>';
      return;
    }

    tbody.innerHTML = reviews.map(r => `
      <tr style="${r.is_hidden ? 'opacity:0.4;' : ''}">
        <td style="font-weight:600;">${r.author_name}</td>
        <td style="color:#8a9e8a; font-size:13px;">${r.trail_name || '—'}</td>
        <td style="color:#f59e0b;">★ ${r.rating}</td>
        <td style="font-size:20px;">${r.sticker || '—'}</td>
        <td style="color:#8a9e8a; font-size:13px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${r.comment || '—'}
        </td>
        <td>
          <span style="color:${r.is_hidden ? '#ef4444' : '#4ade80'};">
            ${r.is_hidden ? '🙈 Скрыт' : '👁️ Виден'}
          </span>
        </td>
        <td>
          <div class="admin-table__actions">
            <button class="btn btn--sm btn--secondary" onclick="toggleReview(${r.id})">
              ${r.is_hidden ? '👁️ Показать' : '🙈 Скрыть'}
            </button>
            <button class="btn btn--sm btn--danger" onclick="deleteReview(${r.id})">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:#ef4444;">Ошибка загрузки</td></tr>';
  }
}

async function toggleReview(id) {
  try {
    await fetch(`/api/admin/reviews/${id}/hide`, { method: 'PUT' });
    loadReviews();
  } catch {}
}
window.toggleReview = toggleReview;

async function deleteReview(id) {
  if (!confirm('Удалить отзыв?')) return;
  try {
    await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
    loadReviews();
    loadStats();
  } catch {}
}
window.deleteReview = deleteReview;

// ===== МОДАЛЬНОЕ ОКНО =====
function openModal() { document.getElementById('trailModal').classList.add('open'); }
function closeModal() {
  document.getElementById('trailModal').classList.remove('open');
  editingId = null;
  clearForm();
}

function clearForm() {
  ['fName','fDesc','fRegion','fLat','fLng','fLength','fElevation','fTime','fNatural','fSteps'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('fDifficulty').value = 'moderate';
  document.getElementById('fType').value = 'out-and-back';
  document.getElementById('modalAlert').className = 'alert';
  document.getElementById('modalTitle').textContent = 'ДОБАВИТЬ МАРШРУТ';
  document.getElementById('coverPreview').innerHTML = '';
  document.getElementById('imagesPreview').innerHTML = '';
  document.getElementById('existingImages').style.display = 'none';
  document.getElementById('existingImagesGrid').innerHTML = '';
}

document.getElementById('addTrailBtn')?.addEventListener('click', () => { clearForm(); openModal(); });
document.getElementById('modalClose')?.addEventListener('click', closeModal);
document.getElementById('cancelModalBtn')?.addEventListener('click', closeModal);
document.getElementById('trailModal')?.addEventListener('click', e => {
  if (e.target === document.getElementById('trailModal')) closeModal();
});

// Превью обложки
document.getElementById('fCover')?.addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('coverPreview').innerHTML =
      `<img src="${e.target.result}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;margin-top:8px;">`;
  };
  reader.readAsDataURL(file);
});

// Превью доп. фото
document.getElementById('fImages')?.addEventListener('change', function() {
  const preview = document.getElementById('imagesPreview');
  preview.innerHTML = '';
  Array.from(this.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const div = document.createElement('div');
      div.style.cssText = 'display:inline-block; margin:4px;';
      div.innerHTML = `<img src="${e.target.result}" style="width:80px;height:60px;object-fit:cover;border-radius:6px;">`;
      preview.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
});

// ===== РЕДАКТИРОВАНИЕ =====
async function openEdit(id) {
  try {
    const res = await fetch(`/api/trails/${id}`);
    const t = await res.json();
    editingId = id;

    document.getElementById('modalTitle').textContent = 'ИЗМЕНИТЬ МАРШРУТ';
    document.getElementById('fName').value = t.name || '';
    document.getElementById('fDesc').value = t.description || '';
    document.getElementById('fDifficulty').value = t.difficulty || 'moderate';
    document.getElementById('fType').value = t.trail_type || 'out-and-back';
    document.getElementById('fLength').value = t.length_km || '';
    document.getElementById('fElevation').value = t.elevation_gain || '';
    document.getElementById('fTime').value = t.est_time_min || '';
    document.getElementById('fRegion').value = t.region || '';
    document.getElementById('fLat').value = t.latitude || '';
    document.getElementById('fLng').value = t.longitude || '';
    document.getElementById('fNatural').value = t.surface_natural || '';
    document.getElementById('fSteps').value = t.surface_steps || '';

    // Показать существующие фото
    const allImages = [];
    if (t.cover_image) allImages.push({ src: t.cover_image, label: 'Обложка' });
    (t.images || []).forEach(img => allImages.push({ src: img.image_path, id: img.id }));

    if (allImages.length) {
      document.getElementById('existingImages').style.display = 'block';
      document.getElementById('existingImagesGrid').innerHTML = allImages.map(img => `
        <div class="existing-img-item">
          <img src="${img.src}" alt="">
          ${img.label ? `<span class="existing-img-label">${img.label}</span>` : ''}
          ${img.id ? `<button class="existing-img-del" onclick="deleteTrailImage(${img.id}, this)">×</button>` : ''}
        </div>
      `).join('');
    }

    // Показать обложку
    if (t.cover_image) {
      document.getElementById('coverPreview').innerHTML =
        `<img src="${t.cover_image}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;margin-top:8px;">`;
    }

    openModal();
  } catch (e) {
    alert('Ошибка загрузки данных');
  }
}
window.openEdit = openEdit;

async function deleteTrailImage(id, btn) {
  if (!confirm('Удалить это фото?')) return;
  try {
    await fetch(`/api/admin/trail-images/${id}`, { method: 'DELETE' });
    btn.closest('.existing-img-item').remove();
  } catch {}
}
window.deleteTrailImage = deleteTrailImage;

async function deleteTrail(id, name) {
  if (!confirm(`Удалить маршрут "${name}"?`)) return;
  try {
    await fetch(`/api/admin/trails/${id}`, { method: 'DELETE' });
    loadAdminTrails();
    loadStats();
  } catch { alert('Ошибка удаления'); }
}
window.deleteTrail = deleteTrail;

// ===== СОХРАНЕНИЕ =====
document.getElementById('saveTrailBtn')?.addEventListener('click', async () => {
  const modalAlert = document.getElementById('modalAlert');
  const btn = document.getElementById('saveTrailBtn');
  const name = document.getElementById('fName').value.trim();

  if (!name) {
    modalAlert.className = 'alert alert--error show';
    modalAlert.textContent = 'Название обязательно';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Сохранение...';

  const formData = new FormData();
  formData.append('name', name);
  formData.append('description', document.getElementById('fDesc').value);
  formData.append('difficulty', document.getElementById('fDifficulty').value);
  formData.append('trail_type', document.getElementById('fType').value);
  formData.append('length_km', document.getElementById('fLength').value);
  formData.append('elevation_gain', document.getElementById('fElevation').value);
  formData.append('est_time_min', document.getElementById('fTime').value);
  formData.append('region', document.getElementById('fRegion').value);
  formData.append('latitude', document.getElementById('fLat').value);
  formData.append('longitude', document.getElementById('fLng').value);
  formData.append('surface_natural', document.getElementById('fNatural').value);
  formData.append('surface_steps', document.getElementById('fSteps').value);
  formData.append('surface_unknown',
    Math.max(0, 100 - (parseInt(document.getElementById('fNatural').value)||0) - (parseInt(document.getElementById('fSteps').value)||0))
  );

  const cover = document.getElementById('fCover').files[0];
  if (cover) formData.append('cover', cover);

  const images = document.getElementById('fImages').files;
  for (const img of images) formData.append('images', img);

  try {
    const url = editingId ? `/api/admin/trails/${editingId}` : '/api/admin/trails';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, body: formData });
    const data = await res.json();

    if (res.ok) {
      closeModal();
      loadAdminTrails();
      loadStats();
    } else {
      modalAlert.className = 'alert alert--error show';
      modalAlert.textContent = data.error || 'Ошибка сохранения';
    }
  } catch {
    modalAlert.className = 'alert alert--error show';
    modalAlert.textContent = 'Ошибка соединения';
  }

  btn.disabled = false;
  btn.textContent = 'Сохранить';
});

checkAuth();