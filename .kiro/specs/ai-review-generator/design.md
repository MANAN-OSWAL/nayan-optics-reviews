# Design Document — AI Review Generator

## Overview

The AI Review Generator replaces the static template-based review tool (shop2.html) with a fully dynamic, LLM-powered system. Customers select a service category, optionally choose a language and tone, and receive five freshly generated, unique review texts they can copy and post to Google Maps.

The system is built as a standalone project in `ai-review-generator/` at the workspace root. It follows a strict layered architecture:

- **Frontend** — single HTML file, no build step, mobile-first (320 px–768 px)
- **Backend** — Node.js/Express server acting as the LLM bridge (keeps API keys off the browser)
- **LLM Adapter Layer** — pluggable adapters for Ollama, OpenAI, Gemini, and Mock
- **Configuration Layer** — `config.json` as the single source of truth
- **Fallback Layer** — curated pre-written reviews served when all LLM backends are unreachable

Key design goals:
- Zero code changes needed to add a new service category, language, or tone — only config/prompt files change.
- The frontend never holds API keys or backend URLs beyond the local Express server address.
- The system degrades gracefully: Ollama → Cloud LLM → Fallback Pool.

---

## Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Mobile)                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  index.html (Frontend)                    │  │
│  │                                                          │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │  │  UI Layer  │  │ State Machine│  │  Config Loader  │  │  │
│  │  │ (Vanilla JS│  │  (step flow) │  │  (config.json)  │  │  │
│  │  │  + CSS)    │  │              │  │                 │  │  │
│  │  └────────────┘  └──────────────┘  └─────────────────┘  │  │
│  │                                                          │  │
│  │  ┌──────────────────────────────────────────────────┐   │  │
│  │  │           Review History (localStorage)          │   │  │
│  │  │        + Similarity Deduplication Engine         │   │  │
│  │  └──────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │  HTTP (fetch)                        │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                  Node.js / Express Backend                       │
│                   (localhost:3000)                               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     Route Layer                           │  │
│  │   POST /api/generate   GET /api/health   GET /api/config  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  LLM Service Layer                        │  │
│  │   ┌──────────────────────────────────────────────────┐   │  │
│  │   │              LLM Adapter Interface               │   │  │
│  │   └──────┬──────────┬──────────┬──────────┬──────────┘   │  │
│  │          │          │          │          │               │  │
│  │   ┌──────▼──┐ ┌─────▼──┐ ┌────▼───┐ ┌───▼────┐          │  │
│  │   │ Ollama  │ │OpenAI  │ │ Gemini │ │  Mock  │          │  │
│  │   │ Adapter │ │Adapter │ │Adapter │ │Adapter │          │  │
│  │   └──────┬──┘ └─────┬──┘ └────┬───┘ └───┬────┘          │  │
│  │          └──────────┴─────────┴──────────┘               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Supporting Services                          │  │
│  │  ┌─────────────────┐  ┌──────────────────────────────┐   │  │
│  │  │  Prompt Loader  │  │  Fallback Pool Service       │   │  │
│  │  │  (prompts/*.txt)│  │  (fallback/*.json)           │   │  │
│  │  └─────────────────┘  └──────────────────────────────┘   │  │
│  │  ┌─────────────────┐                                      │  │
│  │  │  Config Service │                                      │  │
│  │  │  (config.json)  │                                      │  │
│  │  └─────────────────┘                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────▼──────┐  ┌──────▼──────┐  ┌─────▼───────┐
   │   Ollama    │  │   OpenAI    │  │   Gemini    │
   │  (local)    │  │   (cloud)   │  │   (cloud)   │
   └─────────────┘  └─────────────┘  └─────────────┘
```

### Request Flow

```
Customer taps service category
        │
        ▼
Frontend: load config → show language/tone selectors
        │
        ▼
Frontend: POST /api/generate {category, language, tone, seed}
        │
        ▼
Backend: load prompt template → inject variables
        │
        ▼
Backend: health-check primary (Ollama) → if fail, try Cloud → if fail, use Fallback
        │
        ▼
Backend: call active adapter → receive raw text → validate length (40–300 words)
        │
        ▼
Backend: return [{text, id}] × 5 to frontend
        │
        ▼
Frontend: deduplicate against localStorage history
        │
        ▼
Frontend: display review cards → customer taps → copy + open Maps
```

---

## Folder / Module Structure

```
ai-review-generator/
│
├── config.json                    # Single source of truth for all runtime settings
├── package.json                   # Node.js dependencies (express, node-fetch, uuid)
├── README.md                      # Setup, configuration, and extension guide
│
├── PROJECT_CONTEXT.md             # Project memory: stack, flows, dependencies
├── ARCHITECTURE.md                # Layers, services, data flow, module structure
├── CODING_RULES.md                # Naming conventions, patterns, formatting rules
├── FEATURE_LOG.md                 # Every feature, change, fix, and decision tracked
│
├── server/                        # Node.js / Express backend
│   ├── index.js                   # Entry point — creates Express app, mounts routes
│   ├── routes/
│   │   ├── generate.js            # POST /api/generate
│   │   ├── health.js              # GET  /api/health
│   │   └── config.js              # GET  /api/config  (serves safe subset of config)
│   ├── services/
│   │   ├── llmService.js          # Orchestrates adapter selection + retry logic
│   │   ├── promptLoader.js        # Loads and interpolates prompt templates
│   │   ├── fallbackService.js     # Serves reviews from fallback pool
│   │   └── configService.js       # Loads, validates, and caches config.json
│   └── adapters/
│       ├── adapterInterface.js    # JSDoc interface definition (generate(prompt) → string)
│       ├── ollamaAdapter.js       # Ollama REST API implementation
│       ├── openaiAdapter.js       # OpenAI Chat Completions implementation
│       ├── geminiAdapter.js       # Google Gemini API implementation
│       └── mockAdapter.js         # Instant hardcoded response for dev/testing
│
├── prompts/                       # Prompt template files (plain text)
│   ├── new_glasses_en.txt
│   ├── new_glasses_mr.txt
│   ├── fast_service_en.txt
│   ├── fast_service_mr.txt
│   ├── eye_exam_en.txt
│   ├── eye_exam_mr.txt
│   ├── sunglasses_en.txt
│   ├── sunglasses_mr.txt
│   ├── frame_adjustment_en.txt
│   └── frame_adjustment_mr.txt
│
├── fallback/                      # Pre-written fallback review pools
│   ├── new_glasses_en.json
│   ├── new_glasses_mr.json
│   ├── fast_service_en.json
│   ├── fast_service_mr.json
│   ├── eye_exam_en.json
│   ├── eye_exam_mr.json
│   ├── sunglasses_en.json
│   ├── sunglasses_mr.json
│   ├── frame_adjustment_en.json
│   └── frame_adjustment_mr.json
│
└── frontend/
    ├── index.html                 # Single-file frontend (no build step)
    ├── style.css                  # Mobile-first styles + Devanagari font import
    └── app.js                     # Frontend JS: state machine, API client, dedup engine
```

---

## Components and Interfaces

### Backend Components

#### `server/index.js` — Express Entry Point
- Loads `configService` at startup; aborts with a clear error if config is invalid.
- Mounts routes under `/api`.
- Serves `frontend/` as static files.
- Listens on `config.server.port` (default `3000`).

#### `server/routes/generate.js` — Generation Route
- Accepts `POST /api/generate` with body `{ category, language, tone, seed, count }`.
- Validates all required fields; returns `400` on missing/invalid input.
- Delegates to `llmService.generateReviews(...)`.
- Returns `200 { reviews: [{ id, text }] }` or `503 { error, fallback: true, reviews: [...] }`.

#### `server/routes/health.js` — Health Route
- Accepts `GET /api/health`.
- Calls `llmService.checkHealth()` which pings the active backend.
- Returns `200 { status: "ok", backend: "ollama" }` or `200 { status: "degraded", backend: "fallback" }`.

#### `server/routes/config.js` — Config Route
- Accepts `GET /api/config`.
- Returns a **safe** subset of config (categories, languages, tones, googleMapsLink) — never exposes API keys.

#### `server/services/llmService.js` — LLM Orchestrator
- Selects the active adapter based on `config.backend`.
- Implements the health-check cascade: Ollama → Cloud → Fallback.
- Calls `promptLoader.load(category, language)` to get the interpolated prompt.
- Calls `adapter.generate(prompt)` up to `config.generation.maxRetries` times.
- Validates response length (40–300 words); retries if out of range.
- Falls back to `fallbackService` if all adapter attempts fail.

#### `server/services/promptLoader.js` — Prompt Loader
- Reads `prompts/{category}_{language}.txt` from disk.
- Falls back to `prompts/{category}_en.txt` + appended language instruction if the target file is missing.
- Interpolates `{{shopName}}`, `{{tone}}`, `{{seed}}`, `{{language}}` placeholders.
- Caches loaded templates in memory after first read.

#### `server/services/fallbackService.js` — Fallback Pool
- Reads `fallback/{category}_{language}.json` (array of strings).
- Shuffles the pool on each call using Fisher-Yates.
- Returns up to `count` entries, avoiding repeats within a single call.

#### `server/services/configService.js` — Config Service
- Loads and JSON-parses `config.json` at startup.
- Validates required fields; throws a descriptive error on malformed config.
- Exposes `get(key)` for other services; caches the parsed object.

#### `server/adapters/adapterInterface.js` — Adapter Contract
```js
/**
 * @interface LLMAdapter
 */
class LLMAdapter {
  /**
   * Generate a review text from a prompt.
   * @param {string} prompt
   * @returns {Promise<string>} raw review text
   */
  async generate(prompt) { throw new Error('Not implemented'); }

  /**
   * Check if the backend is reachable.
   * @returns {Promise<boolean>}
   */
  async healthCheck() { throw new Error('Not implemented'); }
}
```

#### `server/adapters/ollamaAdapter.js`
- `POST http://{host}:{port}/api/generate` with `{ model, prompt, stream: false }`.
- Reads `response.response` from the Ollama JSON response.
- Timeout: 15 seconds (per `config.generation.timeoutMs`).

#### `server/adapters/openaiAdapter.js`
- `POST https://api.openai.com/v1/chat/completions` with `Authorization: Bearer {apiKey}`.
- Uses `config.openai.model` (default `gpt-4o-mini`).
- Reads `choices[0].message.content`.

#### `server/adapters/geminiAdapter.js`
- `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`.
- Uses `config.gemini.model` (default `gemini-1.5-flash`).
- Reads `candidates[0].content.parts[0].text`.

#### `server/adapters/mockAdapter.js`
- `generate()` returns a hardcoded string instantly.
- `healthCheck()` always returns `true`.
- Used in development and automated tests.

---

### Frontend Components

#### State Machine

The frontend UI is driven by a simple explicit state machine with five states:

```
IDLE ──(selectLanguage)──► LANGUAGE_SELECTED
                                  │
                           (selectCategory)
                                  │
                                  ▼
                          CATEGORY_SELECTED
                                  │
                           (selectTone)
                                  │
                                  ▼
                           TONE_SELECTED ──(generate)──► GENERATING
                                                              │
                                              ┌───────────────┴──────────────┐
                                              │                              │
                                        (success)                       (allFail)
                                              │                              │
                                              ▼                              ▼
                                       REVIEWS_READY               FALLBACK_DISPLAYED
                                              │
                                        (copyAction)
                                              │
                                              ▼
                                        COPIED ──(generateNew)──► TONE_SELECTED
```

#### `frontend/app.js` — Frontend Modules

| Module | Responsibility |
|---|---|
| `ConfigLoader` | Fetches `/api/config` once at startup; caches result |
| `UIRenderer` | Renders each state's HTML into `#app` container |
| `APIClient` | `fetch` wrapper for `POST /api/generate` and `GET /api/health` |
| `HistoryManager` | localStorage read/write for Review_History per category |
| `DeduplicationEngine` | Similarity comparison using Jaccard index on word bigrams |
| `ClipboardManager` | Clipboard API with textarea fallback |
| `StateMachine` | Holds current state; dispatches transitions; calls UIRenderer |

#### `frontend/index.html`
- Loads `style.css` and `app.js` (linked, not embedded, for maintainability).
- Contains a single `<div id="app">` mount point.
- Includes Google Fonts import for Noto Sans Devanagari (Marathi support).
- No framework, no build step — pure ES6 modules via `<script type="module">`.

#### `frontend/style.css`
- Mobile-first: base styles target 320 px, media queries extend to 768 px.
- CSS custom properties for theme colors (matches existing Nayan Optics blue palette).
- Devanagari font stack: `'Noto Sans Devanagari', 'Mangal', sans-serif`.
- Animations: `fade-in`, `slide-up`, `spin` (loading indicator).

---

## Data Models

### `config.json` — Full Schema

```json
{
  "shopName": "Nayan Optics",
  "googleMapsLink": "https://g.page/r/Cen2_Z3cXfLnEBE/review",

  "server": {
    "port": 3000
  },

  "backend": "ollama",

  "ollama": {
    "host": "http://localhost",
    "port": 11434,
    "model": "llama3"
  },

  "openai": {
    "apiKey": "",
    "model": "gpt-4o-mini"
  },

  "gemini": {
    "apiKey": "",
    "model": "gemini-1.5-flash"
  },

  "generation": {
    "count": 5,
    "minWords": 40,
    "maxWords": 300,
    "maxRetries": 3,
    "timeoutMs": 15000
  },

  "languages": [
    { "code": "en", "label": "English" },
    { "code": "mr", "label": "मराठी" }
  ],

  "tones": [
    { "id": "enthusiastic", "label": "Enthusiastic" },
    { "id": "formal",       "label": "Formal"       },
    { "id": "brief",        "label": "Brief"        }
  ],

  "defaultTone": "enthusiastic",

  "categories": [
    {
      "id": "new_glasses",
      "label": "New Glasses",
      "labelMr": "नवीन चष्मा",
      "icon": "glasses",
      "color": "blue"
    },
    {
      "id": "fast_service",
      "label": "Fast Service (10 min)",
      "labelMr": "जलद सेवा (१० मिनिटे)",
      "icon": "zap",
      "color": "amber"
    },
    {
      "id": "eye_exam",
      "label": "Eye Exam",
      "labelMr": "डोळ्यांची तपासणी",
      "icon": "eye",
      "color": "emerald"
    },
    {
      "id": "sunglasses",
      "label": "Sunglasses",
      "labelMr": "सनग्लासेस",
      "icon": "sun",
      "color": "orange"
    },
    {
      "id": "frame_adjustment",
      "label": "Frame Adjustment",
      "labelMr": "फ्रेम दुरुस्ती",
      "icon": "sparkles",
      "color": "purple"
    }
  ],

  "history": {
    "maxPerCategory": 50,
    "similarityThreshold": 0.80
  }
}
```

### Review History Entry (localStorage)

Key pattern: `nayan_history_{categoryId}_{languageCode}`

Value: JSON array of history entries, capped at `config.history.maxPerCategory`.

```json
[
  {
    "id": "uuid-v4",
    "text": "Had a wonderful experience at Nayan Optics...",
    "tone": "enthusiastic",
    "timestamp": 1720000000000
  }
]
```

### Fallback Pool File (`fallback/{category}_{lang}.json`)

```json
{
  "category": "new_glasses",
  "language": "en",
  "reviews": [
    "Had a wonderful experience getting my new glasses at Nayan Optics...",
    "The team at Nayan Optics helped me find the perfect frames...",
    "..."
  ]
}
```

Minimum 10 entries per file (enforced by `fallbackService` at startup validation).

### Prompt Template File (`prompts/{category}_{lang}.txt`)

Plain text with `{{placeholder}}` substitution variables:

```
You are a helpful assistant writing a genuine Google Maps review for {{shopName}}, an optical shop.

The customer visited for: {{serviceLabel}}
Tone: {{tone}}
Language: {{language}}
Variation seed (ignore this, it is only for uniqueness): {{seed}}

Write a single, authentic customer review in {{language}} that:
- Sounds like a real person wrote it
- Is between {{minWords}} and {{maxWords}} words
- Matches the "{{tone}}" tone
- Mentions the service type naturally
- Does NOT include a star rating or the word "review"

Output only the review text, nothing else.
```

### API Request / Response Shapes

#### `POST /api/generate`

Request body:
```json
{
  "category": "new_glasses",
  "language": "en",
  "tone": "enthusiastic",
  "seed": "uuid-v4-string",
  "count": 5
}
```

Success response `200`:
```json
{
  "reviews": [
    { "id": "uuid-v4", "text": "Had a wonderful experience..." },
    { "id": "uuid-v4", "text": "The staff at Nayan Optics..." }
  ],
  "backend": "ollama",
  "fallback": false
}
```

Degraded response `200` (fallback active):
```json
{
  "reviews": [
    { "id": "uuid-v4", "text": "Pre-written review text..." }
  ],
  "backend": "fallback",
  "fallback": true
}
```

Error response `400`:
```json
{
  "error": "Missing required field: category"
}
```

Error response `503`:
```json
{
  "error": "All backends unavailable and fallback pool is empty for this category/language."
}
```

#### `GET /api/health`

Response `200`:
```json
{
  "status": "ok",
  "backend": "ollama",
  "timestamp": 1720000000000
}
```

Response `200` (degraded):
```json
{
  "status": "degraded",
  "backend": "fallback",
  "timestamp": 1720000000000
}
```

#### `GET /api/config`

Response `200` (safe subset — no API keys):
```json
{
  "shopName": "Nayan Optics",
  "googleMapsLink": "https://g.page/r/...",
  "languages": [...],
  "tones": [...],
  "categories": [...],
  "defaultTone": "enthusiastic"
}
```

---

## Deduplication Algorithm

The `DeduplicationEngine` uses **Jaccard similarity on word bigrams** — a lightweight, dependency-free approach suitable for short review texts.

### Algorithm

```
function bigramSet(text):
  words = text.toLowerCase().split(/\s+/)
  return Set of consecutive word pairs: ["word1 word2", "word2 word3", ...]

function jaccardSimilarity(textA, textB):
  setA = bigramSet(textA)
  setB = bigramSet(textB)
  intersection = |setA ∩ setB|
  union = |setA ∪ setB|
  return intersection / union   // 0.0 = completely different, 1.0 = identical

function isDuplicate(newText, historyEntries, threshold):
  for each entry in historyEntries:
    if jaccardSimilarity(newText, entry.text) > threshold:
      return true
  return false
```

### Threshold

`config.history.similarityThreshold = 0.80` — reviews sharing more than 80% of their bigrams are considered duplicates and discarded.

### Retry Logic

```
attempt = 0
uniqueReviews = []
while len(uniqueReviews) < 5 and attempt < maxRetries:
  batch = POST /api/generate (count = 5 - len(uniqueReviews))
  for each review in batch:
    if not isDuplicate(review.text, history):
      uniqueReviews.append(review)
  attempt++
if len(uniqueReviews) < 5:
  fill remaining slots from fallback pool (also deduplicated)
```

---

## Error Handling

| Scenario | Backend Behaviour | Frontend Behaviour |
|---|---|---|
| Config missing / malformed | Server refuses to start; logs descriptive error | Falls back to hardcoded defaults; logs console warning |
| Prompt template missing for language | Falls back to English template + language instruction appended | No change visible to user |
| Ollama unreachable | Health-check fails; cascade to Cloud backend | Progress indicator continues |
| All LLM backends unreachable | Returns fallback pool reviews with `fallback: true` | Shows "AI unavailable" banner; displays fallback reviews normally |
| Fallback pool empty for category | Returns `503` | Shows "No reviews available" message with retry button |
| LLM response too short / too long | Retries up to `maxRetries`; uses fallback if all retries fail | Transparent to user |
| Clipboard API unavailable | N/A | Shows selectable textarea with manual copy instruction |
| Network timeout (>15 s) | Adapter throws timeout error; triggers fallback cascade | Progress indicator shows "Taking longer than expected…" after 10 s |
| Invalid request body | Returns `400` with field-level error message | Logs error; shows generic "Something went wrong" toast |

---

## Testing Strategy

### Unit Tests

Unit tests cover pure logic modules with no external dependencies:

- `DeduplicationEngine` — bigram generation, Jaccard calculation, threshold boundary cases
- `promptLoader` — template interpolation, fallback to English, missing placeholder handling
- `configService` — valid config parsing, malformed config error, missing required fields
- `fallbackService` — pool loading, shuffle correctness, minimum count validation
- `llmService` — adapter selection logic, retry counting, word-count validation

### Property-Based Tests

See Correctness Properties section below. Property tests use a PBT library (fast-check for Node.js / JavaScript) with a minimum of 100 iterations per property.

### Integration Tests

- `POST /api/generate` with mock adapter — verifies full request/response pipeline
- `GET /api/health` — verifies health-check cascade logic with mock adapters
- `GET /api/config` — verifies API keys are never exposed in the response
- Fallback activation — verifies fallback reviews are returned when mock adapter is set to fail

### Manual / Smoke Tests

- Start server with `backend: "ollama"` and verify end-to-end generation
- Switch to `backend: "mock"` and verify instant response
- Disconnect Ollama and verify fallback pool activates
- Test on 320 px viewport (iPhone SE) and 768 px viewport (tablet)
- Test Marathi language selection and verify Devanagari rendering


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property-based testing is applicable here because the system contains several pure functions with clear input/output behavior: prompt interpolation, word-count validation, Jaccard similarity calculation, history management, and config-driven rendering. These functions have large input spaces where varied inputs reveal edge cases that example-based tests would miss.

The chosen PBT library is **fast-check** (npm package `fast-check`), which is the standard property-based testing library for JavaScript/Node.js. Each property test is configured to run a minimum of 100 iterations.

---

### Property 1: Prompt Construction Completeness

*For any* valid combination of service category, language, tone, shop name, and seed value, the prompt constructed by `promptLoader` SHALL contain the shop name, the tone descriptor, and the seed value as substrings within the interpolated output.

**Validates: Requirements 1.2, 4.2, 6.2**

---

### Property 2: Review Word-Count Validation

*For any* string of text, the word-count validator SHALL accept the string if and only if its word count falls within the inclusive range [40, 300]. Strings with fewer than 40 words or more than 300 words SHALL be rejected.

**Validates: Requirements 1.4**

---

### Property 3: Review History Round-Trip Persistence

*For any* review text and service category, after the review is added to the history (via copy action), reading the history from localStorage for that category SHALL return a collection containing an entry whose `text` field equals the original review text.

**Validates: Requirements 2.1, 2.5**

---

### Property 4: Deduplication Threshold Enforcement

*For any* pair of review texts whose Jaccard bigram similarity exceeds 0.80, the `DeduplicationEngine` SHALL classify the second text as a duplicate and exclude it. *For any* pair of review texts whose Jaccard bigram similarity is 0.80 or below, the `DeduplicationEngine` SHALL NOT classify the second text as a duplicate.

**Validates: Requirements 2.3**

---

### Property 5: History Cap Invariant

*For any* sequence of review additions to a single service category, after all additions are complete, the number of entries stored in localStorage for that category SHALL never exceed 50. When the 51st entry is added, the oldest entry SHALL be removed (FIFO eviction), keeping the count at exactly 50.

**Validates: Requirements 2.6**

---

### Property 6: Backend Cascade on Primary Failure

*For any* configuration that defines a cloud backend (openai or gemini) in addition to the primary Ollama backend, when the primary adapter's `healthCheck()` returns `false`, the `llmService` SHALL invoke `healthCheck()` on the configured cloud backend adapter before declaring all backends unavailable.

**Validates: Requirements 3.2**

---

### Property 7: Uniform Deduplication Across Review Sources

*For any* fallback review text that has a Jaccard bigram similarity greater than 0.80 with any entry in the current Review_History, the `fallbackService` SHALL discard that review — applying the same deduplication logic as is applied to LLM-generated reviews.

**Validates: Requirements 3.4**

---

### Property 8: Fallback Pool Minimum Count

*For any* service category and language combination defined in `config.json`, loading the corresponding fallback pool file SHALL return an array containing at least 10 review strings.

**Validates: Requirements 3.5**

---

### Property 9: Config-Driven UI Rendering Completeness

*For any* `config.json` containing N languages, M service categories, and K tones, the rendered frontend SHALL display exactly N language options in the language selector, exactly M category buttons in the service selection screen, and exactly K tone options in the tone selector — with labels matching the config entries.

**Validates: Requirements 4.1, 5.2, 5.3, 6.4**

---

### Property 10: Prompt Template Language Fallback

*For any* service category and non-English language code where the file `prompts/{category}_{language}.txt` does not exist on disk, `promptLoader` SHALL load `prompts/{category}_en.txt` instead and the resulting prompt string SHALL contain an explicit instruction to respond in the target language.

**Validates: Requirements 4.5**

---

### Property 11: Prompt File Path Naming Convention

*For any* service category ID and language code, `promptLoader` SHALL construct the template file path as `prompts/{category_id}_{language_code}.txt` — using underscore as the separator and lowercase for both components.

**Validates: Requirements 5.6**

---

### Property 12: Category UI Metadata Rendering

*For any* service category defined in `config.json` with `icon`, `label`, and `color` fields, the rendered category button in the frontend SHALL display the category's `label` text and apply the category's `color` theme class — reflecting the config values without hardcoding.

**Validates: Requirements 5.4**

---

### Property 13: Clipboard Copy Correctness

*For any* review text displayed in a review card, when the customer taps that card, the `ClipboardManager` SHALL call `navigator.clipboard.writeText` with the exact text string of that review — character for character, including any Unicode (Devanagari) characters.

**Validates: Requirements 7.1**

---

### Property 14: Adapter Interface Contract

*For any* adapter implementation (OllamaAdapter, OpenAIAdapter, GeminiAdapter, MockAdapter), calling `generate(prompt)` with a non-empty prompt string SHALL return a Promise that resolves to a non-empty string. No adapter SHALL return `null`, `undefined`, or an empty string on a successful call.

**Validates: Requirements 8.1**
