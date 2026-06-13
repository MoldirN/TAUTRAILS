const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

module.exports = function(db) {
  const router = express.Router();

  const allowedDifficulties = ['easy', 'moderate', 'hard'];
  
  const requireAdmin = (req, res, next) => {
    const token = req.cookies?.tt_access;

    if (!token) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    let user;
    try {
      user = jwt.verify(
        token,
        process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Недействительный токен' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    req.user = user;
    next();
  };

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  });
  
  const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

  // Статистика
  router.get('/stats', requireAdmin, (req, res) => {
    const trails = db.get('SELECT COUNT(*) as c FROM trails');
    const reviews = db.get('SELECT COUNT(*) as c FROM reviews');
    const users = db.get('SELECT COUNT(*) as c FROM users');
    const avg = db.get('SELECT AVG(rating) as avg FROM trails');
    res.json({
      trails: trails.c,
      reviews: reviews.c,
      users: users.c,
      avgRating: Math.round((avg.avg || 0) * 10) / 10
    });
  });

  // ===== МАРШРУТЫ =====
  router.get('/trails', requireAdmin, (req, res) => {
    const trails = db.all('SELECT * FROM trails ORDER BY id DESC');
    res.json(trails);
  });

  router.post('/trails', requireAdmin, upload.fields([
    { name: 'cover', maxCount: 1 },
    { name: 'images', maxCount: 10 }
  ]), (req, res) => {
    const { name, description, difficulty, length_km, elevation_gain, est_time_min,
      trail_type, surface_natural, surface_unknown, surface_steps, region, latitude, longitude } = req.body;

    if (!name) return res.status(400).json({ error: 'Название обязательно' });
    
    if (!name || name.trim().length < 3) {
      return res.status(400).json({
        error: 'Название маршрута должно содержать минимум 3 символа'});
      }
      
    if (!allowedDifficulties.includes(difficulty)) {
      return res.status(400).json({
        error: 'Некорректный уровень сложности'});
      }
      
    if (length_km && Number(length_km) <= 0) {
      return res.status(400).json({
        error: 'Длина маршрута должна быть больше 0'});
      }
    
    if (est_time_min && Number(est_time_min) <= 0) {
      return res.status(400).json({
        error: 'Время прохождения должно быть больше 0'});
      }
      
    if (
      latitude &&
      (Number(latitude) < -90 || Number(latitude) > 90)
    ) {
      return res.status(400).json({
        error: 'Некорректная широта'});
      }
      
    if (
      longitude &&
      (Number(longitude) < -180 || Number(longitude) > 180)
    ) {
      return res.status(400).json({
        error: 'Некорректная долгота'});
      }

    let cover_image = null;
    if (req.files && req.files.cover) {
      cover_image = '/uploads/' + req.files.cover[0].filename;
    }

    db.run(`INSERT INTO trails (name,description,difficulty,length_km,elevation_gain,est_time_min,
      trail_type,surface_natural,surface_unknown,surface_steps,region,latitude,longitude,cover_image)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name, description, difficulty, parseFloat(length_km)||0, parseInt(elevation_gain)||0,
       parseInt(est_time_min)||0, trail_type, parseInt(surface_natural)||0,
       parseInt(surface_unknown)||0, parseInt(surface_steps)||0, region,
       parseFloat(latitude)||null, parseFloat(longitude)||null, cover_image]);

    const newId = db.lastInsertId();

    if (req.files && req.files.images) {
      req.files.images.forEach(f => {
        db.run('INSERT INTO trail_images (trail_id, image_path) VALUES (?, ?)', [newId, '/uploads/' + f.filename]);
      });
    }

    res.json({ success: true, id: newId });
  });

  router.put('/trails/:id', requireAdmin, upload.fields([
    { name: 'cover', maxCount: 1 },
    { name: 'images', maxCount: 10 }
  ]), (req, res) => {
    const { name, description, difficulty, length_km, elevation_gain, est_time_min,
      trail_type, surface_natural, surface_unknown, surface_steps, region, latitude, longitude } = req.body;

    const trail = db.get('SELECT * FROM trails WHERE id = ?', [req.params.id]);

    if (!name || name.trim().length < 3) {
      return res.status(400).json({
        error: 'Название маршрута должно содержать минимум 3 символа'});
      }
      
    if (!allowedDifficulties.includes(difficulty)) {
      return res.status(400).json({
        error: 'Некорректный уровень сложности'});
      }
      
    if (length_km && Number(length_km) <= 0) {
      return res.status(400).json({
        error: 'Длина маршрута должна быть больше 0'});
      }
    
    if (est_time_min && Number(est_time_min) <= 0) {
      return res.status(400).json({
        error: 'Время прохождения должно быть больше 0'});
      }
      
    if (
      latitude &&
      (Number(latitude) < -90 || Number(latitude) > 90)
    ) {
      return res.status(400).json({
        error: 'Некорректная широта'});
      }
      
    if (
      longitude &&
      (Number(longitude) < -180 || Number(longitude) > 180)
    ) {
      return res.status(400).json({
        error: 'Некорректная долгота'});
      }
    if (!trail) return res.status(404).json({ error: 'Маршрут не найден' });
    
    if (!name || name.trim().length < 3) {
      return res.status(400).json({
        error: 'Название маршрута должно содержать минимум 3 символа'});
      }
      
    if (!allowedDifficulties.includes(difficulty)) {
      return res.status(400).json({
        error: 'Некорректный уровень сложности'});
      }
      
    if (length_km && Number(length_km) <= 0) {
      return res.status(400).json({
        error: 'Длина маршрута должна быть больше 0'});
      }
    
    if (est_time_min && Number(est_time_min) <= 0) {
      return res.status(400).json({
        error: 'Время прохождения должно быть больше 0'});
      }
      
    if (
      latitude &&
      (Number(latitude) < -90 || Number(latitude) > 90)
    ) {
      return res.status(400).json({
        error: 'Некорректная широта'});
      }
      
    if (
      longitude &&
      (Number(longitude) < -180 || Number(longitude) > 180)
    ) {
      return res.status(400).json({
        error: 'Некорректная долгота'});
      }

    let cover_image = trail.cover_image;
    if (req.files && req.files.cover) {
      cover_image = '/uploads/' + req.files.cover[0].filename;
    }

    db.run(`UPDATE trails SET name=?,description=?,difficulty=?,length_km=?,elevation_gain=?,
      est_time_min=?,trail_type=?,surface_natural=?,surface_unknown=?,surface_steps=?,
      region=?,latitude=?,longitude=?,cover_image=? WHERE id=?`,
      [name, description, difficulty, parseFloat(length_km)||0, parseInt(elevation_gain)||0,
       parseInt(est_time_min)||0, trail_type, parseInt(surface_natural)||0,
       parseInt(surface_unknown)||0, parseInt(surface_steps)||0, region,
       parseFloat(latitude)||null, parseFloat(longitude)||null, cover_image, req.params.id]);

    if (req.files && req.files.images) {
      req.files.images.forEach(f => {
        db.run('INSERT INTO trail_images (trail_id, image_path) VALUES (?, ?)', [req.params.id, '/uploads/' + f.filename]);
      });
    }

    res.json({ success: true });
  });

  router.delete('/trails/:id', requireAdmin, (req, res) => {
    db.run('DELETE FROM trails WHERE id = ?', [req.params.id]);
    db.run('DELETE FROM reviews WHERE trail_id = ?', [req.params.id]);
    db.run('DELETE FROM trail_images WHERE trail_id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // Удалить фото маршрута
  router.delete('/trail-images/:id', requireAdmin, (req, res) => {
    const img = db.get('SELECT * FROM trail_images WHERE id = ?', [req.params.id]);
    if (img) {
      const filePath = path.join(__dirname, '..', img.image_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      db.run('DELETE FROM trail_images WHERE id = ?', [req.params.id]);
    }
    res.json({ success: true });
  });

  // ===== ПОЛЬЗОВАТЕЛИ =====
  router.get('/users', requireAdmin, (req, res) => {
    const users = db.all('SELECT id, username, email, role, is_banned, created_at FROM users ORDER BY id DESC');
    res.json(users);
  });

  router.put('/users/:id/ban', requireAdmin, (req, res) => {
    const user = db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.role === 'admin') return res.status(400).json({ error: 'Нельзя заблокировать админа' });
    db.run('UPDATE users SET is_banned = ? WHERE id = ?', [user.is_banned ? 0 : 1, req.params.id]);
    res.json({ success: true, is_banned: !user.is_banned });
  });

  router.delete('/users/:id', requireAdmin, (req, res) => {
    const user = db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.role === 'admin') return res.status(400).json({ error: 'Нельзя удалить админа' });
    db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
    db.run('DELETE FROM reviews WHERE user_id = ?', [req.params.id]);
    res.json({ success: true });
  });

  router.put('/users/:id/role', requireAdmin, (req, res) => {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Неверная роль' });
    db.run('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    res.json({ success: true });
  });

  // ===== ОТЗЫВЫ =====
  router.get('/reviews', requireAdmin, (req, res) => {
    const reviews = db.all(`
      SELECT r.*, t.name as trail_name 
      FROM reviews r 
      LEFT JOIN trails t ON r.trail_id = t.id 
      ORDER BY r.id DESC
    `);
    res.json(reviews);
  });

  router.put('/reviews/:id/hide', requireAdmin, (req, res) => {
    const review = db.get('SELECT * FROM reviews WHERE id = ?', [req.params.id]);
    if (!review) return res.status(404).json({ error: 'Отзыв не найден' });
    db.run('UPDATE reviews SET is_hidden = ? WHERE id = ?', [review.is_hidden ? 0 : 1, req.params.id]);
    res.json({ success: true });
  });

  router.delete('/reviews/:id', requireAdmin, (req, res) => {
    const review = db.get('SELECT * FROM reviews WHERE id = ?', [req.params.id]);
    if (!review) return res.status(404).json({ error: 'Отзыв не найден' });
    db.run('DELETE FROM reviews WHERE id = ?', [req.params.id]);

    // Пересчёт рейтинга
    const all = db.all('SELECT rating FROM reviews WHERE trail_id = ? AND is_hidden = 0', [review.trail_id]);
    const avg = all.length ? all.reduce((s, r) => s + r.rating, 0) / all.length : 0;
    db.run('UPDATE trails SET rating = ?, review_count = ? WHERE id = ?', [
      Math.round(avg * 10) / 10, all.length, review.trail_id
    ]);

    res.json({ success: true });
  });

  return router;
};
