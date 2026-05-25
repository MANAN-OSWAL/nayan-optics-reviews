/**
 * promptLoader.js
 * Loads prompt template files from the prompts/ directory and interpolates
 * {{placeholder}} variables. Caches loaded templates in memory.
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, '..', '..', 'prompts');

/** @type {Map<string, string>} In-memory cache of raw template strings keyed by file path */
const _cache = new Map();

/**
 * Build the file path for a given category + language combination.
 * Naming convention: {category_id}_{language_code}.txt (lowercase, underscore separator)
 * @param {string} category - e.g. "new_glasses"
 * @param {string} language - e.g. "en" or "mr"
 * @returns {string} absolute file path
 */
export function buildTemplatePath(category, language) {
  return join(PROMPTS_DIR, `${category.toLowerCase()}_${language.toLowerCase()}.txt`);
}

/**
 * Load a prompt template for the given category and language.
 * Falls back to the English template + appended language instruction if the
 * target language file does not exist.
 *
 * @param {string} category - Service category ID (e.g. "new_glasses")
 * @param {string} language - Language code (e.g. "en", "mr")
 * @returns {string} Raw template string (with {{placeholder}} tokens intact)
 */
export function load(category, language) {
  const targetPath = buildTemplatePath(category, language);

  if (_cache.has(targetPath)) {
    return _cache.get(targetPath);
  }

  if (existsSync(targetPath)) {
    const template = readFileSync(targetPath, 'utf-8');
    _cache.set(targetPath, template);
    return template;
  }

  // Fallback: load English template and append language instruction
  const englishPath = buildTemplatePath(category, 'en');

  if (!existsSync(englishPath)) {
    throw new Error(
      `[promptLoader] No template found for category "${category}" in any language. ` +
      `Expected file: ${englishPath}`
    );
  }

  let englishTemplate;
  if (_cache.has(englishPath)) {
    englishTemplate = _cache.get(englishPath);
  } else {
    englishTemplate = readFileSync(englishPath, 'utf-8');
    _cache.set(englishPath, englishTemplate);
  }

  const fallbackTemplate = `${englishTemplate}\n\nIMPORTANT: Respond entirely in ${language}. Do not use English.`;
  _cache.set(targetPath, fallbackTemplate);
  return fallbackTemplate;
}

/**
 * Interpolate {{key}} placeholders in a template string with values from a vars object.
 * Unmatched placeholders are left as-is.
 *
 * @param {string} template - Raw template string
 * @param {Record<string, string|number>} vars - Key-value substitution map
 * @returns {string} Interpolated string
 */
export function interpolate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in vars ? String(vars[key]) : match;
  });
}

/**
 * Clear the template cache (useful for testing).
 */
export function clearCache() {
  _cache.clear();
}
