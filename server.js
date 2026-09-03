const express = require('express');
const app = express();
const SibApiV3Sdk = require('sib-api-v3-sdk');

// 读取Render上面设置好的三个环境变量
const apiKey = process.env.BREVO_API_KEY;
const fromEmail = process.env.FROM_EMAIL;
const fromName = process.env.FROM_NAME;

let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKeyAuth = defaultClient.authentications['api-key'];
apiKeyAuth.apiKey = apiKey;

app.use(express.json());

// 测试主页
app.get('/', (req, res) => {
    res.send("✅ 邮件验证码服务器运行正常");
});

// 发送验证码接口
app.post('/send-code', async (req, res) => {
    try {
        const { toEmail, code } = req.body;
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
        res.json({ success: true, msg: "验证码发送成功" });
    } catch (err) {
        console.error(err);
        res.json({ success: false, msg: "发送失败", error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 服务器已启动，端口：${PORT}`);
});
