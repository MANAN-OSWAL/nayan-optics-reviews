/**
 * server/index.js
 * Express application entry point.
 * Mounts all API routes and serves the frontend as static files.
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Config must be imported first — it validates config.json at module load time
import { getAll } from './services/configService.js';

import healthRouter from './routes/health.js';
import configRouter from './routes/config.js';
import generateRouter from './routes/generate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Validate config at startup — exit with a clear message if invalid
let config;
try {
  config = getAll();
} catch (err) {
  console.error('❌ Server startup failed — invalid configuration:');
  console.error(err.message);
  process.exit(1);
}

const app = express();

// --- Middleware ---
app.use(express.json());

// --- API Routes ---
app.use('/api/health', healthRouter);
app.use('/api/config', configRouter);
app.use('/api/generate', generateRouter);

// --- Static Frontend ---
const frontendDir = join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

// Catch-all: serve index.html for any non-API route (SPA support)
app.get('*', (_req, res) => {
  res.sendFile(join(frontendDir, 'index.html'));
});

// --- Start Server ---
// Render injects PORT as an env var; configService already reads it.
// We re-read here after config is loaded so the value is always current.
const port = process.env.PORT || config.server?.port || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Nayan Optics AI Review Generator`);
  console.log(`   Backend : ${config.backend}`);
  console.log(`   Running : http://localhost:${port}`);
});
