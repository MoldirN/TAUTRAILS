/**
 * public/js/apiClient.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Единый клиент для всех API-запросов.
 * Обеспечивает:
 *   – единообразный формат ошибок
 *   – автоматический retry при 401 (token refresh)
 *   – глобальный toast-уведомления для ошибок
 *   – redirect на /login при истёкшей сессии
 */

// ── Toast-система ─────────────────────────────────────────────────────────────

(function initToastSystem() {
  if (document.getElementById('tt-toast-root')) return;
  const style = document.createElement('style');
  style.textContent = `
    #tt-toast-root {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      display: flex; flex-direction: column-reverse; gap: 8px;
      pointer-events: none;
    }
    .tt-toast {
      pointer-events: auto;
      display: flex; align-items: flex-start; gap: 10px;
      padding: 12px 16px;
      border-radius: 10px;
      min-width: 240px; max-width: 360px;
      font-family: 'Montserrat', sans-serif;
      font-size: 13px; line-height: 1.45;
      box-shadow: 0 4px 20px rgba(0,0,0,0.45);
      animation: tt-slide-in .22s ease;
      transition: opacity .25s, transform .25s;
    }
    .tt-toast--error   { background:#2a1215; border:1px solid #5c1f24; color:#f28b82; }
    .tt-toast--success { background:#0d2118; border:1px solid #1b5e38; color:#6fcf97; }
    .tt-toast--warn    { background:#211c10; border:1px solid #5c4a12; color:#f2c94c; }
    .tt-toast--info    { background:#0d1a2a; border:1px solid #1a3a5c; color:#56b4f5; }
    .tt-toast__icon { font-size:16px; flex-shrink:0; margin-top:1px; }
    .tt-toast__body { flex:1; }
    .tt-toast__title { font-weight:600; margin-bottom:2px; }
    .tt-toast__msg   { opacity:.85; font-size:12px; }
    .tt-toast__close {
      background:none; border:none; cursor:pointer; padding:0;
      color:inherit; opacity:.5; font-size:16px; line-height:1;
      flex-shrink:0; margin-top:-1px;
    }
    .tt-toast__close:hover { opacity:1; }
    .tt-toast--out  { opacity:0; transform:translateX(16px); }
    @keyframes tt-slide-in { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:none; } }
  `;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.id = 'tt-toast-root';
  document.body.appendChild(root);
})();

const TOAST_ICONS = { error:'❌', success:'✅', warn:'⚠️', info:'ℹ️' };

function showToast(message, type = 'error', title = '', duration = 4500) {
  const root  = document.getElementById('tt-toast-root');
  if (!root) return;

  const defaultTitles = { error:'Ошибка', success:'Готово', warn:'Внимание', info:'Информация' };
  const toast = document.createElement('div');
  toast.className = `tt-toast tt-toast--${type}`;
  toast.innerHTML = `
    <span class="tt-toast__icon">${TOAST_ICONS[type] || '•'}</span>
    <div class="tt-toast__body">
      <div class="tt-toast__title">${title || defaultTitles[type]}</div>
      <div class="tt-toast__msg">${message}</div>
    </div>
    <button class="tt-toast__close" aria-label="Закрыть">×</button>
  `;

  const dismiss = () => {
    toast.classList.add('tt-toast--out');
    setTimeout(() => toast.remove(), 280);
  };
  toast.querySelector('.tt-toast__close').addEventListener('click', dismiss);
  root.appendChild(toast);
  setTimeout(dismiss, duration);
}

// ── Класс ошибки API ──────────────────────────────────────────────────────────

class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name    = 'ApiError';
    this.status  = status;
    this.code    = code;
    this.details = details;
  }
}

// ── Основной fetch-клиент ─────────────────────────────────────────────────────

let _refreshing = false;
let _refreshQueue = [];

async function _tryRefresh() {
  if (_refreshing) {
    return new Promise((resolve, reject) =>
      _refreshQueue.push({ resolve, reject })
    );
  }
  _refreshing = true;
  try {
    const r = await fetch('/api/auth/refresh', {
      method: 'POST', credentials: 'include',
    });
    _refreshQueue.forEach(p => r.ok ? p.resolve() : p.reject());
    _refreshQueue = [];
    _refreshing   = false;
    return r.ok;
  } catch {
    _refreshQueue.forEach(p => p.reject());
    _refreshQueue = [];
    _refreshing   = false;
    return false;
  }
}

/**
 * api(url, options)
 *
 * Возвращает Promise<data> или бросает ApiError.
 *
 * options:
 *   method, body, headers, silent (bool — не показывать toast), raw (вернуть Response)
 */
async function api(url, options = {}) {
  const { silent = false, raw = false, ...fetchOpts } = options;

  const defaults = {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(fetchOpts.headers || {}) },
  };

  // Если body — FormData, убираем Content-Type (браузер сам поставит boundary)
  if (fetchOpts.body instanceof FormData) {
    delete defaults.headers['Content-Type'];
  }

  let res = await fetch(url, { ...defaults, ...fetchOpts });

  // Автоматический refresh при 401
  if (res.status === 401 && url !== '/api/auth/refresh') {
    const refreshed = await _tryRefresh();
    if (refreshed) {
      res = await fetch(url, { ...defaults, ...fetchOpts });
    } else {
      // Сессия окончательно истекла
      if (!silent) showToast('Сессия истекла. Войдите снова.', 'warn', 'Требуется вход');
      setTimeout(() => {
        window.location.href = '/login?redirect=' + encodeURIComponent(location.pathname);
      }, 1200);
      throw new ApiError('Сессия истекла', 401, 'UNAUTHORIZED', null);
    }
  }

  if (raw) return res;

  let data;
  const ct = res.headers.get('content-type') || '';
  try {
    data = ct.includes('application/json') ? await res.json() : await res.text();
  } catch {
    throw new ApiError('Не удалось разобрать ответ сервера', res.status, 'PARSE_ERROR', null);
  }

  if (!res.ok) {
    const message = data?.error || data?.message || `Ошибка ${res.status}`;
    const code    = data?.code  || 'ERROR';
    const details = data?.details || null;

    if (!silent) {
      const type = res.status >= 500 ? 'error' : res.status === 403 ? 'warn' : 'error';
      showToast(formatErrorMessage(message, details), type);
    }

    throw new ApiError(message, res.status, code, details);
  }

  return data;
}

/** Форматирует сообщение ошибки, включая поля валидации */
function formatErrorMessage(message, details) {
  if (!details?.fields) return message;
  const fieldErrors = Object.values(details.fields).join('\n');
  return `${message}\n${fieldErrors}`;
}

// ── Удобные сокращения ────────────────────────────────────────────────────────

api.get    = (url, opts)       => api(url, { method: 'GET',    ...opts });
api.post   = (url, body, opts) => api(url, { method: 'POST',   body: JSON.stringify(body), ...opts });
api.put    = (url, body, opts) => api(url, { method: 'PUT',    body: JSON.stringify(body), ...opts });
api.delete = (url, opts)       => api(url, { method: 'DELETE', ...opts });
api.upload = (url, formData, method = 'POST', opts) =>
  api(url, { method, body: formData, ...opts });

// ── Глобальный обработчик непойманных ApiError ────────────────────────────────

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason instanceof ApiError) {
    // Уже показан toast в api(), просто предотвращаем дефолтный вывод в консоль
    event.preventDefault();
  }
});

// Экспорт для модульного и глобального использования
if (typeof module !== 'undefined') {
  module.exports = { api, ApiError, showToast };
} else {
  window.api      = api;
  window.ApiError = ApiError;
  window.showToast = showToast;
}