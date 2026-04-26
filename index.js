process.on("uncaughtException",function(e){console.log(e.message);});
const express=require("express"),cors=require("cors"),fs=require("fs"),path=require("path"),Bot=require("node-telegram-bot-api");
const app=express();app.use(cors());app.use(express.json());
const DB=path.join(__dirname,"db.json"),DOM=process.env.DOMAIN||"tempgram.xyz",TTL=20,TOK=process.env.BOT_TOKEN,RURL=(process.env.RENDER_URL||"https://tempmail-bot-3kew.onrender.com").replace(//+$/,"");
const bot=new Bot(TOK,{webHook:true});
bot.setWebHook(RURL+"/bot"+TOK).catch(function(e){console.log(e.message);});
function gdb(){try{return fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB,"utf8")):{users:{},emails:[]};}catch(e){return{users:{},emails:[]};}}
function sdb(d){try{fs.writeFileSync(DB,JSON.stringify(d));}catch(e){}}
app.post("/bot"+TOK,function(q,r){bot.processUpdate(q.body);r.sendStatus(200);});
bot.onText(//start/,function(m){const id=m.from.id.toString(),d=gdb();const email=d.users[id]?d.users[id].email:"non defini";bot.sendMessage(m.chat.id,"Bienvenue !\n\nEmail: "+email,{reply_markup:{inline_keyboard:[[{text:"Ouvrir ma boite mail",web_app:{url:RURL+"/miniapp"}}]]}});});
app.get("/generate-email",function(q,r){const id=q.query.userId,d=gdb();if(!id)return r.status(400).json({error:"userId requis"});r.json({email:d.users[id]?d.users[id].email:null,hasEmail:!!d.users[id]});});
app.post("/set-email",function(q,r){const id=q.body.userId,name=q.body.name;if(!id||!name)return r.status(400).json({error:"userId et name requis"});if(!/^[a-z0-9._-]{3,30}$/.test(name))return r.status(400).json({error:"Nom invalide. Lettres minuscules, chiffres, tirets uniquement (3-30 caracteres)"});const d=gdb();if(d.users[id])return r.status(400).json({error:"Email deja defini"});const taken=Object.values(d.users).some(function(u){return u.email===name+"@"+DOM;});if(taken)return r.status(400).json({error:"Ce nom est deja pris"});d.users[id]={email:name+"@"+DOM};sdb(d);r.json({email:d.users[id].email});});
app.get("/inbox",function(q,r){const id=q.query.userId,d=gdb();if(!d.users[id])return r.json({emails:[]});const userEmail=d.users[id].email;r.json({emails:(d.emails||[]).filter(function(e){return e.to===userEmail&&e.expiresAt>Date.now();}).sort(function(a,b){return b.date-a.date;}).slice(0,50)});});
app.post("/receive-email",function(q,r){const d=gdb(),em={id:Date.now()+"-"+Math.random().toString(36).slice(2),to:(q.body.to||"").toLowerCase(),from:q.body.from||"",subject:q.body.subject||"",body:q.body.body||"",date:Date.now(),expiresAt:Date.now()+TTL*60*1000};d.emails.push(em);sdb(d);const userId=Object.keys(d.users).find(function(k){return d.users[k].email===em.to;});if(userId){bot.sendMessage(userId,"Nouvel email de "+em.from+" : "+em.subject).catch(function(){});}r.json({success:true});});
app.delete("/email/:id",function(q,r){const d=gdb(),i=d.emails.findIndex(function(e){return e.id===q.params.id;});if(i>-1)d.emails.splice(i,1);sdb(d);r.json({success:true});});
app.get("/miniapp",function(q,r){r.sendFile(path.join(__dirname,"miniapp/index.html"));});
app.get("/",function(q,r){r.json({ok:true});});
app.listen(process.env.PORT||10000,function(){console.log("live");});