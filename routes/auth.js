const express = require('express');
const bcrypt = require('bcryptjs');
const { setTokens, clearTokens, requireAuth} = require('../middleware/auth');
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = function(db) {
  const router = express.Router();

  // Логин
  /**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вход пользователя
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Успешный вход
 *       401:
 *         description: Ошибка авторизации
 */
  router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) return res.status(400).json({ error: 'Введите логин и пароль' });

    const user = db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
    if (user.is_banned) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role
    };

    setTokens(res, payload);

    res.json({
      success: true,
      role: user.role,
      username: user.username
    });
  });

  // Регистрация
  /**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Регистрация пользователя
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - confirmPassword
 *             properties:
 *               username:
 *                 type: string
 *                 example: user123
 *               email:
 *                 type: string
 *                 example: user@tautrails.kz
 *               password:
 *                 type: string
 *                 example: 123456
 *               confirmPassword:
 *                 type: string
 *                 example: 123456
 *     responses:
 *       200:
 *         description: Пользователь зарегистрирован
 *       400:
 *         description: Ошибка валидации
 */
  router.post('/register', (req, res) => {
    const { username, email, password, confirmPassword } = req.body;
    
    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Заполните все поля' });
    }
    
    if (username.trim().length < 3 || username.trim().length > 30) {
      return res.status(400).json({
        error: 'Имя пользователя должно содержать от 3 до 30 символов'});
      }
      
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Некорректный email'});
      }
        
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Пароль должен содержать минимум 6 символов'});
      }
        
    if (password.length > 100) {
      return res.status(400).json({
        error: 'Пароль слишком длинный'});
      }
      
    if (password !== confirmPassword) {
      return res.status(400).json({
        error: 'Пароли не совпадают'});
      }

    const existing = db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });

    const existingEmail = db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingEmail) return res.status(400).json({ error: 'Email уже используется' });

    const hash = bcrypt.hashSync(password, 10);
    
    db.run(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email || null, hash, 'user']
    );
    
    const newUser = db.get(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    
    const payload = {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role
    };
    
    setTokens(res, payload);
    
    res.json({
      success: true,
      role: newUser.role,
      username: newUser.username
    });
  });

  // Выход
  /**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Выход пользователя
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Выход выполнен
 */
  router.post('/logout', (req, res) => {
    clearTokens(res);
    res.json({ success: true });
  });

  // Отзывы текущего пользователя
  /**
 * @swagger
 * /api/auth/my-reviews:
 *   get:
 *     summary: Получить отзывы текущего пользователя
 *     tags:
 *       - Auth
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Список отзывов
 *       401:
 *         description: Не авторизован
 */
  router.get('/my-reviews', (req, res) => {
    const token = req.cookies?.tt_access;

    if (!token) return res.status(401).json({ error: 'Не авторизован' });

    let user;
    try {
      user = require('jsonwebtoken').verify(
        token,
        process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Недействительный токен' });
    }

    const reviews = db.all(
      `SELECT r.*, t.name as trail_name FROM reviews r
       LEFT JOIN trails t ON r.trail_id = t.id
       WHERE r.user_id = ? AND r.is_hidden = 0
       ORDER BY r.created_at DESC`,
      [user.id]
    );
    res.json(reviews);
  });

  // Текущий пользователь
  /**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Получить текущего пользователя
 *     tags:
 *       - Auth
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Данные пользователя
 *       401:
 *         description: Не авторизован
 *       404:
 *         description: Пользователь не найден
 */
  router.get('/me', requireAuth(db), (req, res) => {
    const user = db.get(
      'SELECT id, username, email, role, avatar, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    res.json(user);
  });
  
  return router;
};