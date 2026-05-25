/**
 * health.js
 * GET /api/health — reports the current backend status.
 */

import { Router } from 'express';
import { checkHealth } from '../services/llmService.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const { status, backend } = await checkHealth();
    res.json({ status, backend, timestamp: Date.now() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
