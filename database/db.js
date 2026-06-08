const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'tautrails.db');

async function initDB() {
  const SQL = await initSqlJs();

  let db;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  function save() {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      avatar TEXT,
      is_banned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS trails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      difficulty TEXT DEFAULT 'moderate',
      length_km REAL,
      elevation_gain INTEGER,
      est_time_min INTEGER,
      trail_type TEXT DEFAULT 'out-and-back',
      surface_natural INTEGER DEFAULT 0,
      surface_unknown INTEGER DEFAULT 0,
      surface_steps INTEGER DEFAULT 0,
      region TEXT DEFAULT 'Алматы',
      latitude REAL,
      longitude REAL,
      rating REAL DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      activity_count INTEGER DEFAULT 0,
      cover_image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS trail_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trail_id INTEGER,
      image_path TEXT
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trail_id INTEGER,
      user_id INTEGER,
      author_name TEXT NOT NULL,
      rating INTEGER,
      comment TEXT,
      sticker TEXT,
      is_hidden INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  function run(sql, params = []) {
    db.run(sql, params);
    save();
  }

  function get(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  function all(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  function lastInsertId() {
    return get('SELECT last_insert_rowid() as id').id;
  }

  // Создаём админа
  const admin = get('SELECT id FROM users WHERE username = ?', ['admin']);
  if (!admin) {
    const hash = bcrypt.hashSync('admin123', 10);
    run('INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)', ['admin', 'admin@tautrails.kz', hash, 'admin']);
    console.log('✅ Админ создан: admin / admin123');
  }

  // Добавляем колонки если их нет (миграция)
  try { db.run('ALTER TABLE users ADD COLUMN email TEXT'); save(); } catch(e) {}
  try { db.run('ALTER TABLE users ADD COLUMN avatar TEXT'); save(); } catch(e) {}
  try { db.run('ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0'); save(); } catch(e) {}
  try { db.run('ALTER TABLE reviews ADD COLUMN sticker TEXT'); save(); } catch(e) {}
  try { db.run('ALTER TABLE reviews ADD COLUMN is_hidden INTEGER DEFAULT 0'); save(); } catch(e) {}
  try { db.run('ALTER TABLE reviews ADD COLUMN user_id INTEGER'); save(); } catch(e) {}

  // Тестовые маршруты
  const count = get('SELECT COUNT(*) as c FROM trails');
  if (!count || count.c === 0) {
    const trails = [
      ['Терра Филд — Водопад Девичьи Слёзы', 'Маршрут проходит через ароматный лес из тянь-шаньских елей. Примерно на полпути вы достигнете водопада Девичьи Слёзы — красивого нежного каскада.', 'hard', 10.9, 892, 330, 'out-and-back', 96, 3, 1, 'Алма-Арасан, Алматы', 43.1127, 76.8887, 4.6, 65, 134],
      ['Петля вокруг озера Сайран', 'Лёгкая прогулочная петля вокруг живописного озера Сайран в черте города.', 'easy', 4, 30, 63, 'loop', 80, 15, 5, 'Алматы', 43.2230, 76.8513, 4.1, 4, 12],
      ['Большое Алматинское Озеро', 'Тропа ведёт через сосновый лес к высокогорному озеру на высоте 2511 м. Великолепные виды на заснеженные пики.', 'moderate', 14, 600, 240, 'out-and-back', 90, 5, 5, 'Большое Алматинское ущелье', 43.0568, 76.9868, 4.8, 120, 350],
      ['Пик Фурманова', 'Маршрут из Медеу к пику Фурманова (3073 м). Крутой подъём с потрясающими видами на город и горы.', 'hard', 12, 1200, 300, 'out-and-back', 85, 10, 5, 'Медеу, Алматы', 43.1469, 77.0178, 4.7, 89, 210],
      ['Каньон Чарын — Долина Замков', 'Маршрут по уникальному Чарынскому каньону. Красные скалы высотой до 150 м создают атмосферу другой планеты.', 'easy', 3, 100, 90, 'loop', 95, 5, 0, 'Чарынский каньон', 43.3522, 79.0797, 4.9, 203, 580],
    ];
    for (const t of trails) {
      run(`INSERT INTO trails (name,description,difficulty,length_km,elevation_gain,est_time_min,trail_type,surface_natural,surface_unknown,surface_steps,region,latitude,longitude,rating,review_count,activity_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, t);
    }
    console.log('✅ Тестовые маршруты добавлены');
  }

  save();
  console.log('✅ База данных готова');

  return { run, get, all, lastInsertId, save };
}

module.exports = initDB;