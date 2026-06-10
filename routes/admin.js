const express = require('express');
<<<<<<< HEAD
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler, createError, validate } = require('../middleware/errorHandler');

const ALLOWED_DIFFICULTY  = ['easy', 'moderate', 'hard'];
const ALLOWED_TRAIL_TYPES = ['out-and-back', 'loop', 'point-to-point'];
const ALLOWED_ROLES       = ['user', 'admin'];

module.exports = function(db) {
  const router  = express.Router();
  const isAdmin = requireAdmin(db);

  // ── Multer ────────────────────────────────────────────────────────────────
=======
const multer = require('multer');
const path = require('path');
const fs = require('fs');

module.exports = function(db) {
  const router = express.Router();

  const requireAdmin = (req, res, next) => {
    if (!req.session.userId || req.session.role !== 'admin') {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    next();
  };

>>>>>>> b1ec530a5caf99bf04f1e98d06b5ced7160c874f
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
<<<<<<< HEAD
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  });

  const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (ALLOWED_MIMETYPES.includes(file.mimetype)) cb(null, true);
      else cb(new Error(`Недопустимый тип файла: ${file.mimetype}. Разрешены: JPEG, PNG, WEBP, GIF`));
    },
  });

  const uploadFields = upload.fields([
    { name: 'cover', maxCount: 1 },
    { name: 'images', maxCount: 10 },
  ]);

  // ── Статистика ────────────────────────────────────────────────────────────
  router.get('/stats', isAdmin, asyncHandler(async (req, res) => {
    const trails  = db.get('SELECT COUNT(*) as c FROM trails');
    const reviews = db.get('SELECT COUNT(*) as c FROM reviews');
    const users   = db.get('SELECT COUNT(*) as c FROM users');
    const avg     = db.get('SELECT AVG(rating) as avg FROM trails');
    res.json({
      trails:    trails.c,
      reviews:   reviews.c,
      users:     users.c,
      avgRating: Math.round((avg.avg || 0) * 10) / 10,
    });
  }));

  // ── GET /admin/trails ─────────────────────────────────────────────────────
  router.get('/trails', isAdmin, asyncHandler(async (req, res) => {
    res.json(db.all('SELECT * FROM trails ORDER BY id DESC'));
  }));

  // ── POST /admin/trails ────────────────────────────────────────────────────
  router.post('/trails', isAdmin, uploadFields, asyncHandler(async (req, res) => {
    validate({
      name:        { required: true, label: 'Название', minLength: 2, maxLength: 150 },
      difficulty:  { required: true, label: 'Сложность', enum: ALLOWED_DIFFICULTY },
      trail_type:  { required: true, label: 'Тип маршрута', enum: ALLOWED_TRAIL_TYPES },
      length_km:   { label: 'Длина (км)', type: 'float', min: 0 },
      elevation_gain: { label: 'Перепад высот (м)', type: 'float', min: 0 },
      est_time_min:   { label: 'Время (мин)', type: 'integer', min: 0 },
    }, req.body);

    const {
      name, description, difficulty, length_km, elevation_gain, est_time_min,
      trail_type, surface_natural, surface_unknown, surface_steps,
      region, latitude, longitude,
    } = req.body;

    let cover_image = null;
    if (req.files?.cover) cover_image = '/uploads/' + req.files.cover[0].filename;

    db.run(
      `INSERT INTO trails
         (name,description,difficulty,length_km,elevation_gain,est_time_min,
          trail_type,surface_natural,surface_unknown,surface_steps,
          region,latitude,longitude,cover_image)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        name.trim(), description?.trim() || '', difficulty,
        parseFloat(length_km) || 0,
        parseInt(elevation_gain) || 0,
        parseInt(est_time_min) || 0,
        trail_type,
        parseInt(surface_natural) || 0,
        parseInt(surface_unknown) || 0,
        parseInt(surface_steps)   || 0,
        region?.trim() || 'Алматы',
        parseFloat(latitude)  || null,
        parseFloat(longitude) || null,
        cover_image,
      ]
    );

    const newId = db.lastInsertId();
    req.files?.images?.forEach(f =>
      db.run('INSERT INTO trail_images (trail_id, image_path) VALUES (?, ?)',
        [newId, '/uploads/' + f.filename])
    );

    res.status(201).json({ success: true, id: newId });
  }));

  // ── PUT /admin/trails/:id ─────────────────────────────────────────────────
  router.put('/trails/:id', isAdmin, uploadFields, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw createError.badRequest('Некорректный ID');

    const trail = db.get('SELECT * FROM trails WHERE id = ?', [id]);
    if (!trail) throw createError.notFound('Маршрут');

    validate({
      name:       { required: true, label: 'Название', minLength: 2, maxLength: 150 },
      difficulty: { required: true, label: 'Сложность', enum: ALLOWED_DIFFICULTY },
      trail_type: { required: true, label: 'Тип маршрута', enum: ALLOWED_TRAIL_TYPES },
    }, req.body);

    const {
      name, description, difficulty, length_km, elevation_gain, est_time_min,
      trail_type, surface_natural, surface_unknown, surface_steps,
      region, latitude, longitude,
    } = req.body;

    let cover_image = trail.cover_image;
    if (req.files?.cover) cover_image = '/uploads/' + req.files.cover[0].filename;

    db.run(
      `UPDATE trails SET
         name=?,description=?,difficulty=?,length_km=?,elevation_gain=?,
         est_time_min=?,trail_type=?,surface_natural=?,surface_unknown=?,surface_steps=?,
         region=?,latitude=?,longitude=?,cover_image=?
       WHERE id=?`,
      [
        name.trim(), description?.trim() || '', difficulty,
        parseFloat(length_km) || 0,
        parseInt(elevation_gain) || 0,
        parseInt(est_time_min) || 0,
        trail_type,
        parseInt(surface_natural) || 0,
        parseInt(surface_unknown) || 0,
        parseInt(surface_steps)   || 0,
        region?.trim() || 'Алматы',
        parseFloat(latitude)  || null,
        parseFloat(longitude) || null,
        cover_image, id,
      ]
    );

    req.files?.images?.forEach(f =>
      db.run('INSERT INTO trail_images (trail_id, image_path) VALUES (?, ?)',
        [id, '/uploads/' + f.filename])
    );

    res.json({ success: true });
  }));

  // ── DELETE /admin/trails/:id ──────────────────────────────────────────────
  router.delete('/trails/:id', isAdmin, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw createError.badRequest('Некорректный ID');

    const trail = db.get('SELECT id FROM trails WHERE id = ?', [id]);
    if (!trail) throw createError.notFound('Маршрут');

    db.run('DELETE FROM trails       WHERE id = ?',         [id]);
    db.run('DELETE FROM reviews      WHERE trail_id = ?',   [id]);
    db.run('DELETE FROM trail_images WHERE trail_id = ?',   [id]);
    res.json({ success: true });
  }));

  // ── DELETE /admin/trail-images/:id ───────────────────────────────────────
  router.delete('/trail-images/:id', isAdmin, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw createError.badRequest('Некорректный ID');

    const img = db.get('SELECT * FROM trail_images WHERE id = ?', [id]);
    if (!img) throw createError.notFound('Фотография');

    const fp = path.join(__dirname, '..', img.image_path);
    try {
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch (e) {
      console.warn(`[warn] Не удалось удалить файл ${fp}:`, e.message);
    }

    db.run('DELETE FROM trail_images WHERE id = ?', [id]);
    res.json({ success: true });
  }));

  // ── GET /admin/users ──────────────────────────────────────────────────────
  router.get('/users', isAdmin, asyncHandler(async (req, res) => {
    res.json(db.all(
      'SELECT id, username, email, role, is_banned, created_at FROM users ORDER BY id DESC'
    ));
  }));

  // ── PUT /admin/users/:id/ban ──────────────────────────────────────────────
  router.put('/users/:id/ban', isAdmin, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw createError.badRequest('Некорректный ID');

    const user = db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) throw createError.notFound('Пользователь');
    if (user.role === 'admin')
      throw createError.forbidden('Нельзя заблокировать администратора');

    db.run('UPDATE users SET is_banned = ? WHERE id = ?', [user.is_banned ? 0 : 1, id]);
    res.json({ success: true, is_banned: !user.is_banned });
  }));

  // ── DELETE /admin/users/:id ───────────────────────────────────────────────
  router.delete('/users/:id', isAdmin, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw createError.badRequest('Некорректный ID');

    const user = db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) throw createError.notFound('Пользователь');
    if (user.role === 'admin')
      throw createError.forbidden('Нельзя удалить администратора');

    db.run('DELETE FROM users   WHERE id = ?',        [id]);
    db.run('DELETE FROM reviews WHERE user_id = ?',   [id]);
    res.json({ success: true });
  }));

  // ── PUT /admin/users/:id/role ─────────────────────────────────────────────
  router.put('/users/:id/role', isAdmin, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw createError.badRequest('Некорректный ID');

    validate({
      role: { required: true, label: 'Роль', enum: ALLOWED_ROLES },
    }, req.body);

    const user = db.get('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) throw createError.notFound('Пользователь');

    db.run('UPDATE users SET role = ? WHERE id = ?', [req.body.role, id]);
    res.json({ success: true });
  }));

  // ── GET /admin/reviews ────────────────────────────────────────────────────
  router.get('/reviews', isAdmin, asyncHandler(async (req, res) => {
    res.json(db.all(
      `SELECT r.*, t.name as trail_name
       FROM reviews r
       LEFT JOIN trails t ON r.trail_id = t.id
       ORDER BY r.id DESC`
    ));
  }));

  // ── PUT /admin/reviews/:id/hide ───────────────────────────────────────────
  router.put('/reviews/:id/hide', isAdmin, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw createError.badRequest('Некорректный ID');

    const review = db.get('SELECT * FROM reviews WHERE id = ?', [id]);
    if (!review) throw createError.notFound('Отзыв');

    db.run('UPDATE reviews SET is_hidden = ? WHERE id = ?', [review.is_hidden ? 0 : 1, id]);
    res.json({ success: true });
  }));

  // ── DELETE /admin/reviews/:id ─────────────────────────────────────────────
  router.delete('/reviews/:id', isAdmin, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw createError.badRequest('Некорректный ID');

    const review = db.get('SELECT * FROM reviews WHERE id = ?', [id]);
    if (!review) throw createError.notFound('Отзыв');

    db.run('DELETE FROM reviews WHERE id = ?', [id]);

    const all = db.all('SELECT rating FROM reviews WHERE trail_id = ? AND is_hidden = 0', [review.trail_id]);
    const avg = all.length ? all.reduce((s, r) => s + r.rating, 0) / all.length : 0;
    db.run('UPDATE trails SET rating = ?, review_count = ? WHERE id = ?', [
      Math.round(avg * 10) / 10, all.length, review.trail_id,
    ]);

    res.json({ success: true });
  }));

  return router;
};
=======
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
    if (!trail) return res.status(404).json({ error: 'Маршрут не найден' });

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
>>>>>>> b1ec530a5caf99bf04f1e98d06b5ced7160c874f
