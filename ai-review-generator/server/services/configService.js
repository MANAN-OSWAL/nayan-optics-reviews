/**
 * configService.js
 * Loads, validates, and caches config.json at module initialisation.
 * Environment variables take precedence over config.json values for secrets.
 *
 * Supported environment variables:
 *   BACKEND          — overrides config.backend ("mock"|"ollama"|"openai"|"gemini")
 *   GEMINI_API_KEY   — overrides config.gemini.apiKey
 *   OPENAI_API_KEY   — overrides config.openai.apiKey
 *   PORT             — overrides config.server.port (Render sets this automatically)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', '..', 'config.json');

const REQUIRED_KEYS = [
  'shopName',
  'backend',
  'categories',
  'languages',
  'tones',
  'generation',
  'history',
];

let _config = null;

/**
 * Load config.json and overlay environment variable overrides.
 * @returns {object} merged config object
 */
function _load() {
  let raw;
  try {
    raw = readFileSync(CONFIG_PATH, 'utf-8');
  } catch (err) {
    throw new Error(`[configService] Cannot read config.json at ${CONFIG_PATH}: ${err.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`[configService] config.json is not valid JSON: ${err.message}`);
  }

  const missing = REQUIRED_KEYS.filter((k) => !(k in parsed));
  if (missing.length > 0) {
    throw new Error(
      `[configService] config.json is missing required key(s): ${missing.join(', ')}`
    );
  }

  // --- Environment variable overrides (secrets never go in config.json) ---

  // Backend selection
  if (process.env.BACKEND) {
    parsed.backend = process.env.BACKEND;
  }

  // Gemini API key
  if (process.env.GEMINI_API_KEY) {
    parsed.gemini = { ...parsed.gemini, apiKey: process.env.GEMINI_API_KEY };
  }

  // OpenAI API key
  if (process.env.OPENAI_API_KEY) {
    parsed.openai = { ...parsed.openai, apiKey: process.env.OPENAI_API_KEY };
  }

  // Port — Render injects PORT automatically; fall back to config, then 3000
  if (process.env.PORT) {
    parsed.server = { ...parsed.server, port: parseInt(process.env.PORT, 10) };
  }

  return parsed;
}

// Initialise on first import
_config = _load();

/**
 * Get a top-level config value by key.
 * @param {string} key
 * @returns {*}
 */
export function get(key) {
  return _config[key];
}

/**
 * Get the full config object.
 * @returns {object}
 */
export function getAll() {
  return _config;
}
