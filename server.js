const express = require('express');
const session = require('express-session');
const path = require('path');
const initDB = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'tautrails-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

initDB().then(db => {
  app.use('/api/auth', require('./routes/auth')(db));
  app.use('/api/trails', require('./routes/trails')(db));
  app.use('/api/admin', require('./routes/admin')(db));

  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
  app.get('/trail/:id', (req, res) => res.sendFile(path.join(__dirname, 'public/trail.html')));
  app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

  // ✅ ИСПРАВЛЕНО: добавляем роуты для страниц входа и регистрации
  app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
  app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public/register.html')));
  app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'public/profile.html')));

  app.listen(PORT, () => {
    console.log(`🏔️  TAUTRAILS запущен на http://localhost:${PORT}`);
    console.log(`👤 Админ: admin / admin123`);
  });
}).catch(err => {
  console.error('Ошибка запуска БД:', err);
  process.exit(1);
});