const express = require('express');
const { optionalAuth } = require('../middleware/auth');

module.exports = function(db) {
  const router = express.Router();

  // Публичная статистика для Hero секции
  /**
 * @swagger
 * /api/trails/stats:
 *   get:
 *     summary: Получить публичную статистику
 *     tags:
 *       - Trails
 *     responses:
 *       200:
 *         description: Статистика получена
 */
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

  /**
 * @swagger
 * /api/trails:
 *   get:
 *     summary: Получить список маршрутов
 *     tags:
 *       - Trails
 *     parameters:
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [easy, moderate, hard]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Список маршрутов
 */
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

  /**
 * @swagger
 * /api/trails/{id}:
 *   get:
 *     summary: Получить маршрут по ID
 *     tags:
 *       - Trails
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Маршрут найден
 *       404:
 *         description: Маршрут не найден
 */
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

  /**
 * @swagger
 * /api/trails/{id}/reviews:
 *   post:
 *     summary: Добавить отзыв
 *     tags:
 *       - Reviews
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - author_name
 *               - rating
 *             properties:
 *               author_name:
 *                 type: string
 *                 example: Аружан
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               comment:
 *                 type: string
 *                 example: Отличный маршрут
 *               sticker:
 *                 type: string
 *                 example: 👍
 *     responses:
 *       200:
 *         description: Отзыв добавлен
 *       400:
 *         description: Ошибка валидации
 */
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

  /**
 * @swagger
 * /api/trails/reviews/{id}:
 *   put:
 *     summary: Обновить отзыв
 *     tags:
 *       - Reviews
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID отзыва
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - author_name
 *               - rating
 *             properties:
 *               author_name:
 *                 type: string
 *                 example: "Аружан"
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               comment:
 *                 type: string
 *                 example: "Отличный маршрут"
 *               sticker:
 *                 type: string
 *                 example: "👍"
 *     responses:
 *       200:
 *         description: Отзыв успешно обновлен
 *       400:
 *         description: Некорректные данные
 */
  router.put('/reviews/:id', optionalAuth, (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Необходимо войти в систему' });
    }
    const review = db.get(
      'SELECT * FROM reviews WHERE id = ?',
      [req.params.id]
    );
    
    if (!review) {
      return res.status(404).json({ error: 'Отзыв не найден' });
    }
    
    const isAdmin = req.user.role === 'admin';
    
    if (!isAdmin && review.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    
    const {
      author_name,
      rating,
      comment,
      sticker
    } = req.body;
    
    if (!author_name || author_name.trim().length < 2) {
      return res.status(400).json({
        error: 'Имя автора должно содержать минимум 2 символа'
      });
    }
    
    const numericRating = Number(rating);
    
    if (
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).json({
        error: 'Оценка должна быть от 1 до 5'
      });
    }
    
    db.run(
      `UPDATE reviews
      SET author_name = ?,
      rating = ?,
      comment = ?,
      sticker = ?
      WHERE id = ?`,
      [
        author_name,
        numericRating,
        comment || '',
        sticker || null,
        req.params.id
      ]
    );
    
    const all = db.all(
      'SELECT rating FROM reviews WHERE trail_id = ? AND is_hidden = 0',
      [review.trail_id]
    );
    
    const avg = all.reduce((s, r) => s + r.rating, 0) / all.length;
    db.run(
      'UPDATE trails SET rating = ?, review_count = ? WHERE id = ?',
      [
        Math.round(avg * 10) / 10,
        all.length,
        review.trail_id
      ]
    );
    
    res.json({
      success: true,
      message: 'Отзыв обновлен'
    
    });
  });

  /**
 * @swagger
 * /api/trails/reviews/{id}:
 *   delete:
 *     summary: Удалить отзыв
 *     tags:
 *       - Reviews
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID отзыва
 *     responses:
 *       200:
 *         description: Отзыв успешно удален
 *       401:
 *         description: Требуется авторизация
 *       404:
 *         description: Отзыв не найден
 */
  router.delete('/reviews/:id', optionalAuth, (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Необходимо войти в систему' });
    }
    
    const review = db.get(
      'SELECT * FROM reviews WHERE id = ?',
      [req.params.id]
    );
    
    if (!review) {
      return res.status(404).json({ error: 'Отзыв не найден' });
    }
    
    const isAdmin = req.user.role === 'admin';
    
    if (!isAdmin && review.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    
    db.run(
      'DELETE FROM reviews WHERE id = ?',
      [req.params.id]
    );
    
    const all = db.all(
      'SELECT rating FROM reviews WHERE trail_id = ? AND is_hidden = 0',
      [review.trail_id]
    );
    
    const avg =
    all.length > 0
    ? all.reduce((s, r) => s + r.rating, 0) / all.length
    : 0;
    
    db.run(
      'UPDATE trails SET rating = ?, review_count = ? WHERE id = ?',
      [
        Math.round(avg * 10) / 10,
        all.length,
        review.trail_id
      ]
    );
    
    res.json({
      success: true,
      message: 'Отзыв удален'
    });
  });
  
  return router;
};