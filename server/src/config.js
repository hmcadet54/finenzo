import 'dotenv/config';

const list = (v) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://finenzo.velqisavora.space',
  '*.velqisavora.space',
  '*.vercel.app',
];

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/finenzo',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-insecure-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  clientOrigins: Array.from(new Set([...defaultOrigins, ...list(process.env.CLIENT_ORIGIN)])),
  defaultTimezone: process.env.DEFAULT_TIMEZONE ?? 'Asia/Karachi',
};

export function assertProductionConfig() {
  if (config.env === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
      throw new Error('JWT_SECRET must be set (24+ chars) in production');
    }
    if (!config.googleClientId) throw new Error('GOOGLE_CLIENT_ID must be set in production');
  }
}
