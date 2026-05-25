/**
 * fallbackService.js
 * Serves pre-written reviews from the fallback/ directory when all LLM
 * backends are unreachable. Validates minimum pool size at startup.
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getAll as getConfig } from './configService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FALLBACK_DIR = join(__dirname, '..', '..', 'fallback');
const MIN_POOL_SIZE = 10;

/** @type {Map<string, string[]>} Cache of review arrays keyed by "{category}_{language}" */
const _cache = new Map();

/**
 * Build the cache key for a category + language combination.
 * @param {string} category
 * @param {string} language
 * @returns {string}
 */
function _cacheKey(category, language) {
  return `${category}_${language}`;
}

/**
 * Load and validate a fallback pool file.
 * @param {string} category
 * @param {string} language
 * @returns {string[]} Array of review strings
 */
export function load(category, language) {
  const key = _cacheKey(category, language);
  if (_cache.has(key)) {
    return _cache.get(key);
  }

  const filePath = join(FALLBACK_DIR, `${category}_${language}.json`);

  if (!existsSync(filePath)) {
    throw new Error(
      `[fallbackService] Fallback pool file not found: ${filePath}`
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    throw new Error(`[fallbackService] Failed to parse ${filePath}: ${err.message}`);
  }

  if (!Array.isArray(parsed.reviews)) {
    throw new Error(`[fallbackService] ${filePath} must have a "reviews" array`);
  }

  if (parsed.reviews.length < MIN_POOL_SIZE) {
    throw new Error(
      `[fallbackService] ${filePath} has only ${parsed.reviews.length} reviews; ` +
      `minimum required is ${MIN_POOL_SIZE}`
    );
  }

  _cache.set(key, parsed.reviews);
  return parsed.reviews;
}

/**
 * Fisher-Yates shuffle (in-place on a copy).
 * @param {Array} arr
 * @returns {Array} shuffled copy
 */
function _shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Get a shuffled set of fallback reviews.
 * @param {string} category
 * @param {string} language
 * @param {number} count - Number of reviews to return
 * @returns {{ id: string, text: string }[]}
 */
export function getReviews(category, language, count) {
  const pool = load(category, language);
  const shuffled = _shuffle(pool);
  return shuffled.slice(0, count).map((text) => ({
    id: uuidv4(),
    text,
  }));
}

/**
 * Validate all fallback pools defined in config exist and meet minimum size.
 * Called at server startup. Throws on first failure.
 */
export function validateAllPools() {
  const config = getConfig();
  const { categories, languages } = config;

  for (const category of categories) {
    for (const lang of languages) {
      load(category.id, lang.code); // throws if missing or too small
    }
  }
}
