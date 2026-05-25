/**
 * llmService.js
 * Orchestrates LLM adapter selection, health-check cascade, prompt construction,
 * word-count validation, retry logic, and fallback activation.
 */

import { v4 as uuidv4 } from 'uuid';
import { get as getConfig } from './configService.js';
import { load as loadPrompt, interpolate } from './promptLoader.js';
import { getReviews as getFallbackReviews } from './fallbackService.js';
import { MockAdapter } from '../adapters/mockAdapter.js';
import { OllamaAdapter } from '../adapters/ollamaAdapter.js';
import { OpenAIAdapter } from '../adapters/openaiAdapter.js';
import { GeminiAdapter } from '../adapters/geminiAdapter.js';

// Adapter singletons — instantiated once
const _adapters = {
  mock: new MockAdapter(),
  ollama: new OllamaAdapter(),
  openai: new OpenAIAdapter(),
  gemini: new GeminiAdapter(),
};

/**
 * Return the primary adapter based on config.backend.
 * @returns {import('../adapters/adapterInterface.js').LLMAdapter}
 */
export function getAdapter() {
  const backend = getConfig('backend');
  const adapter = _adapters[backend];
  if (!adapter) {
    throw new Error(`[llmService] Unknown backend "${backend}". Valid values: mock, ollama, openai, gemini`);
  }
  return adapter;
}

/**
 * Return the cloud fallback adapter (openai or gemini) if configured and different
 * from the primary backend.
 * @returns {import('../adapters/adapterInterface.js').LLMAdapter|null}
 */
function _getCloudAdapter() {
  const primary = getConfig('backend');
  const openaiKey = getConfig('openai')?.apiKey;
  const geminiKey = getConfig('gemini')?.apiKey;

  if (primary !== 'openai' && openaiKey) return _adapters.openai;
  if (primary !== 'gemini' && geminiKey) return _adapters.gemini;
  return null;
}

/**
 * Count words in a string.
 * @param {string} text
 * @returns {number}
 */
function _wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Validate that a review text meets the configured word-count range.
 * @param {string} text
 * @returns {boolean}
 */
export function validateWordCount(text) {
  const { minWords, maxWords } = getConfig('generation');
  const count = _wordCount(text);
  return count >= minWords && count <= maxWords;
}

/**
 * Perform a health-check cascade: primary → cloud → fallback.
 * @returns {Promise<{ status: 'ok'|'degraded', backend: string }>}
 */
export async function checkHealth() {
  const primary = getAdapter();
  const primaryName = getConfig('backend');

  if (await primary.healthCheck()) {
    return { status: 'ok', backend: primaryName };
  }

  const cloud = _getCloudAdapter();
  if (cloud) {
    const cloudName = getConfig('openai')?.apiKey ? 'openai' : 'gemini';
    if (await cloud.healthCheck()) {
      return { status: 'ok', backend: cloudName };
    }
  }

  return { status: 'degraded', backend: 'fallback' };
}

/**
 * Generate a batch of unique reviews for the given parameters.
 *
 * @param {object} params
 * @param {string} params.category   - Service category ID
 * @param {string} params.language   - Language code
 * @param {string} params.tone       - Tone ID
 * @param {string} [params.seed]     - Variation seed (UUID); generated if omitted
 * @param {number} [params.count]    - Number of reviews; defaults to config value
 * @returns {Promise<{ reviews: {id:string, text:string}[], backend: string, fallback: boolean }>}
 */
export async function generateReviews({ category, language, tone, seed, count }) {
  const genConfig = getConfig('generation');
  const shopName = getConfig('shopName');
  const resolvedCount = count ?? genConfig.count;
  // Always generate a fresh seed so every call (including "Generate New") produces
  // a different shuffle / variation — never reuse the caller-supplied seed directly.
  const resolvedSeed = uuidv4();

  // Determine active adapter via health-check cascade
  const health = await checkHealth();
  const useFallback = health.backend === 'fallback';
  const isMock = getConfig('backend') === 'mock';

  // Mock mode and full-fallback mode both serve from the fallback pool,
  // but mock mode is healthy — we just want real category/language-aware reviews.
  if (useFallback || isMock) {
    const reviews = getFallbackReviews(category, language, resolvedCount);
    const backend = isMock ? 'mock' : 'fallback';
    return { reviews, backend, fallback: isMock ? false : true };
  }

  const activeBackend = health.backend;
  const adapter = _adapters[activeBackend];

  // Load the raw prompt template once
  const rawTemplate = loadPrompt(category, language);

  const reviews = [];
  let attempt = 0;

  while (reviews.length < resolvedCount && attempt < genConfig.maxRetries * resolvedCount) {
    attempt++;
    try {
      // Each attempt gets its own unique seed to maximise variation
      const attemptPrompt = interpolate(rawTemplate, {
        shopName,
        tone,
        seed: uuidv4(),
        language,
        minWords: genConfig.minWords,
        maxWords: genConfig.maxWords,
        serviceLabel: category.replace(/_/g, ' '),
      });

      const text = await adapter.generate(attemptPrompt);

      if (!validateWordCount(text)) {
        continue; // retry — out of word-count range
      }

      reviews.push({ id: uuidv4(), text: text.trim() });
    } catch (err) {
      console.error(`[llmService] Adapter error on attempt ${attempt}:`, err.message);
    }
  }

  // Fill remaining slots from fallback if retries exhausted
  if (reviews.length < resolvedCount) {
    const needed = resolvedCount - reviews.length;
    try {
      const fallbackReviews = getFallbackReviews(category, language, needed);
      reviews.push(...fallbackReviews);
      return { reviews, backend: activeBackend, fallback: true };
    } catch (err) {
      if (reviews.length === 0) {
        throw new Error(
          `[llmService] All backends unavailable and fallback pool is empty for ${category}/${language}`
        );
      }
    }
  }

  return { reviews, backend: activeBackend, fallback: false };
}
