# Task Management System — PRD v2.0

**Product Requirements Document**
v2.0 · 2026 · Portfolio Edition

**Vue 3 · NestJS · MySQL · Redis · Gemini API · Docker**

---

## 0. 核心模組速覽

| 模組           | 核心技術                             | 亮點設計                                                                                     |
| -------------- | ------------------------------------ | -------------------------------------------------------------------------------------------- |
| ① 身分驗證     | JWT 雙 Token + bcrypt + Google OAuth | Access Token in memory，Refresh Token HttpOnly Cookie，Token Rotation，Email/Google 互斥登入 |
| ② 看板管理     | CRUD + 拖拉排序 + 多人協作           | 看板成員角色（admin/member/guest），多人指派，標籤系統，樂觀更新                             |
| ③ AI 生成看板  | Gemini API                           | 輸入關鍵字或需求描述 → 自動建立任務流程                                                      |
| ④ 使用次數限制 | Redis TTL                            | 每日限制 5 次，24 小時自動重置                                                               |

---

## 1. 專案概覽

**Task Management System** 是一個以看板為核心的任務管理系統，整合 Gemini AI 自動生成看板流程，讓使用者輸入專案描述後即可自動建立任務卡片與欄位。

採用 **NestJS + Prisma + MySQL** 後端架構，搭配 **Vue 3 + TypeScript** 前端，使用 **Docker Compose** 統一本機開發環境。

> **部署說明：** 後端部署於 AWS EC2（t3.micro），使用 Docker Compose 統一管理 NestJS、MySQL、Redis，Nginx 作為反向代理，AWS CloudFront 提供 HTTPS 終止與 CDN 加速。前端 Vue SPA 部署於 Vercel，享有全球 CDN 與自動化 CI/CD。

### 設計核心原則

- **功能聚焦**：只做看板核心功能 + AI 亮點，不堆砌模組，每個功能都能說清楚為什麼
- **企業等級標準**：架構設計、元件拆分、SQL 查詢優化對齊真實企業開發規範
- **每個決策說得出理由**：技術選型、資料庫設計、元件邊界都有明確依據
- **MVP 優先**：先跑通核心流程，穩定後再優化

---

## 2. 技術架構

### 2.1 技術棧總覽

| 層次        | 技術選型                     | 選用理由                                                    |
| ----------- | ---------------------------- | ----------------------------------------------------------- |
| 前端框架    | Vue 3 + TypeScript + Vite    | Composition API 彈性高、TS 型別安全、Vite 開發體驗好        |
| UI 樣式     | Tailwind CSS                 | 快速切版、高客製化、避免 CSS 命名衝突                       |
| 狀態管理    | Pinia                        | 輕量、TypeScript 友善、DevTools 支援完整                    |
| HTTP 客戶端 | Axios + Interceptor          | 統一請求處理、自動帶 Token、Token 刷新邏輯集中管理          |
| 後端框架    | NestJS + TypeScript          | 模組化 DI 架構、Decorator 驅動、Guard/Pipe/Interceptor 完整 |
| ORM         | Prisma                       | 型別安全、Migration 工具完整、Schema 即文件                 |
| 資料庫      | MySQL 8.4                    | 關聯式資料庫、FULLTEXT 支援、企業主流選型                   |
| 快取        | Redis 7                      | AI 使用次數 TTL 計數、未來可擴充 Token 黑名單               |
| AI          | Google Gemini 2.5 Flash lite | 免費額度夠用、JSON 結構化輸出穩定                           |
| 開發環境    | Docker Compose               | MySQL + Redis 一鍵啟動，統一團隊環境                        |
| API 文件    | Swagger / OpenAPI 3.0        | 自動產生文件，後端開發即文件                                |

### 2.2 系統架構圖

```
┌─────────────────────────────────────────────────────┐
│               使用者瀏覽器                           │
│   Vue 3 SPA（部署於 Vercel）                         │
│   • Pinia Store（Token in memory）                   │
│   • Vue Router + beforeEach Navigation Guard         │
│   • Axios Interceptor（自動帶 Token / 刷新 Token）   │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────┐
│         AWS CloudFront（CDN + HTTPS 終止）           │
│   • 全球 CDN 加速，降低延遲                          │
│   • SSL/TLS 憑證管理（ACM 免費憑證）                 │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP（內網）
                       ▼
┌─────────────────────────────────────────────────────┐
│         AWS EC2 t3.micro（Docker Compose）           │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  Nginx（反向代理，Port 80）                  │    │
│  │  • 轉發至 NestJS :3000，處理 gzip 壓縮       │    │
│  └──────────────────────┬──────────────────────┘    │
│                         ▼                            │
│  ┌──────────────────────────────────────────────┐   │
│  │  NestJS API Server（Port 3000）               │   │
│  │  • Helmet / CORS / ThrottlerGuard            │   │
│  │  • JwtAuthGuard → Controller → Service       │   │
│  │  • TransformInterceptor / ExceptionFilter    │   │
│  └───────────┬──────────────────┬───────────────┘   │
│              ▼                  ▼                    │
│  ┌───────────────────┐  ┌───────────────────────┐   │
│  │  MySQL 8.4        │  │  Redis 7              │   │
│  │  • boards         │  │  • ai_usage:{uid} TTL │   │
│  │  • columns        │  └───────────────────────┘   │
│  │  • tasks          │                               │
│  │  • users          │                               │
│  │  • refresh_tokens │                               │
│  └───────────────────┘                               │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
          ┌──────────────────────┐
          │  Google Gemini API   │
          │  （外部服務）        │
          └──────────────────────┘
```

### 2.3 部署架構總覽

| 服務                  | 用途                                                         | 費用                          |
| --------------------- | ------------------------------------------------------------ | ----------------------------- |
| **AWS EC2 t3.micro**  | 後端主機，Docker Compose 管理 NestJS + MySQL + Redis + Nginx | Free Tier 750hr/月（12 個月） |
| **AWS CloudFront**    | HTTPS 終止 + CDN 加速                                        | Free Tier 1TB 流量/月         |
| **Vercel**            | 前端 Vue SPA 部署 + 自動 CI/CD                               | 永久免費                      |
| **Google Gemini API** | AI 看板生成                                                  | 免費額度足夠展示              |

**流量路徑：**

```
使用者 → CloudFront (HTTPS + CDN)
              ↓
         EC2 t3.micro
         ├── Nginx（Port 80，反向代理）
         ├── NestJS（Port 3000）
         ├── MySQL（Port 3306，僅內部）
         └── Redis（Port 6379，僅內部）

前端 Vue SPA → Vercel（獨立部署，全球 CDN，Git push 自動上線）
```

### 2.4 Docker Compose 本機開發環境

```yaml
# docker-compose.yml
version: '3.8'

services:
  mysql:
    image: mysql:8.4
    container_name: tms_mysql
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
    ports:
      - '3306:3306'
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:8.6-alpine
    container_name: tms_redis
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

volumes:
  mysql_data:
  redis_data:
```

---

## 3. 架構設計審查

> 本章節逐項確認系統設計是否符合企業等級標準，每個決策都附上理由與面試說明要點。

### 3.1 後端分層架構

企業等級的 NestJS 後端應嚴格遵守單一職責，每一層只做自己該做的事。

```
Controller   → 只負責接收 Request、解析參數、回傳 Response
              不寫業務邏輯，不直接碰資料庫

Service      → 只負責業務邏輯
              不知道 HTTP 存在，不知道資料庫細節

Repository   → 只負責資料庫操作（Prisma 在這一層）
              只做 CRUD，不處理業務判斷

Guard        → 只負責「能不能進來」（認證 / 授權）
Pipe         → 只負責「資料格式正不正確」
Interceptor  → 只負責「進來前 / 出去前要做什麼」
Filter       → 只負責「出錯時怎麼處理」
```

**審查結論：符合標準。** 本專案的模組邊界清晰，Service 不直接寫 Prisma 查詢（透過獨立 Repository），Guard/Pipe/Interceptor 各司其職。

---

### 3.2 錯誤處理策略

所有錯誤統一由 `GlobalExceptionFilter` 處理，確保 Response 格式一致。

```typescript
// common/filters/global-exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = '伺服器錯誤，請稍後再試';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message;
      code = HTTP_STATUS_CODE_MAP[status] ?? 'HTTP_ERROR';
    }

    // 500 以上記錄 Log（生產環境送 CloudWatch / Sentry）
    if (status >= 500) {
      console.error('[UNHANDLED ERROR]', exception);
    }

    response.status(status).json({
      success: false,
      code,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

**統一錯誤碼對照表：**

| HTTP Status | code               | 說明                | 觸發場景                     |
| ----------- | ------------------ | ------------------- | ---------------------------- |
| 400         | VALIDATION_FAILED  | 請求參數驗證失敗    | ValidationPipe DTO 驗證不過  |
| 401         | UNAUTHORIZED       | 未登入或 Token 無效 | JwtAuthGuard 失敗            |
| 403         | FORBIDDEN          | 權限不足            | 嘗試存取不屬於自己的資源     |
| 404         | NOT_FOUND          | 資源不存在          | Service 查無資料             |
| 409         | CONFLICT           | 資料衝突            | Email 已存在                 |
| 422         | INVALID_TRANSITION | 狀態機轉換不合法    | 看板狀態不允許的操作         |
| 429         | RATE_LIMITED       | 請求過於頻繁        | ThrottlerGuard / AI 每日限額 |
| 500         | INTERNAL_ERROR     | 伺服器內部錯誤      | 未預期的 Exception           |

---

### 3.3 統一 Response 格式

所有 API 回傳格式由 `TransformInterceptor` 統一包裝。

```typescript
// 成功
{
  "success": true,
  "data": { ... },         // 單筆或陣列
  "meta": {                // 分頁時附帶
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}

// 失敗（由 GlobalExceptionFilter 處理）
{
  "success": false,
  "code": "VALIDATION_FAILED",
  "message": "title 不能為空",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "path": "/api/tasks"
}
```

**審查結論：符合企業標準。** 前端只需判斷 `success` 欄位，不需要解析不同結構。

---

## 4. 身分驗證模組（企業等級設計）

### 4.1 Token 策略設計

| Token 類型    | 效期    | 儲存位置                 | 說明                                                   |
| ------------- | ------- | ------------------------ | ------------------------------------------------------ |
| Access Token  | 15 分鐘 | Pinia memory             | 每次 API 請求帶在 Authorization Header，頁面關閉即消失 |
| Refresh Token | 7 天    | HttpOnly + Secure Cookie | JS 無法讀取（防 XSS），Hash 存 DB                      |

**為什麼 Access Token 存 memory 不存 localStorage？**

localStorage 可被頁面上任何 JS 讀取，一旦發生 XSS 攻擊，Token 立刻洩漏。存在 Pinia memory 中，XSS 腳本無法透過 `localStorage.getItem()` 取得，安全性更高。代價是頁面重整後 Token 消失，由 Refresh Token Cookie 自動補回。

### 4.2 Token Rotation 機制

每次使用 Refresh Token 換新 Access Token 時，同步廢除舊 Refresh Token 並簽發新的，防止 Token 重放攻擊。

```
POST /auth/refresh
  ① Cookie 取得 Refresh Token
  ② DB 查詢：WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > NOW()
  ③ 驗證通過 → 廢除舊 Token（UPDATE revoked_at = NOW()）
  ④ 簽發新 Access Token（15m）
  ⑤ 簽發新 Refresh Token（7d）→ INSERT + Set-Cookie
  ⑥ Response: { accessToken }
```

### 4.3 安全性檢查清單

| 威脅                      | 防禦措施                                                                    | 實作位置                   |
| ------------------------- | --------------------------------------------------------------------------- | -------------------------- |
| XSS Token 竊取            | Access Token 存 memory，Refresh 存 HttpOnly Cookie                          | Pinia Store + Cookie 設定  |
| CSRF                      | SameSite=Strict Cookie                                                      | Cookie 設定                |
| 暴力破解                  | ThrottlerGuard：登入 API 10 次/15 分鐘                                      | NestJS Throttler           |
| SQL Injection             | Prisma 參數化查詢，永不字串拼接                                             | Prisma ORM 底層保障        |
| 密碼洩漏                  | bcrypt 12 rounds hash，永不儲存明文                                         | AuthService.hashPassword() |
| Token 重放                | Rotation + DB revoked_at 黑名單                                             | refresh_tokens 資料表      |
| Google OAuth 帳號綁定衝突 | 同 email 只能對應一種 auth_provider，嘗試用另一種方式登入時回傳明確錯誤訊息 | AuthService 登入邏輯       |

### 4.4 前端 Axios Interceptor（Token 自動刷新）

```typescript
// api/client.ts
let isRefreshing = false;
let failedQueue: Array<{ resolve: Function; reject: Function }> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // 401 且不是登入或刷新請求本身
    if (status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // 其他請求排隊等待刷新完成
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await authStore.refresh(); // POST /auth/refresh
        failedQueue.forEach(({ resolve }) => resolve());
        return api(originalRequest); // 重試原請求
      } catch {
        failedQueue.forEach(({ reject }) => reject());
        authStore.logout();
        router.push('/login');
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
        failedQueue = [];
      }
    }

    // 其他錯誤統一處理
    if (status === 403) router.push('/403');
    if (status === 429) toast.warning('操作過於頻繁，請稍後再試');
    if (status >= 500) toast.error('伺服器錯誤，請稍後再試');

    return Promise.reject(error);
  },
);
```

**審查結論：符合企業標準。** 使用 `failedQueue` 處理併發刷新問題（多個請求同時 401 時只刷新一次），這是生產環境必備的處理邏輯。

### 4.5 Google OAuth 設計

#### 登入流程

```
使用者點擊「Google 登入」
        ↓
前端跳轉 GET /auth/google（後端發起 OAuth 授權請求）
        ↓
Google 授權頁面 → 使用者同意
        ↓
Google 回呼 GET /auth/google/callback?code=xxx
        ↓
後端用 code 換取 Google access_token
        ↓
後端呼叫 Google UserInfo API → 取得 { email, googleId, name, avatarUrl }
        ↓
查詢 DB：WHERE email = ?
  ├─ 不存在 → 自動建立帳號（auth_provider = google）
  ├─ 存在且 auth_provider = google → 正常登入
  └─ 存在且 auth_provider = email → 回傳錯誤：「此 email 已用 Email 方式註冊，請改用密碼登入」
        ↓
簽發 JWT（和 Email 登入相同流程）
        ↓
前端收到 Access Token → 存 Pinia → 跳轉看板列表
```

#### 帳號設計決策

| 決策                 | 說明                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------- |
| Email 與 Google 互斥 | 同一個 email 只能選擇一種登入方式，不允許合併帳號，避免帳號切換造成的資料歸屬問題       |
| password_hash 可為空 | Google 使用者不設密碼，`password_hash` 欄位允許 NULL，透過 `auth_provider` 欄位區分類型 |
| google_id 唯一索引   | 防止同一個 Google 帳號重複建立使用者                                                    |
| 錯誤提示明確         | 用錯登入方式時提示：「此帳號已用 Google 登入，請使用 Google 繼續」/ 反之亦然            |

---

## 5. 前端元件拆分設計（企業等級）

> 元件拆分的核心原則：**單一職責 + 可複用 + 易測試**。
> 判斷一個元件是否需要拆分的標準：「如果這段邏輯改了，會影響多少地方？」

### 5.1 元件拆分總覽

```
src/components/
├── common/                    # 通用 UI 元件，不含業務邏輯
│   ├── BaseButton.vue         # 按鈕（variant: primary/secondary/danger）
│   ├── BaseInput.vue          # 輸入框（含 error 狀態顯示）
│   ├── BaseModal.vue          # Modal 容器（slot-based，不含業務內容）
│   ├── BaseSpinner.vue        # 載入動畫
│   ├── BaseBadge.vue          # 標籤（priority / status 顯示）
│   └── BaseToast.vue          # Toast 通知
│
├── board/                     # 看板相關元件
│   ├── BoardView.vue          # 看板頁面容器（只負責組合子元件）
│   ├── BoardColumn.vue        # 單一欄位（含欄位標題 + 任務列表）
│   ├── TaskCard.vue           # 單一任務卡片（唯讀展示）
│   ├── TaskCardDraggable.vue  # 可拖拉的卡片包裝層（分離拖拉邏輯）
│   ├── TaskDetailModal.vue    # 任務詳情 Modal（查看 + 編輯）
│   └── TaskCreateForm.vue     # 新增任務表單（獨立表單邏輯）
│
└── ai/
    ├── AiGenerateButton.vue   # 觸發 AI 生成的按鈕（含剩餘次數顯示）
    └── AiGenerateModal.vue    # AI 輸入 Modal（輸入框 + 生成中狀態）
```

### 5.2 元件拆分設計說明

#### TaskCard.vue — 只負責展示，不含任何邏輯

```vue
<!-- components/board/TaskCard.vue -->
<!-- 這個元件只負責「把一張卡片畫出來」，不知道拖拉、不知道 API -->
<template>
  <div :class="priorityBorderClass">
    <h3>{{ task.title }}</h3>
    <BaseBadge :variant="task.priority">{{ task.priority }}</BaseBadge>
    <span v-if="task.due_date" :class="dueDateClass">
      {{ formatDate(task.due_date) }}
    </span>
  </div>
</template>

<script setup lang="ts">
// Props 只接收資料，不接收函數（函數透過 emit 向上溝通）
const props = defineProps<{ task: Task }>();
const emit = defineEmits<{ click: [taskId: number] }>();

// 計算屬性：priority 對應的顏色
const priorityBorderClass = computed(() => ({
  'border-l-4 border-red-500': props.task.priority === 'high',
  'border-l-4 border-yellow-500': props.task.priority === 'medium',
  'border-l-4 border-gray-300': props.task.priority === 'low',
}));

// 計算屬性：到期日顏色（逾期顯示紅色）
const dueDateClass = computed(() => ({
  'text-red-500': new Date(props.task.due_date!) < new Date(),
  'text-gray-500': new Date(props.task.due_date!) >= new Date(),
}));
</script>
```

**為什麼這樣拆？** 展示邏輯和互動邏輯分離。TaskCard 只管畫面，拖拉邏輯由 TaskCardDraggable 處理，點擊詳情由父層接收 emit 後決定要做什麼。

#### 為什麼把拖拉邏輯獨立成 TaskCardDraggable？

```vue
<!-- components/board/TaskCardDraggable.vue -->
<!-- 只負責處理拖拉，內容交給 TaskCard 渲染 -->
<template>
  <div draggable="true" @dragstart="onDragStart" @dragend="onDragEnd">
    <TaskCard :task="task" @click="emit('click', task.id)" />
  </div>
</template>
```

好處：如果未來換拖拉套件（從 HTML5 原生換成 vue-draggable），只改這個元件，TaskCard 完全不受影響。這就是「關注點分離」的實際應用。

#### BaseModal.vue — Slot-based 設計，不含業務內容

```vue
<!-- components/common/BaseModal.vue -->
<!-- Modal 容器只管遮罩、動畫、關閉邏輯，內容由外部決定 -->
<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click.self="emit('update:modelValue', false)">
      <div class="modal-content">
        <slot />
        <!-- 業務內容由父層傳入 -->
      </div>
    </div>
  </Teleport>
</template>
```

使用方式：

```vue
<!-- TaskDetailModal.vue 使用 BaseModal -->
<BaseModal v-model="isOpen">
  <TaskDetailForm :task="selectedTask" @saved="onSaved" />
</BaseModal>
```

**審查結論：符合企業標準。** 通用 UI 元件與業務元件分離，BaseModal 可複用於任何場景，業務元件只關注自己的邏輯。

### 5.3 Composable 設計

```
src/composables/
├── useAuth.ts          # 登入、登出、取得當前使用者
├── useDragAndDrop.ts   # 拖拉邏輯（狀態機驗證、樂觀更新、API 呼叫、回滾）
├── useAiGenerate.ts    # AI 生成流程（次數查詢、API 呼叫、建立看板）
└── useLocalUUID.ts     # 取得或建立訪客 UUID（localStorage）
```

#### useDragAndDrop.ts — 樂觀更新完整流程

```typescript
// composables/useDragAndDrop.ts
export function useDragAndDrop() {
  const boardStore = useBoardStore();
  const toast = useToast();

  async function onDrop(taskId: number, targetColumnId: number, targetPosition: number) {
    const task = boardStore.findTask(taskId);
    if (!task) return;

    // 1. 驗證狀態機（例如：done 不能移回 todo）
    if (!isValidTransition(task.status, targetColumnId)) {
      toast.error('此操作不被允許');
      return;
    }

    // 2. 樂觀更新：先更新畫面
    const snapshot = boardStore.takeSnapshot();
    boardStore.moveTask(taskId, targetColumnId, targetPosition);

    // 3. 呼叫 API
    try {
      await tasksApi.move(taskId, { columnId: targetColumnId, position: targetPosition });
    } catch {
      // 4. 失敗回滾：還原到操作前的狀態
      boardStore.restoreSnapshot(snapshot);
      toast.error('移動失敗，請重試');
    }
  }

  return { onDrop };
}
```

**面試說明要點：** `takeSnapshot()` 做深拷貝，不是參考拷貝，確保回滾時不受後續操作影響。

---

## 6. 資料庫設計

### 6.1 Prisma Schema

```prisma
// prisma/schema.prisma
// 注意：Prisma 7 使用新的 generator 名稱 "prisma-client"（非 prisma-client-js）
// DATABASE_URL 已移至 prisma.config.ts，datasource 不需要 url 欄位

generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "mysql"
}

// ─── 身分驗證 ──────────────────────────────────────────────────

model User {
  id           Int          @id @default(autoincrement())
  email        String       @unique @db.VarChar(255)
  name         String       @db.VarChar(50)
  authProvider AuthProvider @map("auth_provider")
  passwordHash String?      @map("password_hash") @db.VarChar(255)  // Email 使用者才有
  googleId     String?      @unique @map("google_id") @db.VarChar(100)  // Google 使用者才有
  avatarUrl    String?      @map("avatar_url") @db.VarChar(500)
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt @map("updated_at")

  ownedBoards   Board[]
  boardMembers  BoardMember[]
  refreshTokens RefreshToken[]
  taskAssignees TaskAssignee[]
  createdTasks  Task[]         @relation("TaskCreator")

  @@map("users")
}

enum AuthProvider {
  email
  google
}

model RefreshToken {
  id        Int       @id @default(autoincrement())
  userId    Int       @map("user_id")
  tokenHash String    @map("token_hash") @db.VarChar(255)
  expiresAt DateTime  @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  ipAddress String?   @map("ip_address") @db.VarChar(45)
  createdAt DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([tokenHash])
  @@map("refresh_tokens")
}

// ─── 看板核心 ──────────────────────────────────────────────────

model Board {
  id              Int      @id @default(autoincrement())
  ownerId         Int      @map("owner_id")
  name            String   @db.VarChar(100)
  backgroundColor String   @default("#0079BF") @map("background_color") @db.VarChar(20)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  owner   User          @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  members BoardMember[]
  columns Column[]
  labels  Label[]

  @@index([ownerId])
  @@map("boards")
}

model BoardMember {
  id       Int             @id @default(autoincrement())
  boardId  Int             @map("board_id")
  userId   Int             @map("user_id")
  role     BoardMemberRole @default(member)
  joinedAt DateTime        @default(now()) @map("joined_at")

  board Board @relation(fields: [boardId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([boardId, userId])  // 同一個 user 在同一個 board 只能有一筆
  @@index([boardId])
  @@index([userId])
  @@map("board_members")
}

enum BoardMemberRole {
  admin   // 完整控制：邀請/踢人/改名/刪除看板
  member  // 建立/編輯/刪除卡片和欄位，移動任務
  guest   // 唯讀 + 留言（暫不實作，預留欄位）
}

model Column {
  id        Int      @id @default(autoincrement())
  boardId   Int      @map("board_id")
  name      String   @db.VarChar(100)
  position  Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")

  board Board  @relation(fields: [boardId], references: [id], onDelete: Cascade)
  tasks Task[]

  @@index([boardId])
  @@map("columns")
}

// ─── 任務 ──────────────────────────────────────────────────────

model Task {
  id          Int       @id @default(autoincrement())
  columnId    Int       @map("column_id")
  title       String    @db.VarChar(255)
  description String?   @db.Text          // Markdown 格式儲存
  linkUrl     String?   @map("link_url") @db.VarChar(2048)
  priority    Priority  @default(medium)
  dueDate     DateTime? @map("due_date") @db.Date
  position    Int       @default(0)
  createdBy   Int       @map("created_by")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  column    Column         @relation(fields: [columnId], references: [id], onDelete: Cascade)
  creator   User           @relation("TaskCreator", fields: [createdBy], references: [id])
  assignees TaskAssignee[]
  labels    TaskLabel[]

  @@index([columnId, position])  // 複合索引：看板查詢最常用
  @@index([createdBy])
  @@index([dueDate])
  @@map("tasks")
}

enum Priority {
  low
  medium
  high
}

// ─── 多對多關聯 ──────────────────────────────────────────────

model TaskAssignee {
  taskId     Int      @map("task_id")
  userId     Int      @map("user_id")
  assignedAt DateTime @default(now()) @map("assigned_at")

  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([taskId, userId])  // 複合主鍵，同一個 user 不能重複指派同一張卡片
  @@index([taskId])
  @@index([userId])
  @@map("task_assignees")
}

model Label {
  id      Int    @id @default(autoincrement())
  boardId Int    @map("board_id")
  name    String @db.VarChar(50)
  color   String @db.VarChar(20)  // hex color, e.g. "#FF5733"

  board Board       @relation(fields: [boardId], references: [id], onDelete: Cascade)
  tasks TaskLabel[]

  @@index([boardId])
  @@map("labels")
}

model TaskLabel {
  taskId  Int @map("task_id")
  labelId Int @map("label_id")

  task  Task  @relation(fields: [taskId], references: [id], onDelete: Cascade)
  label Label @relation(fields: [labelId], references: [id], onDelete: Cascade)

  @@id([taskId, labelId])
  @@map("task_labels")
}
```

### 6.2 ER Diagram（文字版）

```
users (1) ──< boards (many)              [ownerId]         創建者/擁有者
users (1) ──< board_members (many)       [userId]          看板成員
users (1) ──< refresh_tokens (many)      [userId]
users (1) ──< task_assignees (many)      [userId]          被指派的任務
users (1) ──< tasks (many)               [createdBy]       建立的任務

boards (1) ──< board_members (many)      [boardId]
boards (1) ──< columns (many)            [boardId]
boards (1) ──< labels (many)             [boardId]         標籤屬於看板

columns (1) ──< tasks (many)             [columnId]

tasks (many) >──< users (many)           task_assignees    多人指派（多對多）
tasks (many) >──< labels (many)          task_labels       任務標籤（多對多）
labels (many) >──< tasks (many)          task_labels
```

**共 9 張資料表：**

| 資料表         | 說明                               |
| -------------- | ---------------------------------- |
| users          | 使用者，支援 email/google 兩種登入 |
| refresh_tokens | Refresh Token 黑名單               |
| boards         | 看板                               |
| board_members  | 看板成員與角色                     |
| columns        | 看板欄位                           |
| tasks          | 任務卡片                           |
| task_assignees | 任務指派人（多對多）               |
| labels         | 標籤（屬於特定看板）               |
| task_labels    | 任務貼上的標籤（多對多）           |

**暫緩實作（MVP 後擴充）：** `comments`（任務留言）、`activity_logs`（操作紀錄）

### 6.3 關鍵設計決策

> 每個設計決策都有明確理由，面試時需要說得出來。

#### 決策 1：auth_provider 欄位 + Email/Google 互斥設計

```
問：為什麼不讓同一個 email 同時支援 email 和 google 登入？

答：允許「帳號合併」會帶來以下複雜度：
  1. 需要帳號合併流程（要求使用者驗證兩種方式的身份）
  2. 合併失敗時的 Rollback 處理
  3. 合併後的 refresh_tokens 歸屬問題

MVP 階段選擇互斥設計：同一個 email 只能用一種方式，用錯方式時
回傳明確的錯誤訊息，讓使用者知道要改用哪種方式。
這個決策犧牲了少量彈性，換來的是零帳號合併邊界情況。
```

#### 決策 2：task_assignees.user_id → users.id（非 board_members.id）

```
問：指派人的 FK 為何不指向 board_members，而是直接指向 users？

答：board_members 是「看板成員關係」，是一個會變動的狀態——
  - 成員可能被移出看板
  - 但他已建立/被指派的任務資料不應消失

如果 FK → board_members.id：
  - 成員被移出 → board_members 那筆刪除 → task_assignees CASCADE 刪除 → 指派記錄消失
  - 這是資料遺失，不是預期行為

所以 FK → users.id：
  - 成員被移出不影響 task_assignees
  - 但在指派時，應用層驗證此 user 目前仍是 board member
  - 這就是「資料庫保障資料完整性，應用層保障業務規則」的分層設計
```

#### 決策 3：labels 屬於 board，不是 global

```
問：為什麼標籤要 board-specific，不設計成全域標籤？

答：全域標籤會有以下問題：
  - 多個看板可能有語意相同但不同色系的標籤（設計看板的「緊急」vs 開發看板的「緊急」）
  - 全域標籤的管理界面變得複雜（要決定誰能建立/刪除）
  - Trello、Linear、JIRA 都是 board-level 標籤

labels.board_id FK 設計確保：
  - 每個看板有自己的標籤集合
  - onDelete: Cascade（看板刪除，標籤跟著刪）
  - task_labels 中，任務只能貼同一個看板下的標籤（應用層驗證）
```

#### 決策 4：board_members 角色系統（admin / member / guest）

```
看板擁有者（boards.owner_id）vs 看板管理員（board_members.role = admin）：

boards.owner_id 是「創建這個看板的人」，永遠只有一個，無法轉讓
board_members.role = admin 是「被授權管理這個看板的人」，可以有多個

角色權限設計：
  admin  → 邀請成員、移除成員、更改成員角色、重新命名看板、刪除看板
           + 所有 member 的權限
  member → 建立/編輯/刪除任務、建立/重新命名/刪除欄位、拖拉任務、指派成員
  guest  → 唯讀（預留欄位，MVP 暫不實作 guest 相關業務邏輯）

注意：看板擁有者自動擁有 admin 權限（在建立看板時寫入 board_members）
```

#### 決策 5：boards.background_color（純色，無照片）

```
問：為什麼 background 只支援顏色，不支援圖片？

答：
  1. 圖片需要 S3 或 CDN 儲存，增加基礎設施複雜度
  2. 圖片上傳需要額外的 API endpoint 和驗證邏輯（大小、格式）
  3. MVP 階段先聚焦核心功能，background_color 是一個 VarChar(20) 的 hex 值就能搞定
  4. 後續擴充時可以增加 background_image_url 欄位，不影響現有資料
```

---

## 7. SQL 查詢優化（企業等級）

> 本章節說明每個關鍵查詢的設計決策與優化策略，對應面試「查詢效能」相關問題。

### 7.1 索引設計策略

**原則：** 索引不是越多越好，每個索引都會增加寫入成本。只對「高頻查詢的過濾條件」建索引。

| 索引                  | 欄位                  | 類型     | 用途               |
| --------------------- | --------------------- | -------- | ------------------ |
| PRIMARY               | id                    | 主鍵索引 | 所有表的基礎       |
| uq_email              | email                 | 唯一索引 | 登入查詢 + 防重複  |
| idx_columnId_position | (column_id, position) | 複合索引 | 看板查詢主力索引   |
| idx_dueDate           | due_date              | 普通索引 | 逾期任務查詢       |
| idx_tokenHash         | token_hash            | 普通索引 | Refresh Token 查詢 |

**複合索引欄位順序說明（面試必問）：**

`(column_id, position)` 而不是 `(position, column_id)`，原因：

MySQL 的複合索引遵循**最左前綴原則**（Leftmost Prefix Rule）。`column_id` 選擇性（Cardinality）遠高於 `position`（每個欄位對應特定一組任務），放在左側可以最快縮小範圍。查詢只有 `position` 時無法使用此索引，但查詢只有 `column_id` 時可以用。

```sql
-- 這個查詢可以完整利用複合索引
SELECT * FROM tasks WHERE column_id = 1 ORDER BY position;

-- 用 EXPLAIN 驗證是否命中索引
EXPLAIN SELECT * FROM tasks WHERE column_id = 1 ORDER BY position;
-- 期望：type = 'ref', key = 'idx_columnId_position', Extra 沒有 Using filesort
```

### 7.2 核心查詢設計

#### 取得完整看板（最重要的查詢）

**問題：** 看板頁面需要取得一個 Board 的所有 Column 和 Task，最直覺的寫法是 N+1 查詢。

```typescript
// ❌ N+1 查詢問題（企業不可接受）
const board = await prisma.board.findUnique({ where: { id } });
const columns = await prisma.column.findMany({ where: { boardId: id } });
for (const column of columns) {
  // 每個欄位都打一次 DB，10 個欄位 = 11 次查詢
  column.tasks = await prisma.task.findMany({ where: { columnId: column.id } });
}
```

```typescript
// ✅ 單次查詢取得完整看板（Prisma 的 include）
const board = await prisma.board.findUnique({
  where: { id, userId }, // 確保只能存取自己的看板（安全性）
  include: {
    columns: {
      orderBy: { position: 'asc' },
      include: {
        tasks: {
          orderBy: { position: 'asc' },
          select: {
            // 只選需要的欄位，不 SELECT *
            id: true,
            title: true,
            priority: true,
            dueDate: true,
            position: true,
            createdAt: true,
          },
        },
      },
    },
  },
});
```

**Prisma 生成的 SQL（實際只執行 3 條，不是 N+1）：**

```sql
-- Query 1：取 board
SELECT id, user_id, name FROM boards WHERE id = ? AND user_id = ?;

-- Query 2：取所有 columns（一次拿完）
SELECT id, board_id, name, position FROM columns
WHERE board_id = ? ORDER BY position ASC;

-- Query 3：取所有 tasks（一次拿完，不是一個 column 一條）
SELECT id, column_id, title, priority, due_date, position
FROM tasks WHERE column_id IN (?, ?, ?, ...)
ORDER BY position ASC;
```

**面試說明要點：** 這是 Prisma 的 relation loading 優化，底層使用 `IN` 查詢而非迴圈，從 N+1 降到固定 3 次查詢，無論多少欄位都一樣。

#### 更新任務排序（拖拉後的批次更新）

```typescript
// ✅ 使用 Transaction 確保批次更新原子性
async function reorderTasks(updates: { id: number; position: number }[]) {
  // Transaction：所有更新成功才 commit，任一失敗全部 rollback
  return await prisma.$transaction(
    updates.map(({ id, position }) =>
      prisma.task.update({
        where: { id },
        data: { position },
      }),
    ),
  );
}
```

**面試說明：** 為什麼要用 Transaction？拖拉時可能同時更新多張卡片的 position（例如欄位裡的所有卡片重新排序），如果中途失敗只更新了一半，資料庫的排序就會錯亂。Transaction 確保原子性：全部成功或全部不動。

#### Refresh Token 查詢

```typescript
// ✅ 查詢有效的 Refresh Token
const token = await prisma.refreshToken.findFirst({
  where: {
    tokenHash,
    revokedAt: null, // 未被廢除
    expiresAt: { gt: new Date() }, // 未過期
  },
  include: { user: true }, // 同時取使用者資料，減少一次查詢
});

if (!token) throw new UnauthorizedException('Token 無效或已過期');
```

#### 逾期任務查詢

```typescript
// ✅ 查詢逾期任務（有 dueDate Index 加速）
const overdueTasks = await prisma.task.findMany({
  where: {
    dueDate: { lt: new Date() }, // 截止日 < 今天
    column: {
      board: { userId }, // 只查自己的看板（安全性）
    },
  },
  orderBy: { dueDate: 'asc' }, // 最早逾期的排前面
  take: 20, // 分頁，不一次拿全部
});
```

### 7.3 分頁策略

**Cursor-based Pagination（游標分頁）** vs **OFFSET 分頁**

```typescript
// ❌ OFFSET 分頁（資料量大時效能差）
// LIMIT 20 OFFSET 5000 = 實際掃描 5020 筆，只回傳 20 筆
const tasks = await prisma.task.findMany({
  skip: (page - 1) * limit, // OFFSET
  take: limit,
});

// ✅ 游標分頁（效能穩定，適合 Infinite Scroll）
// 直接從上一頁最後一筆的 id 開始，走 Primary Key Index
const tasks = await prisma.task.findMany({
  cursor: cursor ? { id: cursor } : undefined,
  take: limit,
  skip: cursor ? 1 : 0, // 跳過 cursor 那筆本身
  orderBy: { id: 'desc' },
});

// Response 帶 nextCursor 給前端
const nextCursor = tasks.length === limit ? tasks[tasks.length - 1].id : null;
return { data: tasks, nextCursor };
```

**本系統使用策略：**

- 看板任務：一次取全部（數量不會太多，且拖拉需要完整資料）
- 未來擴充的操作紀錄：游標分頁（適合 Infinite Scroll）
- 使用者列表：OFFSET 分頁（需要跳頁功能）

### 7.4 查詢優化審查結論

| 項目        | 狀態          | 說明                                    |
| ----------- | ------------- | --------------------------------------- |
| N+1 查詢    | ✅ 已解決     | 使用 Prisma include 一次取完            |
| 索引設計    | ✅ 符合標準   | 複合索引、唯一索引依查詢模式設計        |
| Transaction | ✅ 已使用     | 批次更新排序使用 Transaction 保證原子性 |
| SELECT \*   | ✅ 已優化     | 使用 select 只取需要的欄位              |
| 分頁        | ✅ 依場景選擇 | 游標分頁 vs OFFSET 分頁依需求使用       |
| 安全性      | ✅ 已保障     | 所有查詢帶 userId 條件，防止越權存取    |

---

## 8. AI 生成看板模組

### 8.1 功能流程

```
使用者點擊「AI 生成看板」
        ↓
前端 AiGenerateModal 顯示輸入框
        ↓
使用者輸入：「我要做一個電商網站，前後端分離，Vue + NestJS」
        ↓
前端帶 userId（localStorage UUID）送 POST /ai/generate
        ↓
後端查詢 Redis：ai_usage:{userId}
  ├─ count >= 5 → 回傳 429 + 剩餘重置時間
  └─ count < 5 → INCR count，設定 TTL 24hr（第一次呼叫時）
        ↓
後端組合 Prompt 呼叫 Gemini API
        ↓
解析回傳 JSON，驗證格式
        ↓
批次建立 Column + Task（Transaction）
        ↓
前端看板自動出現規劃好的任務
```

### 8.2 Prompt 設計

```
System Prompt：
你是一個敏捷開發專案規劃助手。

使用者會描述一個專案或功能需求，請你規劃適合 Kanban 看板的任務清單。

嚴格依照以下 JSON 格式回傳，不要有任何其他文字或 markdown：
{
  "columns": [
    {
      "name": "欄位名稱",
      "position": 0,
      "tasks": [
        {
          "title": "任務標題（簡潔，不超過 30 字）",
          "description": "任務描述（可選，說明具體工作內容）",
          "priority": "low" | "medium" | "high",
          "position": 0
        }
      ]
    }
  ]
}

規則：
- 欄位數量：3～5 個（建議：待辦 / 進行中 / 測試中 / 完成）
- 每個欄位任務數量：2～5 個
- priority 只能是 low / medium / high 三個值
- 使用繁體中文
- 只回傳純 JSON，不要有任何說明文字、不要有 markdown code block
```

### 8.3 Redis 次數限制實作

```typescript
// ai/ai.service.ts
async checkAndIncrementUsage(userId: string): Promise<number> {
  const key = `ai_usage:${userId}`

  const count = await this.redis.incr(key)

  // 第一次使用時設定 24 小時 TTL（之後的 INCR 不會重置 TTL）
  if (count === 1) {
    await this.redis.expire(key, 86400)
  }

  if (count > 5) {
    // 取得剩餘重置時間，告訴使用者幾小時後可以再用
    const ttl = await this.redis.ttl(key)
    throw new TooManyRequestsException(`今日使用次數已達上限，${Math.ceil(ttl / 3600)} 小時後重置`)
  }

  return 5 - count  // 回傳剩餘次數
}
```

**為什麼用 Redis 而不用 MySQL 記次數？**

1. Redis 的 INCR 是原子操作，高併發下不會有競態條件（Race Condition）
2. TTL 自動過期，不需要額外寫排程清除過期資料
3. 讀寫次數計數是高頻操作，Redis 在記憶體中操作遠快於 MySQL 磁碟 I/O

---

## 9. 專案目錄結構

### 9.1 後端（NestJS）

```
backend/
├── src/
│   ├── main.ts                          # bootstrap、全域設定
│   ├── app.module.ts                    # 根模組
│   │
│   ├── auth/
│   │   ├── auth.controller.ts           # POST /auth/register|login|refresh|logout
│   │   │                                # GET  /auth/google | /auth/google/callback
│   │   ├── auth.service.ts              # JWT 簽發、bcrypt、Token Rotation、Google OAuth
│   │   ├── auth.module.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts          # 從 Header 解析 Access Token
│   │   │   └── google.strategy.ts       # Passport Google OAuth 策略
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts        # 驗證 JWT，注入 user 到 Request
│   │   │   └── google-oauth.guard.ts    # 觸發 Google OAuth 流程
│   │   └── dto/
│   │       ├── login.dto.ts
│   │       └── register.dto.ts
│   │
│   ├── boards/
│   │   ├── boards.controller.ts         # CRUD
│   │   ├── boards.service.ts            # 業務邏輯（驗證所有權 / 成員權限）
│   │   ├── boards.module.ts
│   │   └── dto/
│   │       ├── create-board.dto.ts
│   │       └── update-board.dto.ts
│   │
│   ├── board-members/
│   │   ├── board-members.controller.ts  # 邀請/移除/更改角色
│   │   ├── board-members.service.ts     # 角色驗證邏輯
│   │   ├── board-members.module.ts
│   │   └── dto/
│   │       ├── invite-member.dto.ts     # { email, role }
│   │       └── update-role.dto.ts       # { role }
│   │
│   ├── columns/
│   │   ├── columns.controller.ts
│   │   ├── columns.service.ts
│   │   ├── columns.module.ts
│   │   └── dto/
│   │
│   ├── tasks/
│   │   ├── tasks.controller.ts          # CRUD + PATCH /tasks/:id/move
│   │   ├── tasks.service.ts             # 業務邏輯、樂觀更新支援
│   │   ├── tasks.module.ts
│   │   └── dto/
│   │       ├── create-task.dto.ts
│   │       ├── update-task.dto.ts
│   │       └── move-task.dto.ts         # { columnId, position }
│   │
│   ├── labels/
│   │   ├── labels.controller.ts         # CRUD
│   │   ├── labels.service.ts
│   │   ├── labels.module.ts
│   │   └── dto/
│   │       ├── create-label.dto.ts      # { name, color }
│   │       └── update-label.dto.ts
│   │
│   ├── ai/
│   │   ├── ai.controller.ts             # POST /ai/generate
│   │   ├── ai.service.ts                # Gemini 呼叫、次數限制
│   │   ├── ai.module.ts
│   │   └── dto/
│   │       └── generate-board.dto.ts    # { prompt: string }
│   │
│   ├── redis/
│   │   ├── redis.service.ts             # Redis 操作封裝
│   │   └── redis.module.ts              # @Global() 全域注入
│   │
│   ├── prisma/
│   │   ├── prisma.service.ts            # PrismaClient 封裝
│   │   └── prisma.module.ts             # @Global() 全域注入
│   │
│   └── common/
│       ├── filters/
│       │   └── global-exception.filter.ts
│       ├── interceptors/
│       │   ├── transform.interceptor.ts  # 統一 Response 格式
│       │   └── logging.interceptor.ts    # 請求耗時 Log
│       ├── decorators/
│       │   └── current-user.decorator.ts # @CurrentUser() 取 JWT payload
│       └── dto/
│           └── pagination.dto.ts         # page, limit 通用 DTO
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── prisma.config.ts                     # Prisma 7 新設定檔（含 DATABASE_URL）
├── docker-compose.yml
├── .env
├── .env.example
└── tsconfig.json
```

### 9.2 前端（Vue 3）

```
frontend/
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── BaseButton.vue
│   │   │   ├── BaseInput.vue
│   │   │   ├── BaseModal.vue
│   │   │   ├── BaseBadge.vue
│   │   │   └── BaseSpinner.vue
│   │   ├── board/
│   │   │   ├── BoardColumn.vue
│   │   │   ├── TaskCard.vue            # 純展示
│   │   │   ├── TaskCardDraggable.vue   # 拖拉包裝
│   │   │   ├── TaskDetailModal.vue     # 詳情 + 編輯
│   │   │   └── TaskCreateForm.vue      # 新增表單
│   │   └── ai/
│   │       ├── AiGenerateButton.vue    # 含剩餘次數顯示
│   │       └── AiGenerateModal.vue     # 輸入 + 生成中狀態
│   │
│   ├── views/
│   │   ├── LoginView.vue
│   │   ├── BoardListView.vue           # 看板列表
│   │   └── BoardView.vue              # 看板主頁面
│   │
│   ├── layouts/
│   │   ├── AppLayout.vue              # 含 Header 的已登入 Layout
│   │   └── AuthLayout.vue             # 無 Header 的登入 Layout
│   │
│   ├── router/
│   │   └── index.ts                   # beforeEach：未登入導向 /login
│   │
│   ├── stores/
│   │   ├── auth.ts                    # user, accessToken, login(), logout(), refresh()
│   │   └── board.ts                   # boards, columns, tasks, snapshot/restore
│   │
│   ├── composables/
│   │   ├── useAuth.ts
│   │   ├── useDragAndDrop.ts          # 樂觀更新 + 回滾
│   │   ├── useAiGenerate.ts           # AI 生成流程
│   │   └── useLocalUUID.ts            # 訪客 UUID 管理
│   │
│   ├── api/
│   │   ├── client.ts                  # Axios instance + Token 刷新 Interceptor
│   │   ├── auth.ts
│   │   ├── boards.ts
│   │   ├── columns.ts
│   │   ├── tasks.ts
│   │   └── ai.ts
│   │
│   └── types/
│       └── index.ts                   # Board, Column, Task, User 型別定義
│
└── vite.config.ts
```

---

## 10. API 設計規格

| Method       | Path                         | 說明                                | 驗證              |
| ------------ | ---------------------------- | ----------------------------------- | ----------------- |
| **身分驗證** |
| POST         | /auth/register               | Email 註冊                          | 無                |
| POST         | /auth/login                  | Email 登入，回傳 Access Token       | 無                |
| GET          | /auth/google                 | 發起 Google OAuth 授權              | 無                |
| GET          | /auth/google/callback        | Google 回呼，簽發 JWT               | 無                |
| POST         | /auth/refresh                | 刷新 Access Token                   | Cookie            |
| POST         | /auth/logout                 | 登出，清除 Refresh Token            | JWT               |
| **看板**     |
| GET          | /boards                      | 取得我的看板列表（含成員的看板）    | JWT               |
| POST         | /boards                      | 建立看板                            | JWT               |
| GET          | /boards/:id                  | 取得看板完整資料（含欄位和任務）    | JWT + 成員檢查    |
| PUT          | /boards/:id                  | 更新看板名稱/背景色                 | JWT + admin/owner |
| DELETE       | /boards/:id                  | 刪除看板                            | JWT + owner 限定  |
| **看板成員** |
| GET          | /boards/:id/members          | 取得看板成員列表                    | JWT + 成員檢查    |
| POST         | /boards/:id/members          | 邀請成員 `{ email, role }`          | JWT + admin/owner |
| PATCH        | /boards/:id/members/:userId  | 更改成員角色                        | JWT + admin/owner |
| DELETE       | /boards/:id/members/:userId  | 移除成員                            | JWT + admin/owner |
| **欄位**     |
| POST         | /boards/:id/columns          | 新增欄位                            | JWT + member+     |
| PUT          | /columns/:id                 | 更新欄位名稱                        | JWT + member+     |
| PATCH        | /columns/:id/reorder         | 更新欄位排序                        | JWT + member+     |
| DELETE       | /columns/:id                 | 刪除欄位                            | JWT + member+     |
| **任務**     |
| POST         | /tasks                       | 新增任務 `{ columnId, ... }`        | JWT + member+     |
| PUT          | /tasks/:id                   | 更新任務（標題/描述/優先級/連結等） | JWT + member+     |
| PATCH        | /tasks/:id/move              | 拖拉移動 `{ columnId, position }`   | JWT + member+     |
| DELETE       | /tasks/:id                   | 刪除任務                            | JWT + member+     |
| POST         | /tasks/:id/assignees         | 指派成員 `{ userId }`               | JWT + member+     |
| DELETE       | /tasks/:id/assignees/:userId | 移除指派                            | JWT + member+     |
| **標籤**     |
| GET          | /boards/:id/labels           | 取得看板標籤列表                    | JWT + 成員檢查    |
| POST         | /boards/:id/labels           | 建立標籤 `{ name, color }`          | JWT + member+     |
| PUT          | /labels/:id                  | 更新標籤名稱/顏色                   | JWT + member+     |
| DELETE       | /labels/:id                  | 刪除標籤                            | JWT + member+     |
| POST         | /tasks/:id/labels            | 為任務貼標籤 `{ labelId }`          | JWT + member+     |
| DELETE       | /tasks/:id/labels/:labelId   | 移除任務標籤                        | JWT + member+     |
| **AI 生成**  |
| POST         | /ai/generate                 | AI 生成看板                         | JWT               |
| GET          | /ai/usage                    | 查詢今日剩餘次數                    | JWT               |
| **其他**     |
| GET          | /health                      | 健康檢查                            | 無                |

> **權限說明：**
>
> - `成員檢查`：必須是此看板的成員（任意角色）
> - `member+`：需要 member 或 admin 角色（guest 無法操作）
> - `admin/owner`：需要 admin 角色或看板擁有者
> - `owner 限定`：只有看板 ownerId 才能操作（如刪除看板）

---

## 11. 環境變數管理

```bash
# backend/.env.example

# ── Database ───────────────────────────────────────
DATABASE_URL="mysql://root:password@localhost:3306/task_management"

# ── JWT ────────────────────────────────────────────
JWT_SECRET=your_jwt_secret_at_least_32_characters
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=different_secret_from_jwt_secret
JWT_REFRESH_EXPIRES_IN=7d

# ── Redis ──────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379

# ── AI ─────────────────────────────────────────────
GEMINI_API_KEY=your_gemini_api_key
AI_DAILY_LIMIT=5

# ── App ────────────────────────────────────────────
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# ── Rate Limiting ──────────────────────────────────
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

---

## 12. 開發時程規劃

| 天數     | 目標         | 驗收標準                                                    |
| -------- | ------------ | ----------------------------------------------------------- |
| Day 1    | 環境建立     | Docker Compose 跑起來、NestJS + Vue 初始化、Prisma 連線成功 |
| Day 2    | JWT 登入     | 註冊、登入、Token Rotation 跑通，Axios Interceptor 自動刷新 |
| Day 3～4 | 看板 CRUD    | Board / Column / Task API 完成，Prisma include 一次取完看板 |
| Day 5～6 | 前端看板頁面 | 元件拆分完成，與 API 串接，拖拉 UI 顯示正確                 |
| Day 7    | 拖拉排序     | 樂觀更新 + 回滾，批次 position 更新使用 Transaction         |
| Day 8～9 | AI 生成看板  | Gemini 串接、Redis 次數限制、前端 Modal 完整流程            |
| Day 10   | 收尾         | Swagger 文件、README、本機 Demo 測試完整                    |

> **Day 10 完成後：** 部署至 AWS EC2 + CloudFront，前端發布至 Vercel。

---

## 13. 面試準備：核心問答

| 面試官問                                                | 回答要點                                                                                                                                                                                                                                  |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 為什麼選 Prisma 不用 TypeORM？                          | Prisma 的型別安全更完整（schema 即型別），Migration 工具穩定，開發效率高。TypeORM 的 decorator 設計容易出現隱性 N+1，Prisma 的 include 語意更清晰                                                                                         |
| 怎麼避免 N+1 查詢？                                     | 取得看板時用 Prisma 的 include 一次拿完所有 column 和 task，底層是 IN 查詢而非迴圈，固定 3 次 Query 不受欄位數量影響                                                                                                                      |
| 索引怎麼設計的？                                        | 複合索引 (column_id, position) 對應看板最常見的查詢模式。欄位順序依選擇性決定，column_id 選擇性高放左側，遵循最左前綴原則                                                                                                                 |
| Redis 在你的系統裡做什麼？                              | AI 使用次數計數。用 INCR 原子操作避免競態條件，TTL 自動過期省去排程清除，高頻讀寫比 MySQL 更適合                                                                                                                                          |
| 樂觀更新怎麼實作的？                                    | 拖拉前 takeSnapshot() 深拷貝狀態，先更新 UI，API 成功就結束，失敗則 restoreSnapshot() 回滾，並 toast 提示錯誤                                                                                                                             |
| 元件怎麼拆分的？                                        | TaskCard 只管展示，拖拉邏輯在 TaskCardDraggable，業務流程在 useDragAndDrop composable，API 呼叫在 tasks.ts。每層只做自己該做的事                                                                                                          |
| 為什麼 BaseModal 用 slot 設計？                         | Modal 容器只管遮罩和關閉邏輯，內容由外部傳入，可複用於任何場景。這是 Headless Component 的設計思路                                                                                                                                        |
| 部署架構怎麼設計的？                                    | 後端部署在 AWS EC2 t3.micro，用 Docker Compose 統一管理 NestJS、MySQL、Redis，Nginx 做反向代理。前端 Vue SPA 部署在 Vercel，享有全球 CDN。CloudFront 放在 EC2 前面負責 HTTPS 終止與 CDN 加速，不需要 ALB 因為是單機展示，這樣費用幾乎為零 |
| 為什麼不用 RDS？                                        | 作品展示不需要 RDS 的高可用與自動備份，MySQL 跑在同一台 EC2 的 Docker 容器就夠，減少不必要的成本。若未來需要水平擴展再遷移到 RDS                                                                                                          |
| 為什麼不用 ALB？                                        | ALB 按運行小時計費，單機展示不需要負載均衡，省去每月約 $16 的固定費用。若架構升級成多台 EC2 才有引入 ALB 的必要                                                                                                                           |
| Nginx 在架構裡做什麼？                                  | 作為反向代理，監聽 Port 80 將流量轉發到 NestJS Port 3000。處理 gzip 壓縮、隱藏後端 Port，未來也可以加 SSL 終止或靜態檔案服務                                                                                                              |
| Google OAuth 和 Email 登入怎麼共存？                    | 用 auth_provider 欄位（enum: email/google）區分，同一個 email 只能對應一種方式。用錯方式登入時回傳明確錯誤：「此帳號已用 Google 登入，請改用 Google 繼續」。password_hash 對 Google 使用者允許 NULL，google_id 有唯一索引防重複           |
| 為什麼 task assignee FK 指向 users 而非 board_members？ | board_members 是可變的關係——成員可能被移出看板，但他已建立或被指派的任務資料不應消失。FK → users.id 確保資料完整性，board membership 的驗證在應用層執行（指派時確認 user 是成員，但移除成員後指派記錄保留）                               |
| 標籤為什麼是 board-level 而非 global？                  | 不同看板語意相同但色系不同的標籤（如各專案的「緊急」），全域標籤管理界面複雜且要解決多人管理問題。Trello、JIRA 都是 board-level，是業界驗證過的設計                                                                                       |
| 看板角色系統怎麼設計的？                                | 三種角色：admin（完整控制）、member（CRUD 任務欄位）、guest（唯讀，預留）。看板 owner 是特殊欄位（boards.owner_id），永遠只有一個，admin 可以有多個。建立看板時 owner 自動寫入 board_members 為 admin                                     |
