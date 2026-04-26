# 校园 Ditto 500人内测部署与发版测试报告 (Beta Launch Report)

基于 CTO 提供的 `launch-readiness.md` 要求，已于 2026年4月 顺利完成后端从本地单机架构向云端敏捷高可用架构的完整演进与集成测试验证。

## 1. 交付清单响应记录 (Validation Response)

- **应用编译验证 (Build Validation)**：✅ 通过。执行 `npm run build`，前后端均无语法错误，打包顺利落地。
- **业务逻辑验证 (Logic Test)**：✅ 通过。执行 `npm run test:backend`，基于模拟环境后端闭环测试 100% 绿灯。
- **环境闭环验证 (End-to-End Smoke Test)**：✅ 通过。执行 `npm run smoke:backend`，成功跑通六人一配对、全场景邮件发送、时区流转等核心流程。
- **数据库切换与迁移 (Database Ejection)**：✅ 已打通。通过抛弃不稳定的 IPv6 直连，全面切入 Supabase 提供的 IPv4 Pooler (端对端连接池模式)，并完美引入 `prod-ca-2021.crt` 静态强证书配置彻底铲除自签证书链路攻击风险。`db.json` 数据以 JSONB 模式上云，保持最高迭代敏捷性。
- **运营号段生成 (Invites Pipeline)**：✅ 已打通。统一了环境变量（ADMIN_SECRET），清空隐式默认密码策略，实现一键极速分校创建内测邀请码 CSV。

---

## 2. 新开发者全流程部署与校验指南 (Developer Onboarding)

如果新的后端同学加入了本套全流程体系，只需按照以下 4 步即可无缝拉起具有 Postgres 云端通信和邮件控制台截流能力的本地沙盒环境。

### Step 1: 环境依赖与秘钥对齐
确保你的 `backend/` 目录下有以下两样核心文件：
1. **真实 Supabase 根证书**：`prod-ca-2021.crt`（保证你能无视 Node 的严格 TLS 限制穿透内网直连 Supabase）。
2. **最新版环境变量配置**：确保包含 `DB_PROVIDER=postgres` 和完整的带连接池架构的 `DATABASE_URL`，以及与前后端对接暗号一致的管理员秘钥：
   ```env
   # backend/.env
   DB_PROVIDER=postgres
   DATABASE_URL=postgresql://postgres.xxx:[PASSWORD]@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true
   ADMIN_SECRET=dev-secret-change-me
   ```

### Step 2: 数据库极速灌装拉齐
新开发者拿到仓库后，本地不存在上游云端状态。直接运行：
```bash
npm --prefix backend run seed
```
若提示 `Seeded 6 students...` 且无证书报错，证明你的 Postgres 隧道已经搭建成功且畅通。

### Step 3: 后台降级监听节点唤醒
为了能够本地即时生成邀请码并在黑框中截取本应发往真实邮箱的测试邮件，必须带参数启动：
```bash
LLM_PROVIDER=mock EMAIL_PROVIDER=console npm --prefix backend run dev
```

### Step 4: 测试发号并跑通前台
开启全新终端，极速生产内测码：
```bash
npm run invites:generate -- --adminSecret="dev-secret-change-me" --plan=hku=10,cuhk=10 --batch=local-test
```
切换到含有前端代码的路径运行 `npm --prefix frontend run dev` ，在 `http://localhost:5173` 内验证刚刚生成的邀请码是否能注册到底即可。
