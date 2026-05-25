# Nayan Optics — AI Review Generator

An AI-powered Google Maps review generator for Nayan Optics optical shop. Customers scan a QR code, select their service, and get a ready-to-paste review in seconds.

---

## Quick Start (Local)

```bash
cd ai-review-generator
npm install
npm start
# Open http://localhost:3000
```

Runs in **mock mode** by default — instant reviews from the curated pool, no LLM needed.

---

## Deploy to Render (Free Hosting)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial release"
git remote add origin https://github.com/YOUR_USERNAME/nayan-optics-reviews.git
git push -u origin main
```

### 2. Create a Render Web Service

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repo
3. Settings:
   - **Root Directory:** `ai-review-generator`
   - **Build Command:** `npm install`
   - **Start Command:** `node server/index.js`
   - **Environment:** Node
4. Click **Deploy**

Your app will be live at `https://nayan-optics-reviews.onrender.com` (or similar).

### 3. Keep it awake (prevents 30s cold starts)

1. Go to [uptimerobot.com](https://uptimerobot.com) → **Add New Monitor**
2. Type: **HTTP(s)**
3. URL: `https://YOUR-APP.onrender.com/api/health`
4. Interval: **5 minutes**

### 4. Generate the QR code

1. Go to [qrcode-monkey.com](https://www.qrcode-monkey.com)
2. Paste your Render URL
3. Add your shop logo in the centre
4. Download as high-res PNG and print

---

## Enable AI Generation (Optional)

### With Google Gemini (Free tier — recommended)

1. Get a free API key at [aistudio.google.com](https://aistudio.google.com)
2. In Render dashboard → **Environment → Add Environment Variable:**
   - Key: `GEMINI_API_KEY`
   - Value: `AIza...your key...`
   - Key: `BACKEND`
   - Value: `gemini`
3. Redeploy — reviews are now AI-generated

### With Ollama (Local only)

```bash
ollama pull llama3
ollama serve
```

Change `"backend": "ollama"` in `config.json` and run `npm start`.

---

## Configuration Reference (`config.json`)

| Key | Description |
|---|---|
| `shopName` | Shop name shown in the UI |
| `googleMapsLink` | Google Maps review URL |
| `backend` | `"mock"`, `"ollama"`, `"openai"`, `"gemini"` |
| `generation.count` | Reviews per request (default: 5) |
| `generation.timeoutMs` | LLM timeout in ms (default: 30000) |
| `languages` | Language options shown to customer |
| `tones` | Tone options (Enthusiastic, Formal, Brief) |
| `categories` | Service categories shown as buttons |

## Environment Variables (Render / Production)

| Variable | Description |
|---|---|
| `PORT` | Set automatically by Render |
| `BACKEND` | Override `config.backend` |
| `GEMINI_API_KEY` | Google Gemini API key |
| `OPENAI_API_KEY` | OpenAI API key |

---

## Adding a New Service Category

1. Add to `config.json → categories[]`
2. Create `prompts/{id}_en.txt` (and `_mr.txt`)
3. Create `fallback/{id}_en.json` (and `_mr.json`) with 10+ reviews
4. Redeploy — new category appears automatically

---

## Project Structure

```
ai-review-generator/
├── config.json          # All settings (no secrets)
├── render.yaml          # One-click Render deployment
├── server/
│   ├── index.js         # Express entry point
│   ├── routes/          # generate, health, config
│   ├── services/        # llmService, promptLoader, fallbackService, configService
│   └── adapters/        # ollama, openai, gemini, mock
├── prompts/             # {category}_{language}.txt
├── fallback/            # {category}_{language}.json (100 reviews each)
└── frontend/
    ├── index.html
    ├── style.css
    └── app.js
```


An AI-powered Google Maps review generator for Nayan Optics optical shop. Customers select a service category, language, and tone, then receive five freshly generated, unique review texts to copy and post.

---

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Ollama** (optional, for AI generation) — [ollama.ai](https://ollama.ai)

---

## Quick Start

```bash
# 1. Navigate to the project folder
cd ai-review-generator

# 2. Install dependencies
npm install

# 3. Start the server (uses mock mode by default)
npm start

# 4. Open in browser
# http://localhost:3000
```

The app runs in **mock mode** by default (`"backend": "mock"` in config.json), which returns instant hardcoded reviews — no LLM required. Perfect for testing the UI.

---

## Running with Ollama (Recommended)

1. Install Ollama: https://ollama.ai
2. Pull a model: `ollama pull llama3`
3. Start Ollama: `ollama serve`
4. Edit `config.json`:
   ```json
   {
     "backend": "ollama",
     "ollama": {
       "host": "http://localhost",
       "port": 11434,
       "model": "llama3"
     }
   }
   ```
5. Start the server: `npm start`

---

## Running with OpenAI

1. Get an API key from [platform.openai.com](https://platform.openai.com)
2. Edit `config.json`:
   ```json
   {
     "backend": "openai",
     "openai": {
       "apiKey": "sk-...",
       "model": "gpt-4o-mini"
     }
   }
   ```
3. Start the server: `npm start`

---

## Running with Google Gemini

1. Get an API key from [aistudio.google.com](https://aistudio.google.com)
2. Edit `config.json`:
   ```json
   {
     "backend": "gemini",
     "gemini": {
       "apiKey": "AIza...",
       "model": "gemini-1.5-flash"
     }
   }
   ```
3. Start the server: `npm start`

---

## Configuration Reference (`config.json`)

| Key | Description |
|---|---|
| `shopName` | Shop name shown in the UI and injected into prompts |
| `googleMapsLink` | Google Maps review URL opened after copying |
| `backend` | Active LLM backend: `"ollama"`, `"openai"`, `"gemini"`, `"mock"` |
| `ollama.host/port/model` | Ollama connection settings |
| `openai.apiKey/model` | OpenAI credentials |
| `gemini.apiKey/model` | Gemini credentials |
| `generation.count` | Number of reviews to generate per request (default: 5) |
| `generation.minWords` | Minimum review word count (default: 40) |
| `generation.maxWords` | Maximum review word count (default: 300) |
| `generation.maxRetries` | Max retry attempts per review slot (default: 3) |
| `generation.timeoutMs` | LLM request timeout in milliseconds (default: 15000) |
| `languages` | Array of `{code, label}` — drives the language selector |
| `tones` | Array of `{id, label}` — drives the tone selector |
| `categories` | Array of category objects — drives the service buttons |
| `history.maxPerCategory` | Max stored reviews per category in localStorage (default: 50) |
| `history.similarityThreshold` | Jaccard similarity threshold for deduplication (default: 0.80) |

---

## Adding a New Service Category

1. Add an entry to `config.json → categories[]`:
   ```json
   {
     "id": "contact_lenses",
     "label": "Contact Lenses",
     "labelMr": "कॉन्टॅक्ट लेन्सेस",
     "icon": "eye",
     "color": "emerald"
   }
   ```
2. Create `prompts/contact_lenses_en.txt` (and optionally `_mr.txt`)
3. Create `fallback/contact_lenses_en.json` (and optionally `_mr.json`) with 10+ reviews
4. Restart the server — the new category appears automatically

---

## Adding a New Language

1. Add an entry to `config.json → languages[]`:
   ```json
   { "code": "hi", "label": "हिंदी" }
   ```
2. Create `prompts/{category}_hi.txt` for each category (or rely on English fallback)
3. Create `fallback/{category}_hi.json` for each category with 10+ reviews
4. Restart the server

---

## Adding a New Tone

1. Add an entry to `config.json → tones[]`:
   ```json
   { "id": "humorous", "label": "Humorous" }
   ```
2. No other changes needed — the tone is injected into the prompt template automatically

---

## Project Structure

```
ai-review-generator/
├── config.json          # Single source of truth for all settings
├── package.json
├── README.md
├── PROJECT_CONTEXT.md   # Project memory, stack, flows
├── ARCHITECTURE.md      # Layers, modules, data flow
├── CODING_RULES.md      # Naming conventions, patterns
├── FEATURE_LOG.md       # Change history
├── server/
│   ├── index.js         # Express entry point
│   ├── routes/          # generate.js, health.js, config.js
│   ├── services/        # llmService, promptLoader, fallbackService, configService
│   └── adapters/        # ollama, openai, gemini, mock
├── prompts/             # {category}_{language}.txt prompt templates
├── fallback/            # {category}_{language}.json fallback review pools
└── frontend/
    ├── index.html       # Single HTML file, no build step
    ├── style.css        # Mobile-first styles
    └── app.js           # All frontend logic (ES6 modules)
```

---

## Development Mode

```bash
# Auto-restart on file changes (Node.js 18+)
npm run dev
```

Set `"backend": "mock"` in config.json for instant responses without a running LLM.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/generate` | Generate reviews |
| `GET` | `/api/health` | Backend health status |
| `GET` | `/api/config` | Safe config subset (no API keys) |

### POST /api/generate

Request body:
```json
{
  "category": "new_glasses",
  "language": "en",
  "tone": "enthusiastic",
  "seed": "optional-uuid",
  "count": 5
}
```

Response:
```json
{
  "reviews": [{ "id": "uuid", "text": "..." }],
  "backend": "ollama",
  "fallback": false
}
```
