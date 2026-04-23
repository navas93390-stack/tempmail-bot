const express = require(“express”);
const cors = require(“cors”);
const fs = require(“fs”);
const path = require(“path”);
const TelegramBot = require(“node-telegram-bot-api”);

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, “db.json”);
const DOMAIN = process.env.DOMAIN || “tempgram.xyz”;
const EMAIL_TTL = parseInt(process.env.EMAIL_TTL_MINUTES || “20”);
const BOT_TOKEN = process.env.BOT_TOKEN;
const RENDER_URL = process.env.RENDER_URL || “https://tempmail-bot-3kew.onrender.com”;
const MINI_APP_URL = RENDER_URL + “/miniapp”;

const bot = new TelegramBot(BOT_TOKEN, { webHook: true });
bot.setWebHook(RENDER_URL + “/bot” + BOT_TOKEN);

app.post(”/bot” + BOT_TOKEN, function(req, res) {
bot.processUpdate(req.body);
res.sendStatus(200);
});

function loadDB() {
if (!fs.existsSync(DB_PATH)) return { users: {}, emails: [] };
try { return JSON.parse(fs.readFileSync(DB_PATH, “utf8”)); }
catch(e) { return { users: {}, emails: [] }; }
}

function saveDB(db) {
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

bot.onText(//start/, function(msg) {
const userId = msg.from.id.toString();
const db = loadDB();
if (!db.users[userId]) {
db.users[userId] = { email: userId + “@” + DOMAIN, createdAt: Date.now() };
saveDB(db);
}
bot.sendMessage(msg.chat.id,
“📬 *Bienvenue !*\n\nTon adresse email temporaire :\n`" + db.users[userId].email + "`\n\nClique pour ouvrir ta boite mail 👇”,
{
parse_mode: “Markdown”,
reply_markup: {
inline_keyboard: [[{ text: “📧 Ouvrir ma boite mail”, web_app: { url: MINI_APP_URL } }]]
}
}
);
});

bot.onText(//email/, function(msg) {
const userId = msg.from.id.toString();
const db = loadDB();
if (!db.users[userId]) {
db.users[userId] = { email: userId + “@” + DOMAIN, createdAt: Date.now() };
saveDB(db);
}
bot.sendMessage(msg.chat.id, “📧 Ton adresse :\n`" + db.users[userId].email + "`”, { parse_mode: “Markdown” });
});

app.get(”/generate-email”, function(req, res) {
const userId = req.query.userId;
if (!userId) return res.status(400).json({ error: “userId requis” });
const db = loadDB();
if (!db.users[userId]) {
db.users[userId] = { email: userId + “@” + DOMAIN, createdAt: Date.now() };
saveDB(db);
}
res.json({ email: db.users[userId].email });
});

app.get(”/inbox”, function(req, res) {
const userId = req.query.userId;
if (!userId) return res.status(400).json({ error: “userId requis” });
const db = loadDB();
const userEmail = userId + “@” + DOMAIN;
const inbox = db.emails
.filter(function(e) { return e.to === userEmail && e.expiresAt > Date.now(); })
.sort(function(a, b) { return b.date - a.date; })
.slice(0, 50);
res.json({ emails: inbox });
});

app.post(”/receive-email”, function(req, res) {
const to = req.body.to;
const from = req.body.from;
const subject = req.body.subject;
const body = req.body.body;
const html = req.body.html;
const date = req.body.date;
if (!to || !from) return res.status(400).json({ error: “Champs manquants” });
const db = loadDB();
const email = {
id: Date.now() + “-” + Math.random().toString(36).slice(2),
to: to.toLowerCase(),
from: from,
subject: (subject || “(sans objet)”).substring(0, 200),
body: (body || “”).substring(0, 10000),
html: (html || “”).substring(0, 20000),
date: date || Date.now(),
expiresAt: Date.now() + EMAIL_TTL * 60 * 1000
};
db.emails.push(email);
saveDB(db);
const userId = to.split(”@”)[0];
if (db.users[userId]) {
bot.sendMessage(userId,
“📨 *Nouvel email !*\n\nDe : “ + from + “\nObjet : “ + (subject || “(sans objet)”),
{ parse_mode: “Markdown” }
).catch(function() {});
}
res.json({ success: true });
});

app.delete(”/email/:id”, function(req, res) {
const userId = req.query.userId;
if (!userId) return res.status(400).json({ error: “userId requis” });
const db = loadDB();
const idx = db.emails.findIndex(function(e) { return e.id === req.params.id && e.to.startsWith(userId); });
if (idx === -1) return res.status(404).json({ error: “Email non trouve” });
db.emails.splice(idx, 1);
saveDB(db);
res.json({ success: true });
});

app.get(”/miniapp”, function(req, res) {
res.sendFile(path.join(__dirname, “miniapp/index.html”));
});

app.get(”/”, function(req, res) {
res.json({ status: “ok”, service: “TempGram Mail” });
});

setInterval(function() {
const db = loadDB();
const before = db.emails.length;
db.emails = db.emails.filter(function(e) { return e.expiresAt > Date.now(); });
if (db.emails.length !== before) saveDB(db);
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 10000;
app.listen(PORT, function() {
console.log(“Serveur demarre sur le port “ + PORT);
console.log(“Domaine : “ + DOMAIN);
});
