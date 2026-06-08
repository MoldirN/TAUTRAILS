const express = require('express');
const bcrypt = require('bcryptjs');

module.exports = function(db) {
  const router = express.Router();

  // Логин
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

    req.session.userId = user.id;
    req.session.role = user.role;
    res.json({ success: true, role: user.role, username: user.username });
  });

  // Регистрация
  router.post('/register', (req, res) => {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });
    if (password !== confirmPassword) return res.status(400).json({ error: 'Пароли не совпадают' });
    if (password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });
    if (username.length < 3) return res.status(400).json({ error: 'Имя пользователя минимум 3 символа' });

    const existing = db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });

    if (email) {
      const existingEmail = db.get('SELECT id FROM users WHERE email = ?', [email]);
      if (existingEmail) return res.status(400).json({ error: 'Email уже используется' });
    }

    const hash = bcrypt.hashSync(password, 10);
    db.run('INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email || null, hash, 'user']);

    const newUser = db.get('SELECT * FROM users WHERE username = ?', [username]);
    req.session.userId = newUser.id;
    req.session.role = newUser.role;

    res.json({ success: true, role: newUser.role, username: newUser.username });
  });

  // Выход
  router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
  });

  // Отзывы текущего пользователя
  router.get('/my-reviews', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    const reviews = db.all(
      `SELECT r.*, t.name as trail_name FROM reviews r
       LEFT JOIN trails t ON r.trail_id = t.id
       WHERE r.user_id = ? AND r.is_hidden = 0
       ORDER BY r.created_at DESC`,
      [req.session.userId]
    );
    res.json(reviews);
  });

  // Текущий пользователь
  router.get('/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    const user = db.get('SELECT id, username, email, role, avatar, created_at FROM users WHERE id = ?', [req.session.userId]);
    res.json(user);
  });

  return router;
};