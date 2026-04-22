const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, 'db.json');
const DOMAIN = process.env.DOMAIN || 'tondomaine.com';
const EMAIL_TTL_MINUTES = parseInt(process.env.EMAIL_TTL_MINUTES || '20');

// ─── DB helpers ───────────────────────────────────────────────────────────────

function loadDB() {
  if (!fs.existsSync(DB_PATH)) return { users: {}, emails: [] };
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /generate-email?userId=123456789
app.get('/generate-email', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId requis' });

  const db = loadDB();

  if (!db.users[userId]) {
    db.users[userId] = {
      email: `${userId}@${DOMAIN}`,
      createdAt: Date.now(),
    };
    saveDB(db);
  }

  res.json({ email: db.users[userId].email });
});

// GET /inbox?userId=123456789
app.get('/inbox', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId requis' });

  const db = loadDB();
  const userEmail = `${userId}@${DOMAIN}`;

  const inbox = db.emails
    .filter(e => e.to === userEmail)
    .sort((a, b) => b.date - a.date)
    .slice(0, 50);

  res.json({ emails: inbox });
});

// POST /receive-email  (appelé par le mail parser)
app.post('/receive-email', (req, res) => {
  const { to, from, subject, body, html, date } = req.body;
  if (!to || !from) return res.status(400).json({ error: 'Champs manquants' });

  const db = loadDB();

  const email = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    to: to.toLowerCase(),
    from,
    subject: (subject || '(sans objet)').substring(0, 200),
    body: (body || '').substring(0, 10000),
    html: (html || '').substring(0, 20000),
    date: date || Date.now(),
    expiresAt: Date.now() + EMAIL_TTL_MINUTES * 60 * 1000,
  };

  db.emails.push(email);
  saveDB(db);

  res.json({ success: true, id: email.id });
});

// DELETE /cleanup
app.delete('/cleanup', (req, res) => {
  const db = loadDB();
  const before = db.emails.length;
  db.emails = db.emails.filter(e => e.expiresAt > Date.now());
  saveDB(db);
  res.json({ deleted: before - db.emails.length, remaining: db.emails.length });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend TempMail démarré sur le port ${PORT}`);
  console.log(`📧 Domaine : ${DOMAIN}`);
  console.log(`⏳ TTL emails : ${EMAIL_TTL_MINUTES} minutes`);
});
