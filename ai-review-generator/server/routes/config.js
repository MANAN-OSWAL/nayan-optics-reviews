/**
 * config.js
 * GET /api/config — returns the safe public subset of config.
 * API keys and internal server settings are never exposed.
 */

import { Router } from 'express';
import { getAll } from '../services/configService.js';

const router = Router();

router.get('/', (_req, res) => {
  const config = getAll();

  // Return only the fields safe for the browser — never expose API keys
  const safeConfig = {
    shopName: config.shopName,
    googleMapsLink: config.googleMapsLink,
    languages: config.languages,
    tones: config.tones,
    categories: config.categories,
    defaultTone: config.defaultTone,
  };

  res.json(safeConfig);
});

export default router;
