/**
 * geminiAdapter.js
 * Adapter for the Google Gemini API.
 * Optional cloud backend — activated when config.backend = "gemini".
 */

import { LLMAdapter } from './adapterInterface.js';
import { get as getConfig } from '../services/configService.js';

export class GeminiAdapter extends LLMAdapter {
  constructor() {
    super();
    const cfg = getConfig('gemini');
    this._apiKey = cfg.apiKey;
    this._model = cfg.model;
    this._timeoutMs = getConfig('generation').timeoutMs;
  }

  /**
   * Generate a review via the Google Gemini API.
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async generate(prompt) {
    if (!this._apiKey) {
      throw new Error('[GeminiAdapter] No API key configured');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this._model}:generateContent?key=${this._apiKey}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this._timeoutMs);

    let response;
    try {
      const { default: fetch } = await import('node-fetch');
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9 },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`[GeminiAdapter] Request timed out after ${this._timeoutMs}ms`);
      }
      throw new Error(`[GeminiAdapter] Network error: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`[GeminiAdapter] HTTP ${response.status}: ${body}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('[GeminiAdapter] Unexpected response shape — missing candidates[0].content.parts[0].text');
    }

    return text.trim();
  }

  /**
   * Returns true if an API key is configured (no live ping to avoid quota usage).
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    return Boolean(this._apiKey && this._apiKey.length > 0);
  }
}
