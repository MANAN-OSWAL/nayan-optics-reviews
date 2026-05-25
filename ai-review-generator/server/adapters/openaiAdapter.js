/**
 * openaiAdapter.js
 * Adapter for the OpenAI Chat Completions API.
 * Optional cloud backend — activated when config.backend = "openai".
 */

import { LLMAdapter } from './adapterInterface.js';
import { get as getConfig } from '../services/configService.js';

export class OpenAIAdapter extends LLMAdapter {
  constructor() {
    super();
    const cfg = getConfig('openai');
    this._apiKey = cfg.apiKey;
    this._model = cfg.model;
    this._timeoutMs = getConfig('generation').timeoutMs;
  }

  /**
   * Generate a review via the OpenAI Chat Completions API.
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async generate(prompt) {
    if (!this._apiKey) {
      throw new Error('[OpenAIAdapter] No API key configured');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this._timeoutMs);

    let response;
    try {
      const { default: fetch } = await import('node-fetch');
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this._apiKey}`,
        },
        body: JSON.stringify({
          model: this._model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.9,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`[OpenAIAdapter] Request timed out after ${this._timeoutMs}ms`);
      }
      throw new Error(`[OpenAIAdapter] Network error: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`[OpenAIAdapter] HTTP ${response.status}: ${body}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error('[OpenAIAdapter] Unexpected response shape — missing choices[0].message.content');
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
