const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const SibApiV3Sdk = require('sib-api-v3-sdk');
const path = require("path");

const app = express();
// 创建http服务器（同时支持网页+WebSocket聊天）
const server = http.createServer(app);
//开启WebSocket聊天室
const wss = new WebSocket.Server({ server });

//====管理员账号设置====
const ADMIN_PASSWORD = "ZHT666888";
const ADMIN_SECRET_ANSWER = "小明";

const apiKey = process.env.BREVO_API_KEY;
const fromEmail = process.env.FROM_EMAIL;
const fromName = process.env.FROM_NAME;

let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKeyAuth = defaultClient.authentications['api-key'];
apiKeyAuth.apiKey = apiKey;

//托管html网页文件（index.html聊天室、管理员页面不会404）
app.use(express.static(__dirname));
app.use(express.json());

//主页自动跳转到聊天室
app.get('/', (req, res) => {
    res.redirect("/index.html");
});

//管理员登录接口
app.post('/admin-login', (req,res)=>{
    const {password,secretAnswer}=req.body;
    if(password===ADMIN_PASSWORD && secretAnswer===ADMIN_SECRET_ANSWER){
        res.json({success:true,token:"admin-ok-888",msg:"登录成功，获得管理员权限"});
    }else{
        res.json({success:false,msg:"密码或密保答案错误"});
    }
})

//发送验证码接口（保留原本邮件功能）
app.post('/send-code', async (req, res) => {
    try {
        const { toEmail, code } = req.body;
        if(!toEmail || !code){
            return res.json({ success: false, msg: "缺少邮箱或者验证码参数" });
        }
        let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
        let sendSmtpEmail = {
            sender: {name: fromName,email: fromEmail},
            to: [{email: toEmail}],
            subject: "你的验证码",
            htmlContent: `<p>你的验证码：<strong>${code}</strong></p>`
        };
        await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log("邮件发送成功");
        res.json({ success: true, msg: "验证码发送成功" });
    } catch (err) {
        console.error("邮件发送出错：", err);
        res.json({ success: false, msg: "发送失败", error: err.message });
    }
});

//=====多人聊天室WebSocket广播代码=====
//广播给所有在线人
function broadcast(msg){
    wss.clients.forEach(client=>{
        if(client.readyState===WebSocket.OPEN){
            client.send(JSON.stringify(msg));
        }
    })
}

wss.on('connection', (ws)=>{
    console.log("一位用户进入聊天室");
    //上线通知所有人
    broadcast({type:"system",text:"有新用户加入聊天室！"});

    ws.on('message',(raw)=>{
        try{
            let data=JSON.parse(raw);
            //把消息转发给全部在线人
            broadcast({
                type:"chat",
                username:data.name,
                text:data.msg,
                time:new Date().toLocaleTimeString()
            })
        }catch(e){
            console.log("消息解析失败");
        }
    })

    ws.on('close',()=>{
        console.log("一位用户离开聊天室");
        broadcast({type:"system",text:"一位用户离开了聊天室"});
    })
})

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀服务器启动成功`);
});
