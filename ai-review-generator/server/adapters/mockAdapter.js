/**
 * mockAdapter.js
 * Mock adapter for development and testing.
 * Delegates to the fallback service so tone, category, and language are all
 * respected — giving realistic, varied output without a running LLM.
 */

import { LLMAdapter } from './adapterInterface.js';

export class MockAdapter extends LLMAdapter {
  /**
   * Mock generate — returns a sentinel string that signals llmService to use
   * the fallback pool directly. The actual pool selection (category + language)
   * is handled by llmService when it detects mock mode.
   *
   * We return a non-empty string so the interface contract is satisfied, but
   * llmService.generateReviews() short-circuits to fallbackService when
   * backend === "mock".
   *
   * @param {string} _prompt
   * @returns {Promise<string>}
   */
  async generate(_prompt) {
    // This path is only reached if llmService calls the adapter directly.
    // In normal mock flow, llmService.generateReviews() bypasses generate()
    // and calls fallbackService instead.
    return '__mock__';
  }

  /**
   * Always reports healthy.
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    return true;
  }
}
