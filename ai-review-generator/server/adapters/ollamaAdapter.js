/**
 * ollamaAdapter.js
 * Adapter for a locally-running Ollama instance.
 * Primary LLM backend.
 */

import { LLMAdapter } from './adapterInterface.js';
import { get as getConfig } from '../services/configService.js';

export class OllamaAdapter extends LLMAdapter {
  constructor() {
    super();
    const cfg = getConfig('ollama');
    this._host = cfg.host;
    this._port = cfg.port;
    this._model = cfg.model;
    this._timeoutMs = getConfig('generation').timeoutMs;
    this._baseUrl = `${this._host}:${this._port}`;
  }

  /**
   * Generate a review via the Ollama REST API.
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async generate(prompt) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this._timeoutMs);

    let response;
    try {
      // Dynamic import to support ESM + node-fetch v3
      const { default: fetch } = await import('node-fetch');
      response = await fetch(`${this._baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this._model,
          prompt,
          stream: false,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`[OllamaAdapter] Request timed out after ${this._timeoutMs}ms`);
      }
      throw new Error(`[OllamaAdapter] Network error: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Error(`[OllamaAdapter] HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.response) {
      throw new Error('[OllamaAdapter] Unexpected response shape — missing "response" field');
    }

    return data.response.trim();
  }

  /**
   * Ping Ollama with a minimal request to verify it is reachable.
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const { default: fetch } = await import('node-fetch');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${this._baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this._model,
          prompt: 'ping',
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      return response.ok;
    } catch {
      return false;
    }
  }
}
