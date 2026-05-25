/**
 * generate.js
 * POST /api/generate — validates input and delegates to llmService.
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { get as getConfig } from '../services/configService.js';
import { generateReviews } from '../services/llmService.js';

const router = Router();

router.post('/', async (req, res) => {
  const { category, language, tone, seed, count } = req.body ?? {};

  // --- Input validation ---
  const errors = [];
  if (!category || typeof category !== 'string') errors.push('category');
  if (!language || typeof language !== 'string') errors.push('language');
  if (!tone || typeof tone !== 'string') errors.push('tone');

  if (errors.length > 0) {
    return res.status(400).json({
      error: `Missing or invalid required field(s): ${errors.join(', ')}`,
    });
  }

  // Validate category exists in config
  const validCategories = getConfig('categories').map((c) => c.id);
  if (!validCategories.includes(category)) {
    return res.status(400).json({
      error: `Unknown category "${category}". Valid values: ${validCategories.join(', ')}`,
    });
  }

  // Validate language exists in config
  const validLanguages = getConfig('languages').map((l) => l.code);
  if (!validLanguages.includes(language)) {
    return res.status(400).json({
      error: `Unknown language "${language}". Valid values: ${validLanguages.join(', ')}`,
    });
  }

  // Validate tone exists in config
  const validTones = getConfig('tones').map((t) => t.id);
  if (!validTones.includes(tone)) {
    return res.status(400).json({
      error: `Unknown tone "${tone}". Valid values: ${validTones.join(', ')}`,
    });
  }

  try {
    const result = await generateReviews({
      category,
      language,
      tone,
      seed: seed ?? uuidv4(),
      count: typeof count === 'number' ? count : getConfig('generation').count,
    });

    return res.json(result);
  } catch (err) {
    console.error('[/api/generate] Error:', err.message);
    return res.status(503).json({ error: err.message });
  }
});

export default router;
