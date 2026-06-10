const express = require('express');
const bcrypt  = require('bcryptjs');
const { setTokens, clearTokens, requireAuth } = require('../middleware/auth');
const { asyncHandler, createError, validate }  = require('../middleware/errorHandler');

module.exports = function(db) {
  const router = express.Router();

  // ── POST /api/auth/register ───────────────────────────────────────────────
  router.post('/register', asyncHandler(async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;

    // Валидация
    validate({
      username: {
        required: true, label: 'Имя пользователя',
        minLength: 3, maxLength: 30,
        pattern: /^[a-zA-Z0-9_\-а-яА-ЯёЁ]+$/,
        patternMsg: 'Имя пользователя содержит недопустимые символы',
      },
      password: {
        required: true, label: 'Пароль',
        minLength: 6, maxLength: 100,
      },
    }, req.body);

    if (!confirmPassword)
      throw createError.badRequest('Подтвердите пароль');
    if (password !== confirmPassword)
      throw createError.badRequest('Пароли не совпадают');

    if (email) {
      validate({ email: { type: 'email', label: 'Email' } }, req.body);
    }

    if (db.get('SELECT id FROM users WHERE username = ?', [username]))
      throw createError.conflict('Пользователь с таким именем уже существует');

    if (email && db.get('SELECT id FROM users WHERE email = ?', [email]))
      throw createError.conflict('Email уже используется');

    const hash = bcrypt.hashSync(password, 12);
    db.run(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username.trim(), email?.trim() || null, hash, 'user']
    );

    const newUser = db.get('SELECT id, username, role FROM users WHERE username = ?', [username.trim()]);
    if (!newUser) throw createError.internal('Ошибка создания пользователя');

    setTokens(res, { id: newUser.id, username: newUser.username, role: newUser.role });
    res.status(201).json({ success: true, role: newUser.role, username: newUser.username });
  }));

  // ── POST /api/auth/login ──────────────────────────────────────────────────
  router.post('/login', asyncHandler(async (req, res) => {
    validate({
      username: { required: true, label: 'Логин' },
      password: { required: true, label: 'Пароль' },
    }, req.body);

    const { username, password } = req.body;

    const user = db.get(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username.trim(), username.trim()]
    );

    // Намеренно одно сообщение — не раскрываем, что именно неверно
    if (!user || !bcrypt.compareSync(password, user.password))
      throw new (require('../middleware/errorHandler').AppError)(
        'Неверный логин или пароль', 401, 'INVALID_CREDENTIALS'
      );

    if (user.is_banned)
      throw new (require('../middleware/errorHandler').AppError)(
        'Аккаунт заблокирован', 403, 'ACCOUNT_BANNED'
      );

    setTokens(res, { id: user.id, username: user.username, role: user.role });
    res.json({ success: true, role: user.role, username: user.username });
  }));

  // ── POST /api/auth/logout ─────────────────────────────────────────────────
  router.post('/logout', (req, res) => {
    clearTokens(res);
    res.json({ success: true });
  });

  // ── GET /api/auth/me ──────────────────────────────────────────────────────
  router.get('/me', requireAuth(db), asyncHandler(async (req, res) => {
    const user = db.get(
      'SELECT id, username, email, role, avatar, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!user) throw createError.notFound('Пользователь');
    res.json(user);
  }));

  // ── GET /api/auth/my-reviews ──────────────────────────────────────────────
  router.get('/my-reviews', requireAuth(db), asyncHandler(async (req, res) => {
    const reviews = db.all(
      `SELECT r.*, t.name as trail_name FROM reviews r
       LEFT JOIN trails t ON r.trail_id = t.id
       WHERE r.user_id = ? AND r.is_hidden = 0
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(reviews);
  }));

  // ── POST /api/auth/refresh ────────────────────────────────────────────────
  router.post('/refresh', asyncHandler(async (req, res) => {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'tautrails-jwt-secret-2024-change-in-prod';
    const refreshToken = req.cookies?.tt_refresh || req.body?.refreshToken;

    if (!refreshToken) throw createError.unauthorized('Нет refresh токена');

    let decoded;
    try { decoded = jwt.verify(refreshToken, JWT_SECRET); }
    catch {
      clearTokens(res);
      throw new (require('../middleware/errorHandler').AppError)('Refresh токен истёк', 401, 'TOKEN_EXPIRED');
    }

    const user = db.get(
      'SELECT id, username, role, is_banned FROM users WHERE id = ?',
      [decoded.id]
    );
    if (!user || user.is_banned) {
      clearTokens(res);
      throw createError.forbidden('Аккаунт недоступен');
    }

    setTokens(res, { id: user.id, username: user.username, role: user.role });
    res.json({ success: true });
  }));

  return router;
};
