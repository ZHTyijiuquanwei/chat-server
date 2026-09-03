const express = require('express');
const app = express();
const SibApiV3Sdk = require('sib-api-v3-sdk');

// 管理员账号配置（后端存，不会泄露！）
const ADMIN_PASSWORD = "ZHT权威";
const ADMIN_SECRET_ANSWER = "古古嘎嘎";

const apiKey = process.env.BREVO_API_KEY;
const fromEmail = process.env.FROM_EMAIL;
const fromName = process.env.FROM_NAME;

let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKeyAuth = defaultClient.authentications['api-key'];
apiKeyAuth.apiKey = apiKey;

app.use(express.json());

// 首页
app.get('/', (req, res) => {
    res.send("✅ 邮件验证码服务器运行正常");
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

//发送验证码接口
app.post('/send-code', async (req, res) => {
    try {
        const { toEmail, code } = req.body;

        if(!toEmail || !code){
            return res.json({ success: false, msg: "缺少邮箱或者验证码参数" });
        }

        let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

        let sendSmtpEmail = {
            sender: {
                name: fromName,
                email: fromEmail
            },
            to: [
                {
                    email: toEmail
                }
            ],
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 服务器已启动，正在监听端口：${PORT}`);
});
