/**
 * adapterInterface.js
 * Base class defining the LLMAdapter contract.
 * All concrete adapters must extend this class and implement both methods.
 */

export class LLMAdapter {
  /**
   * Generate a review text from a prompt.
   * @param {string} prompt - The fully interpolated prompt string.
   * @returns {Promise<string>} Raw review text from the LLM.
   */
  async generate(prompt) { // eslint-disable-line no-unused-vars
    throw new Error('[LLMAdapter] generate() is not implemented');
  }

  /**
   * Check if the backend is reachable.
   * @returns {Promise<boolean>} true if reachable, false otherwise.
   */
  async healthCheck() {
    throw new Error('[LLMAdapter] healthCheck() is not implemented');
  }
}
