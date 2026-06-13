/**
 * middleware/errorHandler.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Централизованная обработка ошибок для Tautrails.
 *
 * Архитектура:
 *   AppError            – кастомный класс с кодом статуса и контекстом
 *   createError(…)      – фабрика для частых случаев (400/401/403/404/409/422)
 *   validate(schema, …) – лёгкий валидатор тела запроса
 *   asyncHandler(fn)    – оборачивает async-обработчик, пробрасывает ошибки в next()
 *   notFound            – middleware для неизвестных маршрутов (404)
 *   globalErrorHandler  – финальный middleware Express (4 аргумента)
 *   requestLogger       – простой лог входящих запросов + ошибок
 */

const IS_PROD = process.env.NODE_ENV === 'production';

// ── Пользовательский класс ошибки ────────────────────────────────────────────

class AppError extends Error {
  /**
   * @param {string}  message   – сообщение для клиента
   * @param {number}  status    – HTTP-статус
   * @param {string}  [code]    – машинный код (для фронта)
   * @param {object}  [details] – дополнительный контекст (поля и т.п.)
   */
  constructor(message, status = 500, code = null, details = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code || httpCodeName(status);
    this.details = details;
    this.isOperational = true;         // обрабатываем, не крашим процесс
    Error.captureStackTrace(this, AppError);
  }
}

function httpCodeName(status) {
  const map = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    413: 'PAYLOAD_TOO_LARGE',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_ERROR',
    503: 'SERVICE_UNAVAILABLE',
  };
  return map[status] || 'ERROR';
}

// ── Фабрика частых ошибок ────────────────────────────────────────────────────

const createError = {
  badRequest:    (msg = 'Неверный запрос', details = null) =>
    new AppError(msg, 400, 'BAD_REQUEST', details),

  unauthorized:  (msg = 'Не авторизован') =>
    new AppError(msg, 401, 'UNAUTHORIZED'),

  forbidden:     (msg = 'Доступ запрещён') =>
    new AppError(msg, 403, 'FORBIDDEN'),

  notFound:      (entity = 'Ресурс') =>
    new AppError(`${entity} не найден`, 404, 'NOT_FOUND'),

  conflict:      (msg = 'Конфликт данных') =>
    new AppError(msg, 409, 'CONFLICT'),

  validation:    (fields) =>
    new AppError('Ошибка валидации', 422, 'VALIDATION_ERROR', { fields }),

  tooLarge:      (msg = 'Файл слишком большой') =>
    new AppError(msg, 413, 'PAYLOAD_TOO_LARGE'),

  internal:      (msg = 'Внутренняя ошибка сервера') =>
    new AppError(msg, 500, 'INTERNAL_ERROR'),
};

// ── Лёгкий валидатор ─────────────────────────────────────────────────────────

/**
 * validate(rules, body)
 *
 * rules = {
 *   fieldName: { required, minLength, maxLength, type, pattern, label }
 * }
 *
 * Бросает AppError(422) при ошибках, иначе возвращает очищенный объект.
 */
function validate(rules, body) {
  const errors = {};

  for (const [field, rule] of Object.entries(rules)) {
    const label = rule.label || field;
    const raw   = body?.[field];
    const val   = typeof raw === 'string' ? raw.trim() : raw;

    if (rule.required && (val === undefined || val === null || val === '')) {
      errors[field] = `Поле «${label}» обязательно`;
      continue;
    }
    if (!rule.required && (val === undefined || val === null || val === '')) continue;

    if (rule.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      errors[field] = `Поле «${label}» должно содержать корректный email`;
    }
    if (rule.type === 'integer') {
      const n = Number(val);
      if (!Number.isInteger(n)) errors[field] = `Поле «${label}» должно быть целым числом`;
    }
    if (rule.type === 'float') {
      if (isNaN(parseFloat(val))) errors[field] = `Поле «${label}» должно быть числом`;
    }
    if (rule.minLength && String(val).length < rule.minLength) {
      errors[field] = `Поле «${label}» минимум ${rule.minLength} символов`;
    }
    if (rule.maxLength && String(val).length > rule.maxLength) {
      errors[field] = `Поле «${label}» максимум ${rule.maxLength} символов`;
    }
    if (rule.min !== undefined && Number(val) < rule.min) {
      errors[field] = `Поле «${label}» не менее ${rule.min}`;
    }
    if (rule.max !== undefined && Number(val) > rule.max) {
      errors[field] = `Поле «${label}» не более ${rule.max}`;
    }
    if (rule.pattern && !rule.pattern.test(val)) {
      errors[field] = rule.patternMsg || `Поле «${label}» содержит недопустимые символы`;
    }
    if (rule.enum && !rule.enum.includes(val)) {
      errors[field] = `Поле «${label}» должно быть одним из: ${rule.enum.join(', ')}`;
    }
  }

  if (Object.keys(errors).length) throw createError.validation(errors);
  return body;
}

// ── asyncHandler ─────────────────────────────────────────────────────────────

/**
 * Оборачивает async route-handler, пробрасывая ошибки через next().
 * Использование: router.get('/path', asyncHandler(async (req, res) => { … }))
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ── Middleware: 404 для неизвестных маршрутов ─────────────────────────────────

function notFound(req, res, next) {
  if (req.originalUrl.startsWith('/api')) {
    return next(new AppError(
      `Маршрут ${req.method} ${req.originalUrl} не найден`,
      404,
      'NOT_FOUND'
    ));
  }
  return res.redirect('/error.html?code=404');
}

// ── Обработка специфичных ошибок сторонних библиотек ─────────────────────────

function normalizeError(err) {
  // Multer: файл слишком большой
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('Размер файла превышает допустимый лимит (10 МБ)', 413, 'PAYLOAD_TOO_LARGE');
  }
  // Multer: слишком много файлов
  if (err.code === 'LIMIT_FILE_COUNT') {
    return new AppError('Превышено допустимое количество файлов', 400, 'BAD_REQUEST');
  }
  // Multer: неожиданное поле
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Неожиданное поле файла: ' + err.field, 400, 'BAD_REQUEST');
  }
  // JSON parse error (SyntaxError от express.json())
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return new AppError('Некорректный JSON в теле запроса', 400, 'BAD_REQUEST');
  }
  // JWT — уже обрабатывается в middleware/auth.js, но на всякий случай
  if (err.name === 'JsonWebTokenError') {
    return new AppError('Недействительный токен', 401, 'UNAUTHORIZED');
  }
  if (err.name === 'TokenExpiredError') {
    return new AppError('Токен истёк', 401, 'UNAUTHORIZED');
  }
  return err;
}

// ── Глобальный error-handler (4 аргумента) ───────────────────────────────────

function globalErrorHandler(err, req, res, next) {

  const status = err.status || 500;

  if (req.originalUrl.startsWith('/api')) {
    return res.status(status).json({
      error: err.message,
      code: err.code,
      status
    });
  }

  return res.redirect(
    `/error.html?code=${status}&message=${encodeURIComponent(err.message)}`
  );
}

// ── Простой request-logger ────────────────────────────────────────────────────

function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms     = Date.now() - start;
    const status = res.statusCode;
    const level  = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';
    const line   = `[${new Date().toISOString()}] ${level} ${req.method} ${req.originalUrl} ${status} ${ms}ms`;
    if (status >= 500) console.error(line);
    else if (status >= 400) console.warn(line);
    else console.log(line);
  });
  next();
}

module.exports = {
  AppError,
  createError,
  validate,
  asyncHandler,
  notFound,
  globalErrorHandler,
  requestLogger,
};