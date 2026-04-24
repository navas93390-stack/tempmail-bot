process.on("uncaughtException",function(e){console.log(e.message);});
const express=require("express"),cors=require("cors"),fs=require("fs"),path=require("path"),Bot=require("node-telegram-bot-api");
const app=express();app.use(cors());app.use(express.json());
const DB=path.join(__dirname,"db.json"),DOM=process.env.DOMAIN||"tempgram.xyz",TTL=20,TOK=process.env.BOT_TOKEN,RURL=process.env.RENDER_URL||"https://tempmail-bot-3kew.onrender.com";
const bot=new Bot(TOK,{webHook:true});
bot.setWebHook(RURL+"/bot"+TOK).catch(function(e){console.log(e.message);});
function gdb(){try{return fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB,"utf8")):{users:{},emails:[]};}catch(e){return{users:{},emails:[]};}}
function sdb(d){try{fs.writeFileSync(DB,JSON.stringify(d));}catch(e){}}
app.post("/bot"+TOK,function(q,r){bot.processUpdate(q.body);r.sendStatus(200);});
bot.onText(/\/start/,function(m){const id=m.from.id.toString(),d=gdb();if(!d.users[id]){d.users[id]={email:id+"@"+DOM};sdb(d);}bot.sendMessage(m.chat.id,"Email: "+d.users[id].email,{reply_markup:{inline_keyboard:[[{text:"Ouvrir",web_app:{url:RURL+"/miniapp"}}]]}});});
app.get("/generate-email",function(q,r){const id=q.query.userId,d=gdb();if(!d.users[id]){d.users[id]={email:id+"@"+DOM};sdb(d);}r.json({email:d.users[id].email});});
app.get("/inbox",function(q,r){const id=q.query.userId,d=gdb();r.json({emails:(d.emails||[]).filter(function(e){return e.to===id+"@"+DOM&&e.expiresAt>Date.now();})});});
app.post("/receive-email",function(q,r){const d=gdb(),em={id:Date.now()+"",to:(q.body.to||"").toLowerCase(),from:q.body.from||"",subject:q.body.subject||"",body:q.body.body||"",date:Date.now(),expiresAt:Date.now()+TTL*60*1000};d.emails.push(em);sdb(d);r.json({success:true});});
app.delete("/email/:id",function(q,r){const d=gdb(),i=d.emails.findIndex(function(e){return e.id===q.params.id;});if(i>-1)d.emails.splice(i,1);sdb(d);r.json({success:true});});
app.get("/miniapp",function(q,r){r.sendFile(path.join(__dirname,"miniapp/index.html"));});
app.get("/",function(q,r){r.json({ok:true});});
app.listen(process.env.PORT||10000,function(){console.log("live");});

