import { config as loadEnv } from "dotenv"
import { defineConfig, env } from "prisma/config"

// Next.js читает .env.local, Prisma CLI по умолчанию — .env. Держим один файл
// (.env.local) источником правды для обоих, чтобы не дублировать переменные.
loadEnv({ path: ".env.local", quiet: true })

// Используется только CLI-командами (migrate/studio/generate).
// Рантайм-подключение (PrismaClient) настроено отдельно в lib/prisma.ts через driver adapter.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "node --experimental-strip-types prisma/seed.ts",
  },
})
