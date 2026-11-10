<p align="center">
  <img src="./frontend/src/assets/logo.jpg" width="120" alt="TaskWatch logo" />
</p>

# TaskWatch

TaskWatch 是一個以看板為核心的專案管理系統，採用前後端分離架構。前端使用 Vue 3 + TypeScript 打造可拖曳的看板介面，後端以 NestJS + Prisma 提供 REST API，並整合 Gemini 自動生成看板結構。系統支援 MySQL、Redis、JWT / Google OAuth，以及 ADMIN / MEMBER / GUEST 三層看板權限。

---

## 功能特色

- **看板管理** — 建立、重新命名、搜尋、最近更新、封存、復原與刪除看板
- **成員協作** — 以名稱或 Email 邀請成員、指派角色、管理成員、離開看板
- **欄位管理** — 建立、重新命名、拖曳排序、刪除欄位
- **任務管理** — 建立、編輯、刪除任務，支援跨欄拖曳、優先級、截止日與描述
- **權限控制** — ADMIN / MEMBER / GUEST 三種角色，前後端遵循同一套權限規則
- **AI 看板生成** — 輸入專案描述，由 Gemini 自動生成欄位與任務，並提供每日用量查詢
- **會員系統** — Email / 密碼註冊登入，以及 Google OAuth 第三方登入
- **API 文件** — 以 Swagger 自動產生互動式 API 文件
- **安全機制** — JWT + httpOnly Refresh Token、密碼雜湊、請求驗證、Redis 分散式限流

---

## 技術棧

### 前端

| 技術               | 用途                   |
| ------------------ | ---------------------- |
| Vue 3              | 前端框架               |
| TypeScript         | 型別安全               |
| Vite               | 開發伺服器與打包工具   |
| Tailwind CSS 4     | Utility-first 樣式     |
| Pinia              | 全域狀態管理           |
| Vue Router         | 路由與登入守衛         |
| vue-draggable-plus | 看板欄位與任務拖曳排序 |
| Axios              | API 請求與攔截器       |
| Lucide Vue         | 圖示                   |

### 後端

| 技術                | 用途                       |
| ------------------- | -------------------------- |
| NestJS 11           | REST API 框架              |
| Prisma 7            | ORM 與資料庫 migration     |
| MySQL 8.4           | 主要資料庫                 |
| Redis 8.6           | 限流儲存與 AI 每日額度計數 |
| @google/genai       | Gemini AI 整合             |
| Passport JWT        | Access Token 驗證          |
| Google Auth Library | Google ID Token 驗證       |
| bcrypt              | 密碼雜湊                   |
| class-validator     | DTO 請求驗證               |
| Swagger             | API 文件                   |
| Helmet / Throttler  | 安全標頭與速率限制         |

### 開發與基礎設施

| 技術           | 用途                    |
| -------------- | ----------------------- |
| pnpm workspace | 前後端 monorepo 管理    |
| Docker Compose | 本機啟動 MySQL 與 Redis |
| Jest           | 後端單元測試            |

---

## 系統架構

```text
┌─────────────────────────────────────────────────────────┐
│                         Browser                         │
│   Vue 3 SPA（Vite / Pinia / Vue Router / Tailwind CSS） │
└───────────────────────────┬─────────────────────────────┘
                            │ REST API / JWT
                            ▼
┌─────────────────────────────────────────────────────────┐
│                      NestJS Backend                     │
│                                                         │
│   Auth：JWT / Refresh Token / Google OAuth              │
│   Boards / Columns / Tasks：CRUD + RBAC + 成員管理      │
│   AI：Gemini 結構化輸出 + Redis 每日額度                │
│   Common：ValidationPipe / Exception Filter / Throttler │
└───────────────┬─────────────────────────────┬───────────┘
                │                             │
                ▼                             ▼
        ┌───────────────┐             ┌───────────────┐
        │  MySQL 8.4    │             │   Redis 8.6   │
        │  Prisma ORM   │             │ 限流 + AI 額度 │
        └───────────────┘             └───────────────┘
```

### Monorepo 結構

```text
taskwatch/
├── frontend/              # Vue 3 SPA
│   └── src/
│       ├── api/           # Axios API 封裝
│       ├── components/    # 看板、任務、共用元件
│       ├── composables/   # useSearch、useAiGenerate
│       ├── router/        # 路由與登入守衛
│       ├── stores/        # Pinia stores
│       └── views/         # 登入、註冊、看板列表、看板詳情
├── backend/               # NestJS REST API
│   ├── prisma/            # schema 與 migrations
│   └── src/
│       ├── auth/          # 註冊、登入、Refresh Token、Google OAuth
│       ├── boards/        # 看板與成員管理
│       ├── columns/       # 欄位管理
│       ├── tasks/         # 任務管理
│       ├── ai/            # Gemini 看板生成
│       ├── common/        # 權限、Filter、Interceptor、Guard
│       └── redis/         # Redis 封裝
├── docker-compose.yml     # MySQL + Redis
└── pnpm-workspace.yaml
```

---

## 權限模型

TaskWatch 的權限分成「角色權限矩陣」與「關係型規則」兩層：

- **角色權限矩陣**：依 ADMIN / MEMBER / GUEST 決定可執行的動作
- **關係型規則**：與角色無關，例如只有 owner 能刪除看板、只有任務建立者或 ADMIN 能刪除任務

| 動作                           |    ADMIN    |   MEMBER    |    GUEST    |
| ------------------------------ | :---------: | :---------: | :---------: |
| 查看看板與成員                 |     ✅      |     ✅      |     ✅      |
| 建立欄位                       |     ✅      |     ✅      |     ❌      |
| 重新命名 / 刪除 / 排序欄位     |     ✅      |     ❌      |     ❌      |
| 建立 / 編輯 / 移動任務         |     ✅      |     ✅      |     ❌      |
| 刪除任務                       |     ✅      |  僅建立者   |     ❌      |
| 編輯看板名稱                   |     ✅      |     ❌      |     ❌      |
| 封存 / 復原看板                |     ✅      |     ❌      |     ❌      |
| 邀請成員 / 調整角色 / 移除成員 |     ✅      |     ❌      |     ❌      |
| 刪除看板                       |  僅 owner   |     ❌      |     ❌      |
| 離開看板                       | 非 owner 可 | 非 owner 可 | 非 owner 可 |

> 看板擁有者建立時會一併建立為 ADMIN，因此 owner 也具備 ADMIN 權限。

---

## 安全性設計

- **Access Token + Refresh Token**：Access Token 短效期且只存在前端記憶體，不寫入 localStorage；Refresh Token 存放於 httpOnly Cookie
- **Refresh Token 雜湊儲存**：資料庫只保存 SHA-256 雜湊，不保存原始 token
- **Token Rotation + Reuse Detection**：每次刷新都會撤銷舊 token；偵測到已撤銷 token 被重複使用時，撤銷該使用者所有 session
- **密碼雜湊**：使用 bcrypt（12 rounds）
- **請求驗證**：全域 `ValidationPipe` 啟用 `whitelist` 與 `forbidNonWhitelisted`，拒絕未知欄位
- **速率限制**：以 Redis 作為 Throttler storage，支援多實例部署
  - 全域預設：100 次 / 60 秒
  - 登入：10 次 / 15 分鐘
  - 註冊：10 次 / 1 小時
- **安全標頭與 CORS**：Helmet、壓縮、明確設定 `CORS_ORIGIN` 並允許 credentials
- **資源層級授權**：非成員查詢看板一律回傳 404，避免洩漏資源是否存在

---

## API 設計

- **Base URL**：`http://localhost:3000`
- **Swagger**：`http://localhost:3000/api/docs`
- **驗證方式**：`Authorization: Bearer <accessToken>`
- **成功回應格式**：

```json
{
  "success": true,
  "data": {},
  "statusCode": 200
}
```

- **錯誤回應格式**：

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "您沒有權限執行此操作",
  "timestamp": "2026-11-08T00:00:00.000Z",
  "path": "/boards/1"
}
```

### 會員驗證

| 方法 | 端點             | 說明                                     |
| ---- | ---------------- | ---------------------------------------- |
| POST | `/auth/register` | Email / 密碼註冊                         |
| POST | `/auth/login`    | Email / 密碼登入                         |
| POST | `/auth/google`   | Google OAuth 登入                        |
| POST | `/auth/refresh`  | 以 httpOnly Cookie 換發新的 Access Token |
| POST | `/auth/logout`   | 撤銷 Refresh Token 並清除 Cookie         |

### 看板管理

| 方法   | 端點                       | 說明                         |
| ------ | -------------------------- | ---------------------------- |
| GET    | `/boards`                  | 取得目前使用者的看板列表     |
| POST   | `/boards`                  | 建立看板                     |
| GET    | `/boards/archived`         | 取得已封存看板               |
| GET    | `/boards/recent`           | 取得最近更新的 3 個看板      |
| GET    | `/boards/search?q=keyword` | 搜尋看板                     |
| GET    | `/boards/:id`              | 取得看板詳情（含欄位與任務） |
| PATCH  | `/boards/:id`              | 更新看板名稱（ADMIN）        |
| DELETE | `/boards/:id`              | 刪除看板（owner）            |
| PATCH  | `/boards/:id/archive`      | 封存看板（ADMIN）            |
| PATCH  | `/boards/:id/restore`      | 復原看板（ADMIN）            |

### 成員管理

| 方法   | 端點                                   | 說明                               |
| ------ | -------------------------------------- | ---------------------------------- |
| GET    | `/boards/:id/members`                  | 取得成員列表                       |
| GET    | `/boards/:id/members/search?q=keyword` | 搜尋可邀請的使用者（排除現有成員） |
| POST   | `/boards/:id/members`                  | 邀請成員（ADMIN）                  |
| PATCH  | `/boards/:id/members/:userId`          | 調整成員角色（ADMIN）              |
| DELETE | `/boards/:id/members/:userId`          | 移除成員或離開看板                 |

### 欄位管理

| 方法   | 端點                               | 說明                      |
| ------ | ---------------------------------- | ------------------------- |
| POST   | `/boards/:boardId/columns`         | 建立欄位                  |
| PATCH  | `/boards/:boardId/columns/reorder` | 批次更新欄位排序（ADMIN） |
| PATCH  | `/boards/:boardId/columns/:id`     | 更新欄位名稱（ADMIN）     |
| DELETE | `/boards/:boardId/columns/:id`     | 刪除欄位（ADMIN）         |

### 任務管理

| 方法   | 端點                                       | 說明                           |
| ------ | ------------------------------------------ | ------------------------------ |
| POST   | `/boards/:boardId/columns/:columnId/tasks` | 建立任務                       |
| PATCH  | `/tasks/:id`                               | 更新任務內容                   |
| DELETE | `/tasks/:id`                               | 刪除任務（ADMIN 或建立者）     |
| PATCH  | `/tasks/:id/move`                          | 拖曳移動任務（跨欄或同欄排序） |

### AI 功能

| 方法 | 端點           | 說明                           |
| ---- | -------------- | ------------------------------ |
| POST | `/ai/generate` | 依 prompt 生成看板、欄位與任務 |
| GET  | `/ai/usage`    | 查詢今日 AI 使用次數與剩餘額度 |

### 其他

| 方法 | 端點      | 說明     |
| ---- | --------- | -------- |
| GET  | `/health` | 健康檢查 |

---

## AI 技術亮點

### 結構化輸出

`POST /ai/generate` 會將使用者輸入的專案描述交給 Gemini，並透過 `responseSchema` 強制模型輸出符合以下結構的 JSON：

```text
{
  boardName: string,
  columns: [
    {
      name: string,
      tasks: [
        { title, description?, priority, dueDate? }
      ]
    }
  ]
}
```

- 最多 5 個欄位
- 每個欄位最多 5 個任務
- 使用 `responseMimeType: application/json`，不需要解析 Markdown code fence
- 任務優先級限制為 `low` / `medium` / `high`
- 截止日期格式為 `YYYY-MM-DD`

### 生成流程

```text
使用者輸入 prompt
        │
        ▼
POST /ai/generate
        │
        ├── Redis INCR 檢查每日額度（原子操作）
        │
        ▼
Gemini structured output
        │
        ▼
JSON.parse
        │
        ▼
Prisma $transaction
  ├── 建立 Board
  ├── 建立 Columns
  └── 建立 Tasks
        │
        ├── 成功 → 回傳完整看板
        └── 失敗 → Redis DECR 退還額度
```

### 額度控制

- 使用 Redis `INCR` + `EXPIRE` 實作每日計數器
- Key 格式：`ai_usage:{userId}`
- TTL 為 24 小時
- 額度由環境變數 `AI_DAILY_LIMIT` 控制
- 生成或資料庫交易失敗時會退還該次額度，避免系統錯誤消耗使用者配額

---

## 本機開發

### 環境需求

- Node.js 22+
- pnpm 10+
- Docker Desktop
- Gemini API Key（後端環境變數必填）
- Google OAuth Client ID（後端環境變數必填；使用 Google 登入時需填入正式 Client ID）

### 安裝步驟

```bash
# 1. Clone 專案
git clone <your-repository-url>
cd taskwatch

# 2. 安裝依賴
pnpm install
```

### 啟動資料庫

```bash
docker compose up -d
```

這會啟動：

- MySQL 8.4：`localhost:3307`
- Redis 8.6：`localhost:6379`

### 初始化資料庫

```bash
# 產生 Prisma Client
pnpm --filter backend exec prisma generate

# 套用 migrations
pnpm --filter backend exec prisma migrate deploy
```

### 啟動開發伺服器

```bash
# 後端（http://localhost:3000）
pnpm --filter backend start:dev

# 前端（http://localhost:5173）
pnpm --filter frontend dev
```

### Google OAuth 設定

前端使用 Google Identity Services 取得 ID Token，不需要設定 redirect URI。

在 Google Cloud Console 建立 OAuth 2.0 Client ID（Web application），並設定：

- Authorized JavaScript origins：`http://localhost:5173`

同一個 Client ID 需填入：

- `backend/.env` 的 `GOOGLE_CLIENT_ID`
- `frontend/.env` 的 `VITE_GOOGLE_CLIENT_ID`

---

## 設計取捨

- **REST 而非 GraphQL**：MVP 的資源關係明確，REST 搭配巢狀路由已足夠，也能降低前端與後端的實作複雜度。
- **Redis 而非資料庫計數**：AI 每日額度屬於高頻讀寫的短期狀態，使用 Redis `INCR` + TTL 比寫入 MySQL 更合適。
- **結構化輸出而非自由文字**：Gemini 直接回傳符合 schema 的 JSON，避免解析不穩定的 Markdown 或自然語言格式。
- **靜態權限矩陣 + 關係型規則**：角色權限集中在 `ROLE_PERMISSIONS`，owner / 建立者 / 本人等例外則由 policy helper 處理，避免權限邏輯散落在各 service。
- **非成員回傳 404**：查詢看板時，非成員一律回傳 404 而非 403，避免洩漏看板是否存在。

---

## 測試

目前僅涵蓋 health endpoint 的基本單元測試，完整單元測試與 E2E 測試待補。

```bash
pnpm --filter backend test
```

---

## 授權

本專案為個人作品集與學習用途。
