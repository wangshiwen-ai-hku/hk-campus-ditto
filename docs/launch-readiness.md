# Campus Ditto HK 上线前测试与交付清单

这份文档按 CTO 交付视角写：目标是确认“后端核心体验可用、前端能操作核心流程、上线人员知道怎么部署、剩余风险被明确标出”。

## 当前产品真实流程

后端已经拆成这些服务：

- `auth`: 学校邮箱验证码、邀请码、JWT 登录
- `onboarding`: 基础资料、life/mind/social 问卷、persona 生成
- `matching`: 每周 match 生成、候选 preview、结构化分数 + 可选 LLM judge
- `workflow`: match drop、双方接受/拒绝、可用时间、确认 slot、选地点、标记发生
- `feedback`: 约会后问卷、反馈信号提取、偏好权重更新、block/pass
- `memory`: 用户记忆、历史、问卷记录、偏好编辑
- `invites`: 一人一码邀请码生成、按学校/批次标注、统计、CSV 导出

核心状态机：

```txt
pending
→ notified
→ awaiting-acceptance
→ mutual-accepted
→ slot-proposing / awaiting-availability
→ slot-confirmed
→ place-confirmed
→ scheduled
→ happened
→ feedback-collected
→ closed
```

## 必跑测试

### 1. 构建测试

```bash
npm run build
```

通过标准：后端 `tsc` 和前端 `tsc -b && vite build` 都成功。

### 2. 后端端到端 smoke test

先启动后端，建议本地/预发用 mock LLM：

```bash
LLM_PROVIDER=mock EMAIL_PROVIDER=console ADMIN_SECRET=dev-secret-change-me npm --prefix backend run dev
```

另一个终端运行：

```bash
npm run smoke:backend
```

这个脚本会重置 demo 数据，并完整验证：

- 健康检查
- 重置 demo DB
- 学校邮箱验证码登录
- 跑一轮 match
- drop 通知
- 双方接受
- 推荐并确认时间
- 推荐地点并进入 scheduled
- 标记发生
- 双方提交反馈
- match 关闭
- 读取个人 memory

通过标准：输出 `Backend smoke test passed`。

### 3. 后端纯逻辑测试

```bash
npm run test:backend
```

这个脚本覆盖：

- match eligibility/filter
- same-campus / cross-campus pool
- structured score
- availability overlap
- workflow transition
- slot proposal and confirmation

通过标准：输出 `Backend logic tests passed`。

### 4. 前端人工验收

```bash
./scripts/dev.sh
```

至少人工点这几条：

- `/` 首页加载，语言切换正常
- `/join` 用学校邮箱注册，控制台验证码可用
- `/admin` 能看到学生和 match，能 reset、run match、trigger drop
- `/student` 登录后能看到当前 match 或倒计时
- `/student` 对已有 match 能执行 accept / decline
- 双方 accept 后能确认 slot
- slot confirmed 后能 pick place 并进入 scheduled
- scheduled 后能 mark happened
- happened 后能提交 feedback

### 5. 邀请码生成验收

先启动后端，然后按学校生成一批测试邀请码：

```bash
npm run invites:generate -- --plan=hku=2,cuhk=2 --batch=test-2026-04 --note="test invite batch" --out=tmp/test-invites.csv
```

通过标准：

- 命令输出每所学校生成数量
- `tmp/test-invites.csv` 存在
- CSV 包含 `code,universityId,batch,note,createdAt`
- 用其中一个邀请码可以完成 `/join` 注册

## 当前发现的上线风险

已处理的 P0：

- 管理接口已加 `x-admin-secret`：`/api/admin/overview`、`/api/dev/reset`、`/api/matches/run`、`/api/workflow/drop`。
- CORS 已改为 `CORS_ORIGINS` 白名单。
- 代码里不再内置真实 LLM key；`.env.example` 默认 `LLM_PROVIDER=mock`。
- 学生端已补核心 workflow 操作入口：accept / decline / confirm slot / pick place / mark happened / feedback。

仍需上线前确认：

- 500 人内测建议使用 Postgres。代码已支持 `DB_PROVIDER=postgres` + `DATABASE_URL`，上线同学需要新增一个 Postgres 数据库服务。
- 当前 admin secret 是共享密钥，不是完整后台账号体系。上线时应把 `/admin` 放在受限入口，且不要把 `VITE_ADMIN_SECRET` 暴露给公开站点。
- 邮件 provider 生产化：Resend key、发件域名、退信监控。
- LLM provider 生产化：真实 key、调用预算、失败监控。

P1 建议上线前处理：

- match 结果加可解释 debug 输出：为什么匹配、为什么过滤、为什么跳过。
- LLM 成本和失败率记录：`matches/run` 要记录本轮调用次数、fallback 次数、耗时。
- 日志统一：请求 ID、错误栈、关键业务事件。

## CTO 交付给上线人员的东西

最小交付包：

- 代码分支或 commit hash
- 构建命令：`npm run build`
- 后端启动命令：`npm --prefix backend run start`
- 前端构建产物：`frontend/dist`
- 健康检查地址：`GET /api/health`
- smoke test 命令：`npm run smoke:backend`
- 逻辑测试命令：`npm run test:backend`
- 邀请码生成命令：`npm run invites:generate -- --plan=hku=100,cuhk=100,hkust=100,polyu=50,cityu=50,hkbu=50,lingnan=25,eduhk=25 --batch=beta-001 --note="first 500 beta users" --out=tmp/beta-001-invites.csv`
- 环境变量清单：

```txt
PORT
DB_PROVIDER
DATABASE_URL
JWT_SECRET
JWT_TTL_DAYS
ADMIN_SECRET
CORS_ORIGINS
LLM_PROVIDER
LLM_MODEL
LLM_API_KEY
LLM_BASE_URL
LLM_BUDGET_MAX_CALLS_PER_RUN
EMAIL_PROVIDER
RESEND_API_KEY
EMAIL_FROM
AUTH_CODE_TTL_MIN
AUTH_CODE_RATE_LIMIT_PER_HOUR
INVITE_REQUIRED
VITE_API_URL
VITE_ADMIN_SECRET
```

## 数据库部署

500 人第一轮内测建议上 Postgres，不建议继续用 `backend/data/db.json`。

上线同学需要新增一个 Postgres 服务，选择 Supabase、Neon、Railway Postgres、Render Postgres、RDS 都可以。部署后把连接串配置给后端：

```txt
DB_PROVIDER=postgres
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB_NAME?sslmode=require
```

首次启动后端时，代码会自动创建一张表：

```sql
campus_ditto_state
```

当前实现是低侵入 JSONB 存储：业务数据整体存在 Postgres 的 `jsonb` 字段里。它比本地 JSON 文件可靠，适合这轮 500 人内测的单实例后端；后续正式规模化时，再迁成真正的关系表结构。

上线注意：

- 后端先用单实例运行，避免多实例同时写入造成覆盖。
- Postgres 服务必须开启持久化和自动备份。
- 不要在生产执行 `POST /api/dev/reset`，它会重置数据。
- 如果需要把现有 `backend/data/db.json` 导入 Postgres，可在设置 `DB_PROVIDER=postgres` 后运行 `npm run seed` 初始化，或由开发同学另行迁移真实数据。

## 邀请码流程

第一轮 500 人内测策略：手动发邀请码、一人一码、按学校分批。

推荐由 CTO/运营负责人运行邀请码生成命令，而不是由上线同学临时决定配额。上线同学只需要保证后端服务、`ADMIN_SECRET`、数据库可用。

生成 500 个邀请码示例：

```bash
npm run invites:generate -- --plan=hku=100,cuhk=100,hkust=100,polyu=50,cityu=50,hkbu=50,lingnan=25,eduhk=25 --batch=beta-001 --note="first 500 beta users" --out=tmp/beta-001-invites.csv
```

参数说明：

- `--plan`: 每个学校生成多少个邀请码，学校 id 来自 `backend/src/universities.ts`
- `--batch`: 批次名，建议每次发放用一个唯一批次，例如 `beta-001`
- `--note`: 备注，会写入数据库和 CSV
- `--out`: CSV 输出路径

生成结果：

- 每个邀请码只能使用一次
- 邀请码会记录 `universityId`、`batch`、`note`、`usedBy`、`usedAt`
- 运营可以把 CSV 按学校拆分后发给对应学生

用户注册过程：

1. 用户打开 `/join`
2. 输入学校邮箱、姓名、邀请码
3. 点击发送验证码
4. 收邮件验证码
5. 输入验证码并提交
6. 后端校验学校邮箱、验证码、邀请码
7. 邀请码被标记为已使用
8. 用户进入 profile/onboarding

管理接口：

- `POST /api/auth/invites/generate`: 生成邀请码，需要 `x-admin-secret`
- `GET /api/auth/invites/stats`: 查看总量、已用、未用、按学校和批次统计
- `GET /api/auth/invites/export.csv`: 导出 CSV，可加 `?universityId=hku` 或 `?batch=beta-001`

上线人员需要回传给 CTO：

- 生产 URL 和 API URL
- `/api/health` 结果
- `npm run build` 结果
- `npm run test:backend` 结果
- 预发环境 `npm run smoke:backend` 结果
- 邀请码测试生成结果
- 环境变量是否已配置真实值
- 数据库持久化方案和备份策略

## 建议下一步

上线前最后确认顺序：

1. 跑 `npm run build`。
2. 跑 `npm run test:backend`。
3. 在预发启动 API 后跑 `npm run smoke:backend`。
4. 在预发生成一小批测试邀请码，并用其中一个完成注册。
5. 人工点 `/join`、`/admin`、`/student` 的核心流程。
6. 和上线同学确认 Postgres、备份、环境变量、域名和 CORS。
7. 正式生成 500 个邀请码 CSV，由 CTO/运营按学校发放。
