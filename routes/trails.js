const express = require('express');
<<<<<<< HEAD
const { asyncHandler, createError, validate } = require('../middleware/errorHandler');

const ALLOWED_DIFFICULTY = ['easy', 'moderate', 'hard'];
=======
>>>>>>> b1ec530a5caf99bf04f1e98d06b5ced7160c874f

module.exports = function(db) {
  const router = express.Router();

<<<<<<< HEAD
  // ── GET /api/trails/stats ─────────────────────────────────────────────────
  router.get('/stats', asyncHandler(async (req, res) => {
    const trailsRow  = db.get('SELECT COUNT(*) as c FROM trails');
    const reviewsRow = db.get('SELECT COUNT(*) as c FROM reviews WHERE is_hidden = 0');
    const ratingRow  = db.get('SELECT AVG(rating) as avg FROM trails WHERE rating > 0');
    res.json({
      trails:  trailsRow?.c  || 0,
      reviews: reviewsRow?.c || 0,
      rating:  ratingRow?.avg ? Math.round(ratingRow.avg * 10) / 10 : null,
    });
  }));

  // ── GET /api/trails ───────────────────────────────────────────────────────
  router.get('/', asyncHandler(async (req, res) => {
    const { difficulty, search } = req.query;

    if (difficulty && !ALLOWED_DIFFICULTY.includes(difficulty))
      throw createError.badRequest(
        `Недопустимое значение difficulty. Допустимые: ${ALLOWED_DIFFICULTY.join(', ')}`
      );

    if (search && search.length > 100)
      throw createError.badRequest('Поисковый запрос слишком длинный (макс. 100 символов)');

=======
  // Публичная статистика для Hero секции
  router.get('/stats', (req, res) => {
    const trailsRow = db.get('SELECT COUNT(*) as c FROM trails');
    const reviewsRow = db.get('SELECT COUNT(*) as c FROM reviews WHERE is_hidden = 0');
    const ratingRow = db.get('SELECT AVG(rating) as avg FROM trails WHERE rating > 0');

    const avgRating = ratingRow?.avg ? Math.round(ratingRow.avg * 10) / 10 : null;

    res.json({
      trails: trailsRow?.c || 0,
      reviews: reviewsRow?.c || 0,
      rating: avgRating
    });
  });

  router.get('/', (req, res) => {
    const { difficulty, search } = req.query;
>>>>>>> b1ec530a5caf99bf04f1e98d06b5ced7160c874f
    let query = 'SELECT * FROM trails WHERE 1=1';
    const params = [];

    if (difficulty) { query += ' AND difficulty = ?'; params.push(difficulty); }
    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ? OR region LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY rating DESC';

<<<<<<< HEAD
    res.json(db.all(query, params));
  }));

  // ── GET /api/trails/:id ───────────────────────────────────────────────────
  router.get('/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      throw createError.badRequest('ID маршрута должен быть положительным числом');

    const trail = db.get('SELECT * FROM trails WHERE id = ?', [id]);
    if (!trail) throw createError.notFound('Маршрут');

    const images  = db.all('SELECT * FROM trail_images WHERE trail_id = ?', [id]);
    const reviews = db.all(
      'SELECT * FROM reviews WHERE trail_id = ? AND is_hidden = 0 ORDER BY id DESC LIMIT 50',
      [id]
    );

    res.json({ ...trail, images, reviews });
  }));

  // ── POST /api/trails/:id/reviews ──────────────────────────────────────────
  router.post('/:id/reviews', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      throw createError.badRequest('ID маршрута должен быть положительным числом');

    const trail = db.get('SELECT id FROM trails WHERE id = ?', [id]);
    if (!trail) throw createError.notFound('Маршрут');

    validate({
      author_name: { required: true, label: 'Имя автора', minLength: 2, maxLength: 50 },
      rating: {
        required: true, label: 'Оценка',
        type: 'integer', min: 1, max: 5,
      },
      comment: { maxLength: 1000, label: 'Комментарий' },
    }, req.body);

    const { author_name, rating, comment, sticker, user_id } = req.body;

    // Проверка стикера (если передан)
    const ALLOWED_STICKERS = ['🏔️','🌲','💧','☀️','🦅','🥾','❄️','🌸','🦌','🌿'];
    if (sticker && !ALLOWED_STICKERS.includes(sticker))
      throw createError.badRequest('Недопустимый стикер');

    db.run(
      'INSERT INTO reviews (trail_id, user_id, author_name, rating, comment, sticker) VALUES (?, ?, ?, ?, ?, ?)',
      [id, user_id || null, author_name.trim(), parseInt(rating), comment?.trim() || '', sticker || null]
    );

    // Пересчёт рейтинга
    const all = db.all('SELECT rating FROM reviews WHERE trail_id = ? AND is_hidden = 0', [id]);
    const avg = all.reduce((s, r) => s + r.rating, 0) / all.length;
    db.run('UPDATE trails SET rating = ?, review_count = ? WHERE id = ?', [
      Math.round(avg * 10) / 10, all.length, id,
    ]);

    res.status(201).json({ success: true });
  }));

  return router;
};
=======
    const trails = db.all(query, params);
    res.json(trails);
  });

  router.get('/:id', (req, res) => {
    const trail = db.get('SELECT * FROM trails WHERE id = ?', [req.params.id]);
    if (!trail) return res.status(404).json({ error: 'Маршрут не найден' });

    const images = db.all('SELECT * FROM trail_images WHERE trail_id = ?', [req.params.id]);
    const reviews = db.all(
      'SELECT * FROM reviews WHERE trail_id = ? AND is_hidden = 0 ORDER BY id DESC LIMIT 50',
      [req.params.id]
    );

    res.json({ ...trail, images, reviews });
  });

  router.post('/:id/reviews', (req, res) => {
    const { author_name, rating, comment, sticker, user_id } = req.body;
    if (!author_name || !rating) return res.status(400).json({ error: 'Заполните обязательные поля' });

    db.run(
      'INSERT INTO reviews (trail_id, user_id, author_name, rating, comment, sticker) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, user_id || null, author_name, rating, comment || '', sticker || null]
    );

    const all = db.all('SELECT rating FROM reviews WHERE trail_id = ? AND is_hidden = 0', [req.params.id]);
    const avg = all.reduce((s, r) => s + r.rating, 0) / all.length;
    db.run('UPDATE trails SET rating = ?, review_count = ? WHERE id = ?', [
      Math.round(avg * 10) / 10, all.length, req.params.id
    ]);

    res.json({ success: true });
  });

  return router;
};
>>>>>>> b1ec530a5caf99bf04f1e98d06b5ced7160c874f
