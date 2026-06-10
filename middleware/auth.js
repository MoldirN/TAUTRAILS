const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tautrails-jwt-secret-2024-change-in-prod';
const COOKIE_ACCESS  = 'tt_access';
const COOKIE_REFRESH = 'tt_refresh';

function signAccess(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
function signRefresh(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}
function cookieOpts(maxAge) {
  return { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge };
}

function setTokens(res, payload) {
  res.cookie(COOKIE_ACCESS,  signAccess(payload),  cookieOpts(7  * 24 * 60 * 60 * 1000));
  res.cookie(COOKIE_REFRESH, signRefresh(payload), cookieOpts(30 * 24 * 60 * 60 * 1000));
}

function clearTokens(res) {
  res.clearCookie(COOKIE_ACCESS);
  res.clearCookie(COOKIE_REFRESH);
}

function getToken(req) {
  return req.cookies?.[COOKIE_ACCESS] ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
}

function requireAuth(db) {
  return (req, res, next) => {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: 'Не авторизован' });
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      return next();
    } catch (err) {
      if (err.name !== 'TokenExpiredError') return res.status(401).json({ error: 'Недействительный токен' });
      const refreshToken = req.cookies?.[COOKIE_REFRESH];
      if (!refreshToken) return res.status(401).json({ error: 'Сессия истекла' });
      let decoded;
      try { decoded = jwt.verify(refreshToken, JWT_SECRET); }
      catch { clearTokens(res); return res.status(401).json({ error: 'Сессия истекла, войдите снова' }); }
      const user = db.get('SELECT id, username, role, is_banned FROM users WHERE id = ?', [decoded.id]);
      if (!user || user.is_banned) { clearTokens(res); return res.status(401).json({ error: 'Аккаунт недоступен' }); }
      const payload = { id: user.id, username: user.username, role: user.role };
      setTokens(res, payload);
      req.user = payload;
      next();
    }
  };
}

function optionalAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return next();
  try { req.user = jwt.verify(token, JWT_SECRET); } catch {}
  next();
}

function requireAdmin(db) {
  const auth = requireAuth(db);
  return (req, res, next) => {
    auth(req, res, () => {
      if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
      next();
    });
  };
}

module.exports = { setTokens, clearTokens, requireAuth, optionalAuth, requireAdmin };
