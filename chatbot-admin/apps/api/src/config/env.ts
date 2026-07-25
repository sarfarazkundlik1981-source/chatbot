import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/chatbot"),
  APP_BASE_URL: z.string().default("http://localhost:4000"),
  DASHBOARD_URL: z.string().default("http://localhost:3000"),
  JWT_SECRET: z.string().default("dev-jwt-secret"),
  ENCRYPTION_KEY: z.string().default("0123456789abcdef0123456789abcdef"),
  REQUEST_ID_HEADER: z.string().default("x-request-id"),
  DEFAULT_CONFIG_CACHE_TTL_SECONDS: z.coerce.number().default(300),
  PLATFORM_OWNER_EMAIL: z.string().default("owner@example.com"),
  PLATFORM_OWNER_PASSWORD: z.string().default("change-me-now"),
  OPENROUTER_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),
  SESSION_TTL_HOURS: z.coerce.number().default(24),
  MINIMUM_SUPPORTED_PLUGIN_VERSION: z.string().default("0.1.0"),
  RECOMMENDED_PLUGIN_VERSION: z.string().default("0.1.0"),
  MINIMUM_WORDPRESS_VERSION: z.string().default("6.5.0"),
  MINIMUM_PHP_VERSION: z.string().default("8.1.0"),
  PUBLIC_JSON_BODY_LIMIT: z.string().default("32kb"),
  RESEND_API_KEY: z.string().optional()
});

export const env = envSchema.parse(process.env);
