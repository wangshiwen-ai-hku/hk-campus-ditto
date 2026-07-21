# 网易企业邮箱 SMTP 接入

本项目已经支持 `EMAIL_PROVIDER=smtp`。验证码和匹配通知共用这个发送器。

## 1. 选择企业邮箱

使用网易企业邮箱并绑定 `dopa.aurahk.me`，创建邮箱账号
`hi@dopa.aurahk.me`。不要用普通 `@163.com` 账号冒充这个发件地址；SMTP
登录账号、`EMAIL_FROM` 和实际邮箱应保持一致。

入口：<https://qiye.163.com/>

## 2. 配置域名 DNS

在网易管理后台添加邮件域 `dopa.aurahk.me`，然后到当前 DNS 服务商
（此域名现在使用 Namecheap DNS）添加后台给出的域名验证、MX、SPF 和 DKIM
记录。以网易后台当时显示的记录值为准，不要从旧教程复制。

注意：

- `dopa.aurahk.me` 在 2026-06-22 查询时没有 MX/TXT 记录，可以直接配置。
- 只修改 `dopa` 子域的邮件记录，不要删除根域 `aurahk.me` 或 `www` 的网站记录。
- 同一个主机名只能有一条以 `v=spf1` 开头的 SPF TXT；如已有记录要合并，不能新增第二条。
- 在网易后台启用 DKIM（如果套餐提供），验证通过后再上线。
- 可先给 `_dmarc.dopa.aurahk.me` 添加监控策略：
  `v=DMARC1; p=none; rua=mailto:hi@dopa.aurahk.me; adkim=r; aspf=r`。
  确认 SPF/DKIM 对齐后，再逐步改为 `quarantine` 或 `reject`。

DNS 生效后，必须等网易管理后台显示域名验证、MX 等状态正常。

## 3. 创建发件账号并开启 SMTP

创建 `hi@dopa.aurahk.me`，在邮箱或管理员安全设置中开启 SMTP/客户端服务。
如果后台提供“客户端授权密码”，`SMTP_PASSWORD` 应使用授权密码，而不是网页登录
密码。记录网易后台显示的 SMTP 主机、SSL 端口和加密方式。

常见配置如下，但应以你的网易后台为准：

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.qiye.163.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=hi@dopa.aurahk.me
SMTP_PASSWORD=客户端授权密码或邮箱密码
EMAIL_FROM="DopaMine <hi@dopa.aurahk.me>"
EMAIL_REPLY_TO="hi@dopa.aurahk.me"
```

如果网易后台给的是 STARTTLS/587，改为 `SMTP_PORT=587` 和
`SMTP_SECURE=false`；如果给的是 SSL/994，使用 `SMTP_PORT=994` 和
`SMTP_SECURE=true`。

## 4. 本地测试

把上述变量写入 `backend/.env`，不要提交密码。启动后端，然后用一个真实、受支持的
学校邮箱请求验证码：

```bash
cd backend
npm run build
npm run dev
```

```bash
curl -X POST http://localhost:8787/api/auth/request-code \
  -H 'Content-Type: application/json' \
  -d '{"email":"你的学校邮箱"}'
```

成功时后端日志包含 `[email:smtp]` 和 `messageId`。认证失败通常是客户端服务未开启、
密码类型错误，或 SMTP 登录账号不是完整邮箱地址。

## 5. 配置 Fly.io

在 Fly.io 的 `thrumming-island-597` 应用中添加以下 Secrets；密码不要写入
`fly.toml`：

```text
EMAIL_PROVIDER=smtp
SMTP_HOST=网易后台显示的主机
SMTP_PORT=网易后台显示的端口
SMTP_SECURE=true 或 false
SMTP_USER=hi@dopa.aurahk.me
SMTP_PASSWORD=客户端授权密码或邮箱密码
```

`EMAIL_FROM` 和 `EMAIL_REPLY_TO` 已在 `backend/fly.toml` 中配置。部署后检查：

```bash
flyctl deploy --config backend/fly.toml
flyctl logs --app thrumming-island-597
```

再从正式网页请求一次验证码，并分别检查学校邮箱的收件箱和垃圾箱。

## 6. 送达率验收

更换 SMTP 服务不能保证邮件一定不进垃圾箱。上线前至少确认：

- 邮件原始头中 SPF、DKIM、DMARC 都是 `PASS`。
- `From` 始终是 `hi@dopa.aurahk.me`，不要频繁换域名或显示名。
- 验证码邮件保持纯事务型，不加入营销文案、短链或附件。
- 先低量发送并观察退信；不要反复给不存在或持续退信的地址发送。
- 用 Gmail、Outlook 和目标香港高校邮箱分别实测，而不是只测一个收件箱。
