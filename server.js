require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const initDB = require('./database/db');
const { requestLogger, notFound, globalErrorHandler } = require('./middleware/errorHandler');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

function renderErrorPage(res, code, message = '') {
  return res.redirect(
    `/error.html?code=${code}&message=${encodeURIComponent(message)}`
  );
}

const app = express();

const PORT = process.env.PORT || 3000;

app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

initDB().then(db => {
  app.use('/api/auth', require('./routes/auth')(db));
  app.use('/api/trails', require('./routes/trails')(db));
  app.use('/api/admin', require('./routes/admin')(db));

  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
  app.get('/trail/:id', (req, res) => res.sendFile(path.join(__dirname, 'public/trail.html')));
  app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

  app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
  app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public/register.html')));
  app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'public/profile.html')));

  /* Для проверки ошибки 500:
  app.get('/test500', (req, res) => {
  console.log('TEST500');
  throw new Error('Тестовая ошибка');
});
  */
 
  app.use(notFound);
  app.use(globalErrorHandler);

  app.listen(PORT, () => {
    console.log(`🏔️  TAUTRAILS запущен на http://localhost:${PORT}`);
    console.log(`👤 Админ: admin / admin123`);
  });
});