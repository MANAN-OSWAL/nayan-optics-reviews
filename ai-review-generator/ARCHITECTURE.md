# ARCHITECTURE.md — AI Review Generator

## Layered Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     BROWSER (Mobile / Desktop)                  │
│                                                                 │
│  frontend/index.html  ──loads──►  frontend/app.js              │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ ConfigLoader │  │  APIClient   │  │   StateMachine       │  │
│  │ /api/config  │  │ /api/generate│  │   UIRenderer         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  HistoryManager (localStorage)  +  DeduplicationEngine   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  ClipboardManager                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP fetch (JSON)
┌──────────────────────────────▼──────────────────────────────────┐
│                  Node.js / Express  (server/)                    │
│                                                                 │
│  server/index.js  ──mounts──►  routes/  ──delegates──►  services│
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      Routes                               │  │
│  │   POST /api/generate   GET /api/health   GET /api/config  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     Services                              │  │
│  │  llmService  promptLoader  fallbackService  configService │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  LLM Adapter Layer                        │  │
│  │   LLMAdapter (interface)                                  │  │
│  │   OllamaAdapter  OpenAIAdapter  GeminiAdapter  MockAdapter│  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────┐
          │                    │                │
   ┌──────▼──────┐    ┌────────▼──────┐  ┌─────▼───────┐
   │   Ollama    │    │    OpenAI     │  │   Gemini    │
   │  (local)    │    │   (cloud)     │  │   (cloud)   │
   └─────────────┘    └───────────────┘  └─────────────┘
```

## Module Responsibilities

### Frontend (`frontend/`)

| Module | File | Responsibility |
|---|---|---|
| ConfigLoader | app.js | Fetches `/api/config` once; caches; exposes `get(key)` |
| APIClient | app.js | `fetch` wrapper for `/api/generate` and `/api/health` |
| HistoryManager | app.js | localStorage CRUD with 50-entry FIFO cap per category+language |
| DeduplicationEngine | app.js | Jaccard bigram similarity; `isDuplicate()` |
| ClipboardManager | app.js | Clipboard API + `execCommand` fallback |
| StateMachine | app.js | Holds state; dispatches transitions; calls UIRenderer |
| UIRenderer | app.js | Renders HTML for each state into `#app` |

### Backend (`server/`)

| Module | File | Responsibility |
|---|---|---|
| configService | services/configService.js | Load, validate, cache config.json |
| promptLoader | services/promptLoader.js | Load + interpolate prompt templates |
| fallbackService | services/fallbackService.js | Load + shuffle fallback review pools |
| llmService | services/llmService.js | Adapter selection, health cascade, retry, word-count validation |
| health route | routes/health.js | `GET /api/health` |
| config route | routes/config.js | `GET /api/config` (safe subset only) |
| generate route | routes/generate.js | `POST /api/generate` with input validation |
| LLMAdapter | adapters/adapterInterface.js | Base class contract |
| OllamaAdapter | adapters/ollamaAdapter.js | Ollama REST API |
| OpenAIAdapter | adapters/openaiAdapter.js | OpenAI Chat Completions |
| GeminiAdapter | adapters/geminiAdapter.js | Google Gemini API |
| MockAdapter | adapters/mockAdapter.js | Instant hardcoded response |

## Adapter Interface Contract

```js
class LLMAdapter {
  async generate(prompt: string): Promise<string>  // non-empty string
  async healthCheck(): Promise<boolean>
}
```

All adapters extend `LLMAdapter`. Switching backends requires only changing `config.backend`.

## Config-Driven Extension Points

| What to add | How |
|---|---|
| New service category | Add entry to `config.json → categories[]`; add `prompts/{id}_en.txt`; add `fallback/{id}_en.json` |
| New language | Add entry to `config.json → languages[]`; add `prompts/{category}_{code}.txt` for each category |
| New tone | Add entry to `config.json → tones[]` — no code changes needed |
| Switch LLM backend | Change `config.json → backend` to `ollama`, `openai`, `gemini`, or `mock` |

## Fallback Cascade Sequence

```
1. llmService.checkHealth()
   ├─ primary adapter.healthCheck() → true  → use primary
   ├─ primary fails → cloud adapter.healthCheck() → true  → use cloud
   └─ cloud fails (or not configured) → use fallbackService

2. fallbackService.getReviews(category, language, count)
   ├─ load fallback/{category}_{language}.json
   ├─ Fisher-Yates shuffle
   └─ return first `count` entries as [{id, text}]
```

## File Naming Conventions

- Prompt templates: `prompts/{category_id}_{language_code}.txt` (lowercase, underscore)
- Fallback pools: `fallback/{category_id}_{language_code}.json` (lowercase, underscore)
- Server modules: `camelCase.js`
- Frontend: `app.js`, `style.css`, `index.html`
