import mongoose from 'mongoose';
import { assertProductionConfig, config } from './config.js';
import { createApp } from './app.js';

assertProductionConfig();
mongoose.set('strictQuery', true);

await mongoose.connect(config.mongoUri);
const safeUri = config.mongoUri.replace(/:([^:@]+)@/, ':****@');
console.log(`Connected to MongoDB at ${safeUri}`);

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`Finenzo API listening on :${config.port}`);
});

const shutdown = () => {
  server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
