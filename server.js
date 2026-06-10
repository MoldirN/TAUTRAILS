<<<<<<< HEAD
const express    = require('express');
const cookieParser = require('cookie-parser');
const path       = require('path');
const initDB     = require('./database/db');
const {
  notFound,
  globalErrorHandler,
  requestLogger,
} = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
=======
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
>>>>>>> b1ec530a5caf99bf04f1e98d06b5ced7160c874f

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

<<<<<<< HEAD
// ── Routes ────────────────────────────────────────────────────────────────────
initDB().then(db => {
  app.use('/api/auth',   require('./routes/auth')(db));
  app.use('/api/trails', require('./routes/trails')(db));
  app.use('/api/admin',  require('./routes/admin')(db));

  // Page routes
  app.get('/',          (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
  app.get('/trail/:id', (req, res) => res.sendFile(path.join(__dirname, 'public/trail.html')));
  app.get('/admin',     (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
  app.get('/login',     (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
  app.get('/register',  (req, res) => res.sendFile(path.join(__dirname, 'public/register.html')));
  app.get('/profile',   (req, res) => res.sendFile(path.join(__dirname, 'public/profile.html')));
  app.get('/error',     (req, res) => res.sendFile(path.join(__dirname, 'public/error.html')));

  // ── 404 для неизвестных API-маршрутов ────────────────────────────────────
  app.use('/api', notFound);

  // ── Глобальный обработчик ошибок (ВСЕГДА последний) ──────────────────────
  app.use(globalErrorHandler);
=======
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
>>>>>>> b1ec530a5caf99bf04f1e98d06b5ced7160c874f

  app.listen(PORT, () => {
    console.log(`🏔️  TAUTRAILS запущен на http://localhost:${PORT}`);
    console.log(`👤 Админ: admin / admin123`);
<<<<<<< HEAD
    console.log(`🌍 Режим: ${process.env.NODE_ENV || 'development'}`);
  });
}).catch(err => {
  console.error('❌ Ошибка запуска БД:', err);
  process.exit(1);
});

// ── Неперехваченные Promise-rejection / исключения ───────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  process.exit(1);
});
=======
  });
}).catch(err => {
  console.error('Ошибка запуска БД:', err);
  process.exit(1);
});
>>>>>>> b1ec530a5caf99bf04f1e98d06b5ced7160c874f
