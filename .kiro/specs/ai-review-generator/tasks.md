# Implementation Plan: AI Review Generator

## Overview

Build the `ai-review-generator/` project from scratch as a standalone Node.js/Express + vanilla-JS application. Tasks follow a bottom-up layered approach: scaffolding → backend foundation → adapter layer → services → routes → content files → frontend → documentation → verification. Each task builds directly on the previous ones so there is no orphaned code.

The implementation language is **JavaScript (Node.js / ES6)**.

---

## Tasks

- [ ] 1. Project scaffolding — folder structure, package.json, config.json
  - Create the `ai-review-generator/` directory at the workspace root with all sub-directories: `server/routes/`, `server/services/`, `server/adapters/`, `prompts/`, `fallback/`, `frontend/`
  - Write `ai-review-generator/package.json` with `name`, `version`, `main: "server/index.js"`, `scripts: { start, dev }`, and pinned dependencies: `express@4.18.2`, `node-fetch@3.3.2`, `uuid@9.0.0`, `fast-check@3.19.0` (devDependency)
  - Write `ai-review-generator/config.json` with the full schema defined in the design: `shopName`, `googleMapsLink`, `server`, `backend`, `ollama`, `openai`, `gemini`, `generation`, `languages`, `tones`, `defaultTone`, `categories` (all 5), `history`
  - _Requirements: 5.1, 5.6, 8.6, 10.1, 10.6_

- [ ] 2. Config service
  - [ ] 2.1 Implement `server/services/configService.js`
    - Load and JSON-parse `config.json` from the project root at module initialisation
    - Validate that required top-level keys exist (`shopName`, `backend`, `categories`, `languages`, `tones`, `generation`, `history`); throw a descriptive `Error` listing the missing key(s) if any are absent
    - Expose a `get(key)` function that returns the cached parsed value for the given key
    - Expose a `getAll()` function that returns the full cached config object
    - _Requirements: 5.1, 5.5, 10.6_

  - [ ]* 2.2 Write unit tests for `configService`
    - Test valid config loads and `get()` returns correct values
    - Test that a config missing a required key throws with a message naming the missing key
    - Test that a malformed JSON file throws a parse error
    - _Requirements: 5.1, 5.5_

- [ ] 3. Express server entry point
  - Implement `server/index.js`: import `express`, `configService`, and all three route modules
  - Call `configService.getAll()` at startup; if it throws, log the error and `process.exit(1)`
  - Mount routes: `POST /api/generate`, `GET /api/health`, `GET /api/config`
  - Serve `frontend/` as static files via `express.static`
  - Listen on `config.server.port` (default `3000`) and log the URL on startup
  - _Requirements: 10.4_

- [ ] 4. LLM adapter layer
  - [ ] 4.1 Implement `server/adapters/adapterInterface.js`
    - Define the `LLMAdapter` base class with `async generate(prompt)` and `async healthCheck()` methods that both throw `new Error('Not implemented')`
    - Export the class as the module default
    - _Requirements: 8.1_

  - [ ] 4.2 Implement `server/adapters/mockAdapter.js`
    - Extend `LLMAdapter`; `generate()` returns a hardcoded 50-word review string instantly
    - `healthCheck()` always resolves `true`
    - _Requirements: 8.5_

  - [ ] 4.3 Implement `server/adapters/ollamaAdapter.js`
    - Extend `LLMAdapter`; read `host`, `port`, `model` from `configService`
    - `generate(prompt)`: POST to `{host}:{port}/api/generate` with `{ model, prompt, stream: false }`; apply `timeoutMs` from config; read `response.response`; throw on non-2xx or timeout
    - `healthCheck()`: attempt a minimal POST; return `true` on success, `false` on any error
    - _Requirements: 8.2_

  - [ ] 4.4 Implement `server/adapters/openaiAdapter.js`
    - Extend `LLMAdapter`; read `apiKey`, `model` from `configService.get('openai')`
    - `generate(prompt)`: POST to `https://api.openai.com/v1/chat/completions` with `Authorization: Bearer {apiKey}`; read `choices[0].message.content`
    - `healthCheck()`: return `true` if `apiKey` is non-empty, `false` otherwise (no live ping to avoid quota usage)
    - _Requirements: 8.3_

  - [ ] 4.5 Implement `server/adapters/geminiAdapter.js`
    - Extend `LLMAdapter`; read `apiKey`, `model` from `configService.get('gemini')`
    - `generate(prompt)`: POST to `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`; read `candidates[0].content.parts[0].text`
    - `healthCheck()`: return `true` if `apiKey` is non-empty, `false` otherwise
    - _Requirements: 8.4_

  - [ ]* 4.6 Write property test for adapter interface contract (Property 14)
    - **Property 14: Adapter Interface Contract**
    - For each adapter (mock, ollama stub, openai stub, gemini stub), assert that `generate(nonEmptyPrompt)` resolves to a non-empty string and never resolves to `null` or `undefined`
    - Use `fast-check` with `fc.string({ minLength: 1 })` as the prompt arbitrary
    - **Validates: Requirements 8.1**

- [ ] 5. Backend services
  - [ ] 5.1 Implement `server/services/promptLoader.js`
    - `load(category, language)`: read `prompts/{category}_{language}.txt` from disk; if the file does not exist, read `prompts/{category}_en.txt` and append `\n\nRespond entirely in {language}.`
    - `interpolate(template, vars)`: replace all `{{key}}` placeholders with the corresponding value from the `vars` object; leave unmatched placeholders as-is
    - Cache loaded raw templates in a `Map` keyed by file path; re-use on subsequent calls
    - Export `{ load, interpolate }`
    - _Requirements: 1.2, 4.2, 4.5, 5.6_

  - [ ]* 5.2 Write property test for prompt construction completeness (Property 1)
    - **Property 1: Prompt Construction Completeness**
    - For any valid `{ shopName, tone, seed }` combination, the interpolated prompt SHALL contain `shopName`, `tone`, and `seed` as substrings
    - Use `fast-check` arbitraries: `fc.string({ minLength: 1 })` for each variable
    - **Validates: Requirements 1.2, 4.2, 6.2**

  - [ ]* 5.3 Write property test for prompt template language fallback (Property 10)
    - **Property 10: Prompt Template Language Fallback**
    - For any category and non-English language code where the target `.txt` file does not exist, `promptLoader.load()` SHALL return a string containing an explicit instruction to respond in the target language
    - **Validates: Requirements 4.5**

  - [ ]* 5.4 Write property test for prompt file path naming convention (Property 11)
    - **Property 11: Prompt File Path Naming Convention**
    - For any category ID and language code, the file path constructed by `promptLoader` SHALL match the pattern `prompts/{category_id}_{language_code}.txt` (underscore separator, all lowercase)
    - Use `fast-check` with `fc.constantFrom(...categoryIds)` and `fc.constantFrom('en', 'mr')`
    - **Validates: Requirements 5.6**

  - [ ] 5.5 Implement `server/services/fallbackService.js`
    - `load(category, language)`: read and JSON-parse `fallback/{category}_{language}.json`; validate that `reviews` array has at least 10 entries; throw if not
    - `getReviews(category, language, count)`: load the pool, Fisher-Yates shuffle a copy, return the first `count` entries as `[{ id: uuid(), text }]`
    - Cache loaded pools in a `Map`; validate minimum count at startup for all category+language combos defined in config
    - _Requirements: 3.3, 3.4, 3.5_

  - [ ]* 5.6 Write property test for fallback pool minimum count (Property 8)
    - **Property 8: Fallback Pool Minimum Count**
    - For every category+language combination in `config.json`, loading the fallback pool SHALL return an array of at least 10 review strings
    - **Validates: Requirements 3.5**

  - [ ] 5.7 Implement `server/services/llmService.js`
    - `getAdapter()`: return the adapter instance matching `config.backend` (`ollama`, `openai`, `gemini`, `mock`)
    - `checkHealth()`: call `adapter.healthCheck()`; if false, try cloud adapter if configured; return `{ status, backend }` object
    - `validateWordCount(text)`: return `true` if word count is in `[minWords, maxWords]` from config
    - `generateReviews({ category, language, tone, seed, count })`: load and interpolate prompt; call `adapter.generate(prompt)` up to `maxRetries` times per review slot; validate word count on each result; fall back to `fallbackService` if all retries exhausted; return `{ reviews: [{ id, text }], backend, fallback }`
    - _Requirements: 1.2, 1.3, 1.4, 3.1, 3.2, 3.6, 8.1–8.6_

  - [ ]* 5.8 Write property test for review word-count validation (Property 2)
    - **Property 2: Review Word-Count Validation**
    - For any string, `validateWordCount` SHALL return `true` iff word count is in [40, 300]
    - Use `fast-check` with `fc.array(fc.word(), { minLength: 0, maxLength: 400 })` joined by spaces
    - **Validates: Requirements 1.4**

  - [ ]* 5.9 Write property test for backend cascade on primary failure (Property 6)
    - **Property 6: Backend Cascade on Primary Failure**
    - When the primary adapter's `healthCheck()` returns `false` and a cloud backend is configured, `llmService.checkHealth()` SHALL invoke `healthCheck()` on the cloud adapter before declaring all backends unavailable
    - Use mock adapters with controllable `healthCheck` return values
    - **Validates: Requirements 3.2**

- [ ] 6. API routes
  - [ ] 6.1 Implement `server/routes/health.js`
    - Export an Express router with `GET /` handler
    - Call `llmService.checkHealth()` and return `200 { status, backend, timestamp: Date.now() }`
    - _Requirements: 3.1_

  - [ ] 6.2 Implement `server/routes/config.js`
    - Export an Express router with `GET /` handler
    - Return `200` with the safe config subset: `{ shopName, googleMapsLink, languages, tones, categories, defaultTone }` — never include `openai.apiKey`, `gemini.apiKey`, or any other secret field
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 6.3 Implement `server/routes/generate.js`
    - Export an Express router with `POST /` handler
    - Validate request body: `category`, `language`, `tone` are required strings; `seed` defaults to a new `uuid()`; `count` defaults to `config.generation.count`
    - Return `400 { error }` on missing/invalid fields
    - Delegate to `llmService.generateReviews(...)`; return `200 { reviews, backend, fallback }` on success
    - Return `503 { error }` if `llmService` throws (all backends + fallback unavailable)
    - _Requirements: 1.1, 1.4, 2.2, 3.3_

  - [ ] 6.4 Checkpoint — backend integration
    - Run `node server/index.js` (with `backend: "mock"`) and verify:
      - `GET /api/health` returns `{ status: "ok", backend: "mock" }`
      - `GET /api/config` returns categories/languages/tones without API keys
      - `POST /api/generate` with valid body returns 5 review objects
      - `POST /api/generate` with missing `category` returns `400`
    - Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 1.1, 3.1, 5.1, 8.5_

- [ ] 7. Prompt templates — all 10 `.txt` files
  - [ ] 7.1 Write `prompts/new_glasses_en.txt`
    - Prompt instructs the LLM to write a genuine Google Maps review for `{{shopName}}` about getting new glasses; includes `{{tone}}`, `{{seed}}`, `{{minWords}}`, `{{maxWords}}`, `{{language}}` placeholders
    - _Requirements: 1.2, 4.2, 5.6_

  - [ ] 7.2 Write `prompts/new_glasses_mr.txt`
    - Same structure as the English template; instructs the LLM to respond entirely in Marathi (Devanagari script)
    - _Requirements: 4.2, 4.3_

  - [ ] 7.3 Write `prompts/fast_service_en.txt`
    - Prompt for the "fast service (10 min)" category in English
    - _Requirements: 1.2, 5.6_

  - [ ] 7.4 Write `prompts/fast_service_mr.txt`
    - Prompt for the "fast service" category in Marathi
    - _Requirements: 4.2, 4.3_

  - [ ] 7.5 Write `prompts/eye_exam_en.txt`
    - Prompt for the "eye exam" category in English
    - _Requirements: 1.2, 5.6_

  - [ ] 7.6 Write `prompts/eye_exam_mr.txt`
    - Prompt for the "eye exam" category in Marathi
    - _Requirements: 4.2, 4.3_

  - [ ] 7.7 Write `prompts/sunglasses_en.txt`
    - Prompt for the "sunglasses" category in English
    - _Requirements: 1.2, 5.6_

  - [ ] 7.8 Write `prompts/sunglasses_mr.txt`
    - Prompt for the "sunglasses" category in Marathi
    - _Requirements: 4.2, 4.3_

  - [ ] 7.9 Write `prompts/frame_adjustment_en.txt`
    - Prompt for the "frame adjustment" category in English
    - _Requirements: 1.2, 5.6_

  - [ ] 7.10 Write `prompts/frame_adjustment_mr.txt`
    - Prompt for the "frame adjustment" category in Marathi
    - _Requirements: 4.2, 4.3_

- [ ] 8. Fallback pool data — all 10 `.json` files
  - [ ] 8.1 Write `fallback/new_glasses_en.json`
    - JSON object `{ category, language, reviews: [...] }` with at least 10 distinct English review strings for the "new glasses" category; each review 40–300 words; varied tones
    - _Requirements: 3.5_

  - [ ] 8.2 Write `fallback/new_glasses_mr.json`
    - At least 10 Marathi (Devanagari) review strings for "new glasses"
    - _Requirements: 3.5, 4.3_

  - [ ] 8.3 Write `fallback/fast_service_en.json`
    - At least 10 English review strings for "fast service"
    - _Requirements: 3.5_

  - [ ] 8.4 Write `fallback/fast_service_mr.json`
    - At least 10 Marathi review strings for "fast service"
    - _Requirements: 3.5, 4.3_

  - [ ] 8.5 Write `fallback/eye_exam_en.json`
    - At least 10 English review strings for "eye exam"
    - _Requirements: 3.5_

  - [ ] 8.6 Write `fallback/eye_exam_mr.json`
    - At least 10 Marathi review strings for "eye exam"
    - _Requirements: 3.5, 4.3_

  - [ ] 8.7 Write `fallback/sunglasses_en.json`
    - At least 10 English review strings for "sunglasses"
    - _Requirements: 3.5_

  - [ ] 8.8 Write `fallback/sunglasses_mr.json`
    - At least 10 Marathi review strings for "sunglasses"
    - _Requirements: 3.5, 4.3_

  - [ ] 8.9 Write `fallback/frame_adjustment_en.json`
    - At least 10 English review strings for "frame adjustment"
    - _Requirements: 3.5_

  - [ ] 8.10 Write `fallback/frame_adjustment_mr.json`
    - At least 10 Marathi review strings for "frame adjustment"
    - _Requirements: 3.5, 4.3_

  - [ ] 8.11 Checkpoint — content files
    - Verify all 10 prompt `.txt` files and all 10 fallback `.json` files exist and are well-formed
    - Confirm each fallback JSON has ≥ 10 entries; confirm each prompt file contains all required `{{placeholder}}` tokens
    - Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 3.5, 5.6_

- [ ] 9. Frontend
  - [ ] 9.1 Implement `frontend/style.css`
    - Mobile-first base styles targeting 320 px; media query breakpoint at 768 px
    - CSS custom properties for the Nayan Optics blue palette and per-category color themes (`--color-blue`, `--color-amber`, `--color-emerald`, `--color-orange`, `--color-purple`)
    - Devanagari font stack: `'Noto Sans Devanagari', 'Mangal', sans-serif`
    - Keyframe animations: `fade-in`, `slide-up`, `spin` (loading spinner)
    - _Requirements: 4.4, 9.4_

  - [ ] 9.2 Implement `frontend/app.js` — `ConfigLoader` and `APIClient` modules
    - `ConfigLoader`: fetch `GET /api/config` once at startup; cache result; expose `get(key)` and `getAll()`
    - `APIClient`: `generateReviews({ category, language, tone, seed, count })` → `POST /api/generate`; `checkHealth()` → `GET /api/health`; both return parsed JSON or throw on non-2xx
    - Export both as named ES6 module exports
    - _Requirements: 5.1, 9.1_

  - [ ] 9.3 Implement `frontend/app.js` — `HistoryManager` and `DeduplicationEngine` modules
    - `HistoryManager`: `getHistory(category, language)` reads `nayan_history_{category}_{language}` from localStorage; `addEntry(category, language, entry)` appends and enforces the 50-entry FIFO cap; `clearHistory(category, language)` removes the key
    - `DeduplicationEngine`: `bigramSet(text)` → `Set` of consecutive word-pair strings; `jaccardSimilarity(textA, textB)` → float [0, 1]; `isDuplicate(newText, historyEntries, threshold)` → boolean
    - Export both as named ES6 module exports
    - _Requirements: 2.1, 2.3, 2.5, 2.6_

  - [ ]* 9.4 Write property test for review history round-trip persistence (Property 3)
    - **Property 3: Review History Round-Trip Persistence**
    - For any review text and category, after `addEntry()`, `getHistory()` SHALL return a collection containing an entry with `text` equal to the original
    - Use `fast-check` with `fc.string({ minLength: 1 })` for text and `fc.constantFrom(...categoryIds)` for category
    - **Validates: Requirements 2.1, 2.5**

  - [ ]* 9.5 Write property test for deduplication threshold enforcement (Property 4)
    - **Property 4: Deduplication Threshold Enforcement**
    - For any pair of texts with Jaccard similarity > 0.80, `isDuplicate` SHALL return `true`; for similarity ≤ 0.80, SHALL return `false`
    - Construct controlled text pairs by sharing/not sharing known bigrams
    - **Validates: Requirements 2.3**

  - [ ]* 9.6 Write property test for history cap invariant (Property 5)
    - **Property 5: History Cap Invariant**
    - For any sequence of N > 50 additions to a single category, the stored entry count SHALL never exceed 50 and the oldest entry SHALL be evicted first
    - Use `fast-check` with `fc.array(fc.string({ minLength: 1 }), { minLength: 51, maxLength: 100 })`
    - **Validates: Requirements 2.6**

  - [ ]* 9.7 Write property test for uniform deduplication across review sources (Property 7)
    - **Property 7: Uniform Deduplication Across Review Sources**
    - Any fallback review text with Jaccard similarity > 0.80 against a history entry SHALL be classified as a duplicate by `DeduplicationEngine.isDuplicate()` — the same logic applied to LLM-generated reviews
    - **Validates: Requirements 3.4**

  - [ ] 9.8 Implement `frontend/app.js` — `ClipboardManager` and `StateMachine` modules
    - `ClipboardManager`: `copy(text)` → calls `navigator.clipboard.writeText(text)`; if Clipboard API unavailable, renders a `<textarea>` with the text and a manual-copy instruction; returns a Promise
    - `StateMachine`: holds `currentState` (one of `IDLE`, `LANGUAGE_SELECTED`, `CATEGORY_SELECTED`, `TONE_SELECTED`, `GENERATING`, `REVIEWS_READY`, `FALLBACK_DISPLAYED`, `COPIED`); `dispatch(action, payload)` transitions state and calls `UIRenderer.render(state, payload)`
    - _Requirements: 7.1, 7.4_

  - [ ] 9.9 Implement `frontend/app.js` — `UIRenderer` module and main bootstrap
    - `UIRenderer.render(state, data)`: renders the correct HTML into `#app` for each state:
      - `IDLE`: language selector (N options from config)
      - `LANGUAGE_SELECTED`: category grid (M buttons from config, with icon and color)
      - `CATEGORY_SELECTED` / `TONE_SELECTED`: tone selector (K options from config)
      - `GENERATING`: spinner + "Generating your reviews…" message; update text after 10 s to "Taking longer than expected…"
      - `REVIEWS_READY` / `FALLBACK_DISPLAYED`: review cards (tap to copy); "AI unavailable" banner if fallback
      - `COPIED`: visual confirmation on selected card; open Google Maps after 1 s delay; "Generate New Reviews" button
    - Bootstrap: on `DOMContentLoaded`, fetch config, initialise `StateMachine`, dispatch `INIT`
    - Wire all user interactions (language select, category tap, tone select, generate tap, card tap, "Generate New" tap) to `StateMachine.dispatch()`
    - _Requirements: 1.5, 1.6, 2.4, 4.1, 5.2, 5.3, 5.4, 6.1, 6.4, 7.2, 7.3, 7.5, 9.1, 9.2, 9.3, 9.5_

  - [ ]* 9.10 Write property test for config-driven UI rendering completeness (Property 9)
    - **Property 9: Config-Driven UI Rendering Completeness**
    - For any config with N languages, M categories, K tones, `UIRenderer` SHALL render exactly N language options, M category buttons, and K tone options with labels matching config
    - Use `fast-check` with `fc.array(fc.record({ code: fc.string(), label: fc.string() }), { minLength: 1 })` for each collection
    - **Validates: Requirements 4.1, 5.2, 5.3, 6.4**

  - [ ]* 9.11 Write property test for clipboard copy correctness (Property 13)
    - **Property 13: Clipboard Copy Correctness**
    - For any review text (including Devanagari Unicode), `ClipboardManager.copy(text)` SHALL call `navigator.clipboard.writeText` with the exact same string
    - Use `fast-check` with `fc.string()` (which generates Unicode strings)
    - **Validates: Requirements 7.1**

  - [ ] 9.12 Implement `frontend/index.html`
    - Single HTML5 file with `<link rel="stylesheet" href="style.css">` and `<script type="module" src="app.js">`
    - Google Fonts import for `Noto Sans Devanagari`
    - Single `<div id="app">` mount point; no inline scripts or styles
    - Accessible: `lang` attribute, `<meta name="viewport">`, semantic landmarks
    - _Requirements: 4.4, 9.4, 10.5_

  - [ ] 9.13 Checkpoint — full frontend integration
    - Start server with `backend: "mock"` and open `http://localhost:3000` in a browser
    - Walk through the full flow: select language → select category → select tone → generate → tap a review card → verify copy confirmation and Maps redirect
    - Verify Marathi language renders Devanagari correctly
    - Verify "Generate New Reviews" button works without page reload
    - Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 1.5, 1.6, 4.4, 7.1, 7.2, 7.3, 9.1–9.5_

- [ ] 10. Documentation files
  - [ ] 10.1 Write `ai-review-generator/README.md`
    - Sections: Prerequisites, Quick Start (`npm install` + `node server/index.js`), Configuration (how to set `backend`, add categories, add languages, add tones), Running with Ollama, Running with OpenAI/Gemini, Development mode (`backend: "mock"`), Project structure overview
    - _Requirements: 10.3_

  - [ ] 10.2 Write `ai-review-generator/PROJECT_CONTEXT.md`
    - Document: project purpose, tech stack (Node.js, Express, vanilla JS, fast-check), key data flows (request → adapter → response), external dependencies and their roles
    - _Requirements: 10.2_

  - [ ] 10.3 Write `ai-review-generator/ARCHITECTURE.md`
    - Document: layered architecture diagram (text/ASCII), module responsibilities, adapter interface contract, config-driven extension points, fallback cascade sequence
    - _Requirements: 10.2_

  - [ ] 10.4 Write `ai-review-generator/CODING_RULES.md`
    - Document: naming conventions (camelCase functions, PascalCase classes, kebab-case files), module pattern (ES6 exports), error handling rules (always throw descriptive Errors, never swallow), no external frontend dependencies, prompt file naming convention
    - _Requirements: 10.2_

  - [ ] 10.5 Write `ai-review-generator/FEATURE_LOG.md`
    - Initial entry documenting the v1.0 feature set, architecture decisions (why Ollama-first, why no build step, why Jaccard bigrams), and date
    - _Requirements: 10.2_

- [ ] 11. End-to-end verification
  - [ ] 11.1 Run all property-based and unit tests
    - Execute `npm test` (or equivalent) in `ai-review-generator/`; confirm all tests pass with zero failures
    - _Requirements: 1.4, 2.1, 2.3, 2.5, 2.6, 3.2, 3.4, 3.5, 4.5, 5.6, 7.1, 8.1_

  - [ ] 11.2 Verify backend routes with mock adapter
    - Confirm `GET /api/health` → `{ status: "ok", backend: "mock" }`
    - Confirm `GET /api/config` response contains no `apiKey` fields
    - Confirm `POST /api/generate` with valid body returns exactly 5 reviews
    - Confirm `POST /api/generate` with missing `category` returns `400`
    - _Requirements: 1.1, 3.1, 5.1, 8.5_

  - [ ] 11.3 Verify fallback cascade
    - Set `backend: "ollama"` and ensure Ollama is not running; confirm the server returns fallback reviews with `fallback: true`
    - _Requirements: 3.2, 3.3_

  - [ ] 11.4 Final checkpoint — Ensure all tests pass
    - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints (tasks 6.4, 8.11, 9.13, 11.4) ensure incremental validation at each layer boundary
- Property tests validate universal correctness properties using `fast-check` (≥ 100 iterations each)
- Unit tests validate specific examples and edge cases
- The `backend: "mock"` setting in `config.json` enables full development and testing without a running LLM
