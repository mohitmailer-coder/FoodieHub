const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite'); // Node 22+ built-in, koi native build nahi chahiye

const db = new DatabaseSync(path.join(__dirname, 'foodiehub.db'));
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'placed',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items (
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  qty INTEGER NOT NULL
);
`);

// Menu server par fix hai — client se aaya price kabhi trust nahi karte.
const PRODUCTS = [
  { id: 1, name: 'Double Patty Burger', price_cents: 967, image: 'images/burger.png' },
  { id: 2, name: 'Veggie Pizza', price_cents: 1099, image: 'images/pizza.png' },
  { id: 3, name: 'Fried Chicken', price_cents: 1345, image: 'images/fried-chicken.png' },
  { id: 4, name: 'Cheese veg Grilled Sandwich', price_cents: 750, image: 'images/cheese-veg-grilled-sandwich.png' },
  { id: 5, name: 'Sub Sandwich', price_cents: 699, image: 'images/sandwich.png' },
  { id: 6, name: 'Tiramisu Cake Slice', price_cents: 945, image: 'images/tiramisu-cake-slice.png' },
  { id: 7, name: 'Italian Spaghetti', price_cents: 765, image: 'images/spaghetti.png' },
  { id: 8, name: 'Spring Roll', price_cents: 931, image: 'images/spring-roll.png' }
];
const productById = id => PRODUCTS.find(p => p.id === id);
const fmt = cents => '$' + (cents / 100).toFixed(2);

const app = express();
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

const authRequired = (req, res, next) =>
  req.session.userId ? next() : res.status(401).json({ error: 'Pehle sign in karein.' });

const publicUser = id => {
  const row = db.prepare('SELECT id,name,email FROM users WHERE id=?').get(id);
  return row ? { id: row.id, name: row.name, email: row.email } : null;
};

app.get('/api/products', (_req, res) => {
  res.json({ products: PRODUCTS.map(p => ({ ...p, price: fmt(p.price_cents) })) });
});

app.get('/api/me', (req, res) =>
  res.json({ user: req.session.userId ? publicUser(req.session.userId) : null }));

app.post('/api/register', (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (name.length < 2) return res.status(400).json({ error: 'Naam kam se kam 2 akshar ka ho.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Email sahi nahi lag raha.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password kam se kam 8 characters ka rakhein.' });
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email))
    return res.status(409).json({ error: 'Ye email pehle se registered hai. Sign in karein.' });

  const info = db.prepare('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)')
    .run(name, email, bcrypt.hashSync(password, 12));
  req.session.userId = Number(info.lastInsertRowid);
  res.json({ user: publicUser(req.session.userId) });
});

app.post('/api/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!row || !bcrypt.compareSync(String(req.body.password || ''), row.password_hash))
    return res.status(401).json({ error: 'Email ya password galat hai.' });
  req.session.userId = row.id;
  res.json({ user: publicUser(row.id) });
});

app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.post('/api/checkout', authRequired, (req, res) => {
  const { items = [], address = '', city = '', phone = '' } = req.body;
  if (address.trim().length < 6) return res.status(400).json({ error: 'Pura address likhein.' });
  if (!city.trim()) return res.status(400).json({ error: 'City daalein.' });
  if (!/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Phone number 10 digits ka daalein.' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Cart khali hai.' });

  const resolved = [];
  for (const it of items) {
    const p = productById(Number(it.id));
    const qty = Math.max(1, Math.min(20, Number(it.qty) || 0));
    if (!p) return res.status(400).json({ error: 'Menu me ek item nahi mila.' });
    resolved.push({ ...p, qty });
  }
  const total = resolved.reduce((s, i) => s + i.price_cents * i.qty, 0);

  db.exec('BEGIN');
  try {
    const orderId = Number(db.prepare(`INSERT INTO orders (user_id,total_cents,address,city,phone)
      VALUES (?,?,?,?,?)`).run(req.session.userId, total, address.trim(), city.trim(), phone).lastInsertRowid);
    const oi = db.prepare('INSERT INTO order_items (order_id,product_id,name,price_cents,qty) VALUES (?,?,?,?,?)');
    for (const i of resolved) oi.run(orderId, i.id, i.name, i.price_cents, i.qty);
    db.exec('COMMIT');
    res.json({ orderId, total: fmt(total) });
  } catch (e) {
    db.exec('ROLLBACK');
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/orders', authRequired, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC').all(req.session.userId);
  const q = db.prepare('SELECT name, price_cents, qty FROM order_items WHERE order_id=?');
  res.json({
    orders: orders.map(o => ({
      id: o.id, status: o.status, created_at: o.created_at,
      total: fmt(o.total_cents), address: o.address, city: o.city, phone: o.phone,
      items: q.all(o.id).map(i => ({ name: i.name, qty: i.qty, price: fmt(i.price_cents) }))
    }))
  });
});

app.listen(process.env.PORT || 3000, () =>
  console.log('http://localhost:' + (process.env.PORT || 3000)));
