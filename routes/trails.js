const express = require('express');
const { optionalAuth } = require('../middleware/auth');

module.exports = function(db) {
  const router = express.Router();

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
    let query = 'SELECT * FROM trails WHERE 1=1';
    const params = [];

    if (difficulty) { query += ' AND difficulty = ?'; params.push(difficulty); }
    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ? OR region LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY rating DESC';

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

  router.post('/:id/reviews', optionalAuth, (req, res) => {
    const { author_name, rating, comment, sticker} = req.body;
    if (!author_name || author_name.trim().length < 2) {
      return res.status(400).json({
        error: 'Имя автора должно содержать минимум 2 символа'});
      }
      
    const numericRating = Number(rating);
    
    if (
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).json({
        error: 'Оценка должна быть от 1 до 5'});
      }
      
    if (comment && comment.length > 1000) {
      return res.status(400).json({
        error: 'Комментарий слишком длинный'});
      }

      const userId = req.user?.id || null;
      db.run(
      'INSERT INTO reviews (trail_id, user_id, author_name, rating, comment, sticker) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, userId, author_name, numericRating, comment || '', sticker || null]
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