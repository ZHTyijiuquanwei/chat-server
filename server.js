const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Brevo = require('@getbrevo/brevo');
const https = require('https');

const BREVO_API_KEY = "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";
const FROM_EMAIL = "horuschu0116@outlook.com";
const FROM_NAME = "ZHTの聊天室验证码";
const PORT = process.env.PORT || 3000;

const defaultClient = Brevo.ApiClient.instance;
const apiKeyAuth = defaultClient.authentications['api-key'];
apiKeyAuth.apiKey = BREVO_API_KEY;
const emailApi = new Brevo.TransactionalEmailsApi();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const codeStore = new Map();

function genCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

let siteUrl;
function keepAlive() {
    if(!siteUrl) return;
    https.get(siteUrl,()=>{
        console.log("✅保活访问成功");
    }).on('error',err=>{
        console.log("⚠️保活失败",err.message);
    })
}

app.post('/api/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ ok: false, msg: '请输入邮箱' });
  const code = genCode();
  codeStore.set(email, { code, time: Date.now() });

  const mail = new Brevo.SendSmtpEmail();
  mail.subject = "你的聊天室注册验证码";
  mail.htmlContent = `
    <div style="padding:20px;font-family:Arial;">
      <h2>注册验证码</h2>
      <p>你的验证码是：<b style="font-size:24px;color:#2563eb;">${code}</b></p>
      <p>10分钟内有效，请勿泄露给他人。</p>
    </div>
  `;
  mail.sender = { name: FROM_NAME, email: FROM_EMAIL };
  mail.to = [{ email }];

  try {
    await emailApi.sendTransacEmail(mail);
    res.json({ ok: true, msg: '验证码已发送' });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, msg: '发送失败，请稍后重试' });
  }
});

app.post('/api/register', (req, res) => {
  const { email, code, nickname } = req.body;
  if (!email || !code || !nickname)
    return res.json({ ok: false, msg: '信息不完整' });

  const record = codeStore.get(email);
  if (!record) return res.json({ ok: false, msg: '请先获取验证码' });
  if (Date.now() - record.time > 10 * 60 * 1000)
    return res.json({ ok: false, msg: '验证码已过期' });
  if (record.code !== code)
    return res.json({ ok: false, msg: '验证码错误' });

  codeStore.delete(email);
  res.json({ ok: true, msg: '注册成功', nickname });
});

app.get('/',(req,res)=>{
    res.send("ZHT聊天室后台运行中");
})

const server = app.listen(PORT, () => {
  console.log(`服务器启动,端口: ${PORT}`);
  siteUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
  setInterval(keepAlive, 480000);
  keepAlive();
});
