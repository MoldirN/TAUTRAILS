const jwt = require('jsonwebtoken');
const COOKIE_ACCESS  = 'tt_access';
const COOKIE_REFRESH = 'tt_refresh';

function signAccess(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}
function signRefresh(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });
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
    const refreshToken = req.cookies?.[COOKIE_REFRESH];

    if (!token) {
      if (!refreshToken) {
        return res.status(401).json({ error: 'Не авторизован' });
      }

      try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

        const user = db.get(
          'SELECT id, username, role, is_banned FROM users WHERE id = ?',
          [decoded.id]
        );

        if (!user || user.is_banned) {
          clearTokens(res);
          return res.status(401).json({ error: 'Аккаунт недоступен' });
        }

        const payload = {
          id: user.id,
          username: user.username,
          role: user.role
        };

        setTokens(res, payload);
        req.user = payload;
        return next();

      } catch {
        return res.status(401).json({ error: 'Сессия истекла' });
      }
    }

    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
      return next();
    } catch (err) {
      if (err.name !== 'TokenExpiredError') {
        return res.status(401).json({ error: 'Недействительный токен' });
      }
      
      if (!refreshToken) {
        return res.status(401).json({ error: 'Сессия истекла' });
      }

      try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

        const user = db.get(
          'SELECT id, username, role, is_banned FROM users WHERE id = ?',
          [decoded.id]
        );

        if (!user || user.is_banned) {
          clearTokens(res);
          return res.status(401).json({ error: 'Аккаунт недоступен' });
        }

        const payload = {
          id: user.id,
          username: user.username,
          role: user.role
        };

        setTokens(res, payload);
        req.user = payload;
        return next();

      } catch {
        return res.status(401).json({ error: 'Сессия истекла' });
      }
    }
  };
}

function optionalAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return next();
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); } catch {}
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