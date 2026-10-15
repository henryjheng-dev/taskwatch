import Joi from 'joi';

export const envValidationSchema = Joi.object({
  // ── Application ──────────────────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  // 強制檢查 CORS 來源，避免跨域請求遭任意網站存取
  CORS_ORIGIN: Joi.string().uri().required(),

  // ── Database ────────────────────────────────────────────────
  DATABASE_URL: Joi.string().uri().required(),
  DB_HOST: Joi.string().required(),
  // TCP port 合法範圍 1~65535
  DB_PORT: Joi.number().integer().min(1).max(65535).required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  // 是否啟用 DB TLS 連線（'true'/'false'），生產環境建議設 'true'
  DB_SSL: Joi.string().valid('true', 'false').default('false'),

  // ── JWT ───────────────────────────────────────────────────
  // 亂碼：最少 32 字元 (256-bit等級的演算法)，防止暴力破解
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().required(),

  // ── Google OAuth ──────────────────────────────────────────
  // 身份識別碼，給 Google 確認請求是來自哪個網站
  GOOGLE_CLIENT_ID: Joi.string().required(),

  // ── Gemini AI ────────────────────────────────────────────
  GEMINI_API_KEY: Joi.string().required(),
  // Gemini API 限額 : 一個帳號先暫定每日 5 次
  AI_DAILY_LIMIT: Joi.number().integer().min(1).default(5),

  // ── Redis ─────────────────────────────────────────────────
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().default(6379),

  // ── Rate Limiting ─────────────────────────────────────────
  THROTTLE_TTL: Joi.number().integer().min(1).default(60),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),
  // 單位：秒
  THROTTLE_BLOCK_DURATION: Joi.number().integer().min(1).default(900),
});
