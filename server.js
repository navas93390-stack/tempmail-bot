const express = require(‘express’);
const cors = require(‘cors’);
const fs = require(‘fs’);
const path = require(‘path’);
const TelegramBot = require(‘node-telegram-bot-api’);

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, ‘db.json’);
const DOMAIN = process.env.DOMAIN || ‘tondomaine.com’;
const EMAIL_TTL_MINUTES = parseInt(process.env.EMAIL_TTL_MINUTES || ‘20’);
const BOT_TOKEN = process.env.BOT_TOKEN;
const RENDER_URL = process.env.RENDER_URL || ‘https://tempmail-bot-3kew.onrender.com’;
const MINI_APP_URL = `${RENDER_URL}/miniapp`;

// WEBHOOK — pas de polling, évite l’erreur 409
const bot = new TelegramBot(BOT_TOKEN, { webHook: true });
bot.setWebHook(`${RENDER_URL}/bot${BOT_TOKEN}`);

app.post(`/bot${BOT_TOKEN}`, (req, res) => {
bot.processUpdate(req.body);
res.sendStatus(200);
});

function loadDB() {
if (!fs.existsSync(DB_PATH)) return { users: {}, emails: [] };
try { return JSON.parse(fs.readFileSync(DB_PATH, ‘utf8’)); }
catch { return { users: {}, emails: [] }; }
}

function saveDB(db) {
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

bot.onText(//start/, (msg) => {
const userId = msg.from.id.toString();
const db = loadDB();
if (!db.users[userId]) {
db.users[userId] = { email: `${userId}@${DOMAIN}`, createdAt: Date.now() };
saveDB(db);
}
bot.sendMessage(msg.chat.id,
`📬 *Bienvenue !*\n\nTon adresse email temporaire :\n\`${db.users[userId].email}`\n\nClique pour ouvrir ta boite mail 👇`,
{
parse_mode: ‘Markdown’,
reply_markup: {
inline_keyboard: [[{ text: ‘📧 Ouvrir ma boite mail’, web_app: { url: MINI_APP_URL } }]]
}
}
);
});

bot.onText(//email/, (msg) => {
const userId = msg.from.id.toString();
const db = loadDB();
if (!db.users[userId]) {
db.users[userId] = { email: `${userId}@${DOMAIN}`, createdAt: Date.now() };
saveDB(db);
}
bot.sendMessage(msg.chat.id, `📧 Ton adresse :\n\`${db.users[userId].email}``, { parse_mode: ‘Markdown’ });
});

app.get(’/generate-email’, (req, res) => {
const { userId } = req.query;
if (!userId) return res.status(400).json({ error: ‘userId requis’ });
const db = loadDB();
if (!db.users[userId]) {
db.users[userId] = { email: `${userId}@${DOMAIN}`, createdAt: Date.now() };
saveDB(db);
}
res.json({ email: db.users[userId].email });
});

app.get(’/inbox’, (req, res) => {
const { userId } = req.query;
if (!userId) return res.status(400).json({ error: ‘userId requis’ });
const db = loadDB();
const userEmail = `${userId}@${DOMAIN}`;
const inbox = db.emails
.filter(e => e.to === userEmail && e.expiresAt > Date.now())
.sort((a, b) => b.date - a.date)
.slice(0, 50);
res.json({ emails: inbox });
});

app.post(’/receive-email’, (req, res) => {
const { to, from, subject, body, html, date } = req.body;
if (!to || !from) return res.status(400).json({ error: ‘Champs manquants’ });
const db = loadDB();
const email = {
id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
to: to.toLowerCase(),
from,
subject: (subject || ‘(sans objet)’).substring(0, 200),
body: (body || ‘’).substring(0, 10000),
html: (html || ‘’).substring(0, 20000),
date: date || Date.now(),
expiresAt: Date.now() + EMAIL_TTL_MINUTES * 60 * 1000,
};
db.emails.push(email);
saveDB(db);
const userId = to.split(’@’)[0];
if (db.users[userId]) {
bot.sendMessage(userId,
`📨 *Nouvel email !*\n\nDe : ${from}\nObjet : ${subject || '(sans objet)'}`,
{ parse_mode: ‘Markdown’ }
).catch(() => {});
}
res.json({ success: true });
});

app.delete(’/email/:id’, (req, res) => {
const { userId } = req.query;
if (!userId) return res.status(400).json({ error: ‘userId requis’ });
const db = loadDB();
const idx = db.emails.findIndex(e => e.id === req.params.id && e.to.startsWith(userId));
if (idx === -1) return res.status(404).json({ error: ‘Email non trouve’ });
db.emails.splice(idx, 1);
saveDB(db);
res.json({ success: true });
});

app.get(’/miniapp’, (req, res) => {
res.sendFile(path.join(__dirname, ‘miniapp/index.html’));
});

app.get(’/’, (req, res) => res.json({ status: ‘ok’, service: ‘TempMail Bot’ }));

setInterval(() => {
const db = loadDB();
const before = db.emails.length;
db.emails = db.emails.filter(e => e.expiresAt > Date.now());
if (db.emails.length !== before) saveDB(db);
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
console.log(`✅ Serveur demarre sur le port ${PORT}`);
console.log(`📧 Domaine : ${DOMAIN}`);
console.log(`🤖 Webhook actif`);
});
