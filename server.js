const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('./'));

const DATABASE_URL = process.env.DATABASE_URL;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

if (!DATABASE_URL) {
    console.error("❌ 找不到 DATABASE_URL 环境变量！请到Render后台添加");
    process.exit(1);
}
if (!BREVO_API_KEY) {
    console.error("❌ 找不到 BREVO_API_KEY 环境变量");
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function initDB() {
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
    CREATE TABLE IF NOT EXISTS email_code(
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE,
        code TEXT,
        expire_time BIGINT
    );
    `);
    console.log("✅数据库表初始化完成");
}
initDB();

// ZHT‑1、ZHT‑2，从1开始编号
async function createNewZhtId() {
    const res = await pool.query('SELECT COUNT(*) FROM users');
    const num = parseInt(res.rows[0].count) + 1;
    return "ZHT‑" + num;
}

// 发送验证码 Brevo接口
app.post('/api/sendcode', async (req, res) => {
    try {
        const { email } = req.body;
        const code = String(Math.floor(Math.random() * 900000 + 100000));
        const expire = Date.now() + 5 * 60 * 1000;

        await pool.query(`INSERT INTO email_code(email,code,expire_time) 
        VALUES($1,$2,$3) 
        ON CONFLICT(email) DO UPDATE SET code=$2,expire_time=$3`,
            [email, code, expire]);

        // ==========这里！！把引号内邮箱换成你Brevo验证过的发件邮箱==========
        await axios.post("https://api.brevo.com/v3/smtp/email", {
            sender: { name: "ZHT聊天室", email: "你的验证邮箱@xxx.com" },
            to: [{ email: email }],
            subject: "ZHT聊天室注册验证码",
            htmlContent: `<p>你的注册验证码：<strong>${code}</strong></p><p>5分钟内有效</p>`
        }, {
            headers: {
                "api-key": BREVO_API_KEY,
                "Content-Type": "application/json"
            }
        })

        res.json({ success: true, msg: "验证码已发送，请查收邮箱" });
    } catch (e) {
        console.log("邮件发送错误", e.response?.data || e.message);
        res.json({ success: false, msg: "邮件发送失败" });
    }
})

//注册接口 验证码校验
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, nickname, code } = req.body;
        const now = Date.now();
        const result = await pool.query("SELECT * FROM email_code WHERE email=$1", [email]);

        if (result.rows.length === 0)
            return res.json({ success: false, msg: "请先获取验证码" });

        const record = result.rows[0];
        if (record.code !== code || record.expire_time < now) {
            return res.json({ success: false, msg: "验证码错误或已过期" });
        }

        const hashPass = await bcrypt.hash(password, 10);
        const newZht = await createNewZhtId();

        await pool.query(`INSERT INTO users(zhtid,email,password,nickname) VALUES($1,$2,$3,$4)`,
            [newZht, email, hashPass, nickname]);

        await pool.query(`DELETE FROM email_code WHERE email=$1`, [email]);
        res.json({ success: true, zhtid: newZht });

    } catch (e) {
        res.json({ success: false, msg: "邮箱已经被注册" });
    }
});

//登录
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (result.rows.length === 0)
        return res.json({ success: false, msg: "账号不存在" });

    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.json({ success: false, msg: "密码错误" });

    res.json({ success: true, user: { zhtid: user.zhtid, email: user.email, nickname: user.nickname, avatar: user.avatar } });
});

//获取用户列表
app.get('/api/admin/userlist', async (req, res) => {
    const all = await pool.query('SELECT * FROM users');
    res.json(all.rows);
});

//修改ID
app.post('/api/admin/setzhtid', async (req, res) => {
    const { oldZht, newZht } = req.body;
    try {
        await pool.query('UPDATE users SET zhtid=$1 WHERE zhtid=$2', [newZht, oldZht]);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, msg: "ZHT‑ID重复，修改失败" });
    }
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(raw);
            }
        })
    })
})

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("🚀聊天室+数据库后端启动成功");
});
