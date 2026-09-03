const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('./'));

// 从Render环境变量读取，不要把密码写进代码
const DATABASE_URL = process.env.DATABASE_URL;

if(!DATABASE_URL){
    console.error("❌ 找不到 DATABASE_URL 环境变量！请到Render后台添加");
    process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB(){
    await pool.query(`
    CREATE TABLE IF NOT EXISTS users(
        id SERIAL PRIMARY KEY,
        zhtid TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        nickname TEXT,
        avatar TEXT
    );
    CREATE TABLE IF NOT EXISTS friends(
        id SERIAL PRIMARY KEY,
        user1 TEXT,
        user2 TEXT
    );
    `);
    console.log("✅数据库表初始化完成");
}
initDB();

async function createNewZhtId(){
    const res = await pool.query('SELECT COUNT(*) FROM users');
    const num = parseInt(res.rows[0].count)+10001;
    return "ZHT‑"+num;
}

//注册接口
app.post('/api/register',async(req,res)=>{
    try{
        const {email,password,nickname} = req.body;
        const hashPass = await bcrypt.hash(password,10);
        const newZht = await createNewZhtId();
        await pool.query(`INSERT INTO users(zhtid,email,password,nickname) VALUES($1,$2,$3,$4)`,[newZht,email,hashPass,nickname]);
        res.json({success:true,zhtid:newZht});
    }catch(e){
        res.json({success:false,msg:"邮箱已经被注册"});
    }
});

//登录接口
app.post('/api/login',async(req,res)=>{
    const {email,password}=req.body;
    const result = await pool.query('SELECT * FROM users WHERE email=$1',[email]);
    if(result.rows.length===0) return res.json({success:false,msg:"账号不存在"});
    const user = result.rows[0];
    const ok = await bcrypt.compare(password,user.password);
    if(!ok) return res.json({success:false,msg:"密码错误"});
    res.json({success:true,user:{zhtid:user.zhtid,email:user.email,nickname:user.nickname,avatar:user.avatar}});
});

//管理员获取全部用户列表
app.get('/api/admin/userlist',async(req,res)=>{
    const all = await pool.query('SELECT * FROM users');
    res.json(all.rows);
});

//管理员编辑ZHT‑ID
app.post('/api/admin/setzhtid',async(req,res)=>{
    const {oldZht,newZht}=req.body;
    try{
        await pool.query('UPDATE users SET zhtid=$1 WHERE zhtid=$2',[newZht,oldZht]);
        res.json({success:true});
    }catch(e){
        res.json({success:false,msg:"ZHT‑ID重复，修改失败"});
    }
});

const server = http.createServer(app);
const wss = new WebSocket.Server({server});
wss.on('connection',(ws)=>{
    ws.on('message',(raw)=>{
        wss.clients.forEach(client=>{
            if(client.readyState === WebSocket.OPEN){
                client.send(raw);
            }
        })
    })
})

const PORT = process.env.PORT || 3000;
server.listen(PORT,()=>{
    console.log("🚀聊天室+数据库后端启动成功");
});
