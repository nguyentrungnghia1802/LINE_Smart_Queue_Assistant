import dotenv from 'dotenv';
import path from 'node:path';

// Load .env from monorepo root when running locally
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  nodeEnv: (process.env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test',
  port: Number.parseInt(process.env.API_PORT ?? '4000', 10),
  host: process.env.API_HOST ?? '0.0.0.0',

  database: {
    url: process.env.DATABASE_URL ?? '',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    name: process.env.DB_NAME ?? 'line_queue',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },

  line: {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
    channelSecret: process.env.LINE_CHANNEL_SECRET ?? '',
  },

  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  },
} as const;
