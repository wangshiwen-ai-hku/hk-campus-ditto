收到。我开始实现 MVP。先列任务清单 + 读现有依赖文件。

Now extend types to add new collections, then update db.ts and seed.

Now LLM client + prompts.

Auth service — hand-rolling HS256 JWT with Node crypto to avoid extra deps.

Onboarding service.

Matching service — three-stage ranker.

Workflow service: state machine + slot + place.

Notify, feedback, memory.

Memory service.

Now wire up `index.ts` and update legacy seed to delete the conflicting old `matchmaking.ts` exports won't break.

Old [matchmaking.ts](backend/src/matchmaking.ts) is no longer imported — let me verify the TypeScript build and remove it if it conflicts.

Fixing the type errors.

Build clean. Run a quick smoke test starting the server.

Working. Let me clean up the orphaned old [matchmaking.ts](backend/src/matchmaking.ts) and finish.

MVP 完成。

## 已交付

```
backend/src/
├── core/             env.ts · auth-middleware.ts
├── llm/              client.ts (Gemini, env-controlled) · prompts.ts
├── auth/             routes · jwt · email · invite        ← 邮箱认证 + 邀请码
├── onboarding/       routes · questions · persona         ← 信息收集&问卷服务
├── matching/         routes · ranker (3-stage) · filter   ← match算法服务
├── workflow/         routes · state-machine · slot · place ← 选时间地点服务
├── feedback/         routes · templates · signals         ← 约会后反馈服务
├── memory/           routes · store · history             ← 个人约会记录服务
├── notify/           index · templates                    ← 邮件 + 模板适配
└── index.ts          mounts /api/{auth,onboarding,matches,workflow,feedback,memory}
```

每个服务对外**只暴露 routes.ts**，内部纯函数（`buildPersonaSummary`、`rankCandidatesFor`、`pickPlace`、`extractFeedbackSignals` 等）可直接被未来的 agent tool 包裹。

## 关键决策回顾

- **LLM**：Gemini via env (`LLM_PROVIDER=gemini|mock`, `LLM_MODEL=gemini-3-flash`)，统一走 `llmCall`，全部 LLM 失败有规则 fallback，永远不阻塞主流程
- **匹配算法**：硬过滤（dealbreaker / 90 天去重 / pass 黑名单）→ 结构化打分（带 `vibeWeights` 学习权重）→ Top-K 上 LLM 判官（`compatibility / sparks / risks / openerTopic`）
- **状态机**：`pending → notified → awaiting-acceptance → mutual-accepted → slot-proposing → slot-confirmed → place-confirmed → scheduled → happened → feedback-collected → closed`
- **反馈闭环**：post-date 问卷 → LLM 抽 `vibeAdjustments` → 写回 `user.vibeWeights` → 下轮 ranker 自动加权
- **认证**：6 位随机码 + sha256 hash 入库 + TTL/限频/失败次数；JWT (HS256，纯 Node crypto，零新依赖)；邀请码默认必填

## 如何测试

### 1. 启动

```bash
cd backend
cp .env.example .env             # 已预填 Gemini key、可改
npm install
npm run dev                      # http://localhost:8787
```

环境变量主开关：`LLM_PROVIDER=mock` 完全跳过 LLM；`EMAIL_PROVIDER=console` 验证码打印到终端。

### 2. 端到端流程（curl）

**本地前后端联调最快路径：直接拿用户 token**
```bash
export ADMIN_SECRET=dev-secret-change-me

curl localhost:8787/api/dev/sessions \
  -H "x-admin-secret: $ADMIN_SECRET"

curl -X POST localhost:8787/api/dev/login-as \
  -H "x-admin-secret: $ADMIN_SECRET" -H "Content-Type: application/json" \
  -d '{"userId":"demo-hku-alyssa"}'
# → { token, authorization, user }
```

前端开发模式可以先调用 `/api/dev/sessions` 做一个简易 admin/debug 入口：选一个 demo 用户，把返回的 `token` 放进本地 auth store，后续请求照常带 `Authorization: Bearer <token>`。如果要体验新用户问卷，从 basic 阶段创建一个测试号：

```bash
curl -X POST localhost:8787/api/dev/users \
  -H "x-admin-secret: $ADMIN_SECRET" -H "Content-Type: application/json" \
  -d '{"email":"local-test@connect.hku.hk","fullName":"Local Test","universityId":"hku","stage":"basic"}'
```

**a. 拿邀请码**（seed 自带 5 个）— `DITTO-HK-001` 到 `005`

**b. 请求验证码 → 终端会打印码 + devCode 字段**
```bash
curl -X POST localhost:8787/api/auth/request-code \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@connect.hku.hk"}'
```

**c. 验证码 + 邀请码注册，拿 JWT**
```bash
curl -X POST localhost:8787/api/auth/verify-code \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@connect.hku.hk","code":"821405","fullName":"Test User","inviteCode":"DITTO-HK-001"}'
# → { token, user, isNew }
export TOKEN=<拿到的 token>
```

**d. 拉问卷模板 → 填资料 → 填生活/思维/社交三组**
```bash
curl localhost:8787/api/onboarding/questions
curl -X POST localhost:8787/api/onboarding/profile \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"fullName":"Test User","yearOfStudy":"Year 3","major":"CS","gender":"any","seeking":"connection","bio":"likes coffee","languages":["English"],"interests":["coffee","hiking"],"vibeTags":["thoughtful","funny"],"availability":["Fri 4pm","Sat 2pm"]}'
curl -X POST localhost:8787/api/onboarding/survey \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"template":"onboarding_life","answers":{"weekendVibe":"hike or trail run","energyMode":"ambivert","petAffinity":"dog"}}'
curl -X POST localhost:8787/api/onboarding/persona/regenerate \
  -H "Authorization: Bearer $TOKEN"
```

**e. 跑一轮匹配（管理员触发；需要至少 2 个 profileComplete 用户）**
```bash
curl -X POST localhost:8787/api/matches/run \
  -H "x-admin-secret: $ADMIN_SECRET" -H "Content-Type: application/json" -d '{"useLlmJudge":true}'
# 看到 created / skipped / llmCalls 统计
curl -X POST localhost:8787/api/workflow/drop -H "x-admin-secret: $ADMIN_SECRET"  # 触发 match drop 通知
curl -H "Authorization: Bearer $TOKEN" localhost:8787/api/matches/current
```

**f. 接受 → 选 slot → 选地点 → 标记发生 → 反馈**
```bash
MATCH=<id>
curl -X POST localhost:8787/api/workflow/$MATCH/respond \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"choice":"yes"}'
curl -X POST localhost:8787/api/workflow/$MATCH/confirm-slot \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"slot":"Fri 4pm"}'
curl -X POST localhost:8787/api/workflow/$MATCH/pick-place \
  -H "Authorization: Bearer $TOKEN"
curl -X POST localhost:8787/api/workflow/$MATCH/mark-happened \
  -H "Authorization: Bearer $TOKEN"
curl -X POST localhost:8787/api/feedback/$MATCH/submit \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"template":"post_date_2h","answers":{"vibeScore":6,"oneLine":"funny, thoughtful, low-key sweet"}}'
```

**g. 看个人记忆 / 历史**
```bash
curl -H "Authorization: Bearer $TOKEN" localhost:8787/api/memory/me
curl -H "Authorization: Bearer $TOKEN" localhost:8787/api/memory/history
curl -H "Authorization: Bearer $TOKEN" localhost:8787/api/memory/surveys
```

### 3. 单服务自测捷径

- 看 ranker 候选不写库：`GET /api/matches/preview?llm=1`（带 token）
- 本地登录身份列表：`GET /api/dev/sessions`（`x-admin-secret`）
- 本地以用户身份登录：`POST /api/dev/login-as` body `{"userId":"demo-hku-alyssa"}`（`x-admin-secret`）
- 本地创建问卷测试用户：`POST /api/dev/users`（`x-admin-secret`）
- 重置数据：`POST /api/dev/reset`（`x-admin-secret`）
- 管理员看板：`GET /api/admin/overview`（`x-admin-secret`）
- 生成更多邀请码：`POST /api/auth/invites/generate` body `{"count":20}`（`x-admin-secret`）

### 4. 注意事项

- 前端原 `/api/availability`、`/api/profile`、`/api/matches/:id/feedback` 路径改名了：分别是 `/api/workflow/availability`、`/api/onboarding/profile`、`/api/feedback/:id/submit`，并需 `Authorization: Bearer` 头。
- LLM 默认会真的调 Gemini，单次 `matches/run` 会按候选数发请求；测试节流可加 `{"useLlmJudge": false}` 或 `LLM_PROVIDER=mock`。
- 数据库仍是 `data/db.json`（按你方案 P0 → SQLite 是下一步）。
