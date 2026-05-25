# Requirements Document

## Introduction

Nayan Optics currently uses a static review generator (index.html / shop2.html) that presents pre-written, template-assembled reviews for customers to copy and post on Google Maps. The system supports five service categories (new glasses, fast service, eye exam, sunglasses, frame adjustment) in English and Marathi, but suffers from repetition, manual maintenance overhead, and no scalability path.

This feature replaces the static generator with an AI-powered review generation system. Reviews are dynamically composed by a Large Language Model (LLM), making each review feel unique and personal. The system is designed to be scalable — new service categories, languages, and tones can be added through configuration files without touching application code. It supports Ollama (local LLM) as the primary generation backend, a cloud LLM API as an optional secondary backend, and a curated fallback pool for offline scenarios.

The new system is built as a standalone project in a fresh folder, separate from the existing files.

---

## Glossary

- **Review_Generator**: The frontend application (single-page web app) that customers interact with to generate and copy reviews.
- **LLM_Service**: The backend service responsible for sending prompts to an LLM and returning generated review text.
- **Ollama_Backend**: A locally-running Ollama instance used as the primary LLM provider.
- **Cloud_Backend**: An optional cloud-hosted LLM API (e.g., OpenAI, Gemini) used as a secondary LLM provider.
- **Fallback_Pool**: A curated set of pre-written reviews stored locally, used when no LLM backend is reachable.
- **Prompt_Template**: A text file containing the prompt structure for a given service category and language, loaded at runtime without code changes.
- **Service_Category**: A named type of service offered by the shop (e.g., "new glasses", "fast service", "eye exam", "sunglasses", "frame adjustment").
- **Review_History**: A client-side record of review texts that have been shown to the current user session, used to prevent repetition.
- **Config_File**: A JSON or YAML file that defines available service categories, languages, tones, and LLM backend settings, loaded at startup.
- **Tone**: A stylistic modifier for generated reviews (e.g., "enthusiastic", "formal", "casual", "brief").
- **Language**: The natural language in which a review is generated (e.g., "English", "Marathi").
- **Copy_Action**: The user action of copying a review text to the clipboard.
- **Google_Maps_Link**: The shop's Google Maps review submission URL opened after a Copy_Action.
- **Health_Check**: A lightweight request sent to a backend to verify it is reachable before attempting generation.

---

## Requirements

### Requirement 1: Dynamic Review Generation via LLM

**User Story:** As a customer of Nayan Optics, I want to receive a freshly generated, unique review for my visit, so that my Google Maps post feels personal and authentic rather than copied from a template.

#### Acceptance Criteria

1. WHEN a customer selects a Service_Category, THE Review_Generator SHALL request the LLM_Service to generate 5 unique review texts for that category.
2. WHEN the LLM_Service receives a generation request, THE LLM_Service SHALL construct a prompt from the matching Prompt_Template for the selected Service_Category and Language.
3. WHEN the LLM_Service sends a prompt to the Ollama_Backend, THE LLM_Service SHALL receive a complete review text in response within 15 seconds.
4. WHEN the LLM_Service receives a generated review, THE LLM_Service SHALL return review text that is between 40 and 300 words in length.
5. THE Review_Generator SHALL display a loading indicator to the customer while generation is in progress.
6. WHEN generation completes, THE Review_Generator SHALL display all 5 generated reviews for the customer to choose from.

---

### Requirement 2: Review Uniqueness and Non-Repetition

**User Story:** As a customer, I want to see reviews I haven't seen before, so that I don't feel like I'm posting something generic that every other customer has already used.

#### Acceptance Criteria

1. THE Review_Generator SHALL maintain a Review_History in the browser's localStorage for the current device.
2. WHEN the LLM_Service generates a new review, THE LLM_Service SHALL include a variation seed (combining Service_Category, Language, Tone, and a random UUID) in the prompt to maximize output diversity.
3. WHEN the Review_Generator receives generated reviews, THE Review_Generator SHALL compare each review against the Review_History and discard any review whose text similarity to a stored entry exceeds 80%.
4. WHEN fewer than 5 unique reviews remain after deduplication, THE Review_Generator SHALL request additional reviews from the LLM_Service until 5 unique reviews are available or 3 retry attempts are exhausted.
5. WHEN a customer performs a Copy_Action on a review, THE Review_Generator SHALL add that review text to the Review_History.
6. THE Review_Generator SHALL cap the Review_History at 50 entries per Service_Category, removing the oldest entry when the cap is exceeded.

---

### Requirement 3: Offline Fallback

**User Story:** As a shop owner, I want the review generator to work even when the internet or local Ollama is unavailable, so that customers are never left with a broken experience.

#### Acceptance Criteria

1. WHEN the Review_Generator starts, THE LLM_Service SHALL perform a Health_Check against the configured primary backend (Ollama_Backend).
2. IF the Ollama_Backend Health_Check fails, THEN THE LLM_Service SHALL perform a Health_Check against the Cloud_Backend if one is configured.
3. IF all backend Health_Checks fail, THEN THE Review_Generator SHALL notify the customer that AI generation is temporarily unavailable and automatically serve reviews from the Fallback_Pool.
4. WHEN serving from the Fallback_Pool, THE Review_Generator SHALL apply the same Review_History deduplication logic as for LLM-generated reviews.
5. THE Fallback_Pool SHALL contain a minimum of 10 pre-written reviews per Service_Category per Language.
6. WHEN a backend becomes reachable again after a failure, THE LLM_Service SHALL resume using LLM generation on the next customer request without requiring a page reload.

---

### Requirement 4: Multi-Language Support

**User Story:** As a Marathi-speaking customer, I want to generate reviews in Marathi, so that I can post a review in my native language on Google Maps.

#### Acceptance Criteria

1. THE Review_Generator SHALL display a language selector allowing the customer to choose between all Languages defined in the Config_File before selecting a Service_Category.
2. WHEN a Language is selected, THE LLM_Service SHALL use the Prompt_Template corresponding to that Language and Service_Category combination.
3. WHEN generating a Marathi review, THE LLM_Service SHALL instruct the LLM to respond entirely in Marathi script (Devanagari).
4. THE Review_Generator SHALL render Marathi text using a font that correctly displays Devanagari Unicode characters.
5. WHERE a Prompt_Template for a specific Language and Service_Category combination does not exist in the Config_File, THE LLM_Service SHALL fall back to the English Prompt_Template for that Service_Category and append a language instruction to the prompt.

---

### Requirement 5: Configuration-Driven Extensibility

**User Story:** As the shop owner or developer, I want to add new service categories, languages, and tones by editing a configuration file, so that the application never needs code changes for content updates.

#### Acceptance Criteria

1. THE Review_Generator SHALL load all Service_Categories, Languages, Tones, and LLM backend settings from a single Config_File at application startup.
2. WHEN a new Service_Category entry is added to the Config_File, THE Review_Generator SHALL display it as a selectable option without any code changes.
3. WHEN a new Language entry is added to the Config_File, THE Review_Generator SHALL include it in the language selector without any code changes.
4. THE Config_File SHALL support defining per-category icons, display labels, and color themes for the UI.
5. IF the Config_File is missing or malformed, THEN THE Review_Generator SHALL fall back to a set of hardcoded default Service_Categories (new glasses, fast service, eye exam, sunglasses, frame adjustment) and display an error message to the developer in the browser console.
6. THE Prompt_Template files SHALL be stored as plain text files in a dedicated directory, named by the pattern `{service_category}_{language}.txt`, and loaded by the LLM_Service at request time.

---

### Requirement 6: Tone Selection

**User Story:** As a customer, I want to choose the tone of my review (e.g., enthusiastic, formal, brief), so that the generated text matches my personal communication style.

#### Acceptance Criteria

1. THE Review_Generator SHALL display a Tone selector after the customer selects a Service_Category and before generation begins.
2. WHEN a Tone is selected, THE LLM_Service SHALL include the Tone descriptor in the Prompt_Template substitution variables.
3. THE Review_Generator SHALL offer a minimum of 3 Tones: "Enthusiastic", "Formal", and "Brief".
4. WHERE additional Tones are defined in the Config_File, THE Review_Generator SHALL display them in the Tone selector.
5. WHEN no Tone is explicitly selected by the customer, THE Review_Generator SHALL default to the "Enthusiastic" Tone.

---

### Requirement 7: Copy and Redirect Flow

**User Story:** As a customer, I want to tap a review to copy it and be taken directly to the Google Maps review page, so that posting my review is as frictionless as possible.

#### Acceptance Criteria

1. WHEN a customer taps a review card, THE Review_Generator SHALL copy the review text to the system clipboard using the Clipboard API.
2. WHEN the Copy_Action succeeds, THE Review_Generator SHALL display a visual confirmation on the selected review card within 300 milliseconds.
3. WHEN the Copy_Action succeeds, THE Review_Generator SHALL open the Google_Maps_Link in a new browser tab after a 1-second delay.
4. IF the Clipboard API is unavailable (e.g., non-HTTPS context), THEN THE Review_Generator SHALL display the review text in a selectable text area and instruct the customer to copy it manually, then open the Google_Maps_Link.
5. THE Review_Generator SHALL provide a "Generate New Reviews" button that allows the customer to request a fresh set of reviews without reloading the page.

---

### Requirement 8: LLM Backend Abstraction

**User Story:** As a developer, I want the LLM integration to be backend-agnostic, so that I can switch between Ollama, OpenAI, or any other provider by changing configuration rather than rewriting code.

#### Acceptance Criteria

1. THE LLM_Service SHALL communicate with any backend through a single internal interface that accepts a prompt string and returns a review string.
2. WHEN the Config_File specifies `"backend": "ollama"`, THE LLM_Service SHALL send requests to the Ollama REST API at the configured host and port.
3. WHEN the Config_File specifies `"backend": "openai"`, THE LLM_Service SHALL send requests to the OpenAI Chat Completions API using the configured API key and model name.
4. WHEN the Config_File specifies `"backend": "gemini"`, THE LLM_Service SHALL send requests to the Google Gemini API using the configured API key and model name.
5. THE LLM_Service SHALL support a `"backend": "mock"` mode that returns a hardcoded review string instantly, for use during development and testing.
6. WHEN switching backends, THE LLM_Service SHALL require only a change to the Config_File and no changes to application source code.

---

### Requirement 9: Performance and Responsiveness

**User Story:** As a customer using the app on a mobile phone, I want the app to feel fast and responsive, so that I don't get frustrated waiting for my review.

#### Acceptance Criteria

1. THE Review_Generator SHALL display the service selection screen within 1 second of the page loading on a standard mobile connection.
2. WHEN the LLM_Service is generating reviews, THE Review_Generator SHALL display a progress indicator that updates at least every 2 seconds to reassure the customer that the app is working.
3. WHEN the Ollama_Backend responds within 15 seconds, THE Review_Generator SHALL display the generated reviews within 500 milliseconds of receiving the response.
4. THE Review_Generator SHALL be fully functional on screen widths between 320px and 768px (mobile-first layout).
5. WHILE the LLM_Service is generating reviews, THE Review_Generator SHALL keep the service selection screen interactive so the customer can cancel and choose a different category.

---

### Requirement 10: Project Structure and Maintainability

**User Story:** As a developer, I want the new project to be cleanly structured and isolated from the old files, so that it is easy to maintain, extend, and deploy independently.

#### Acceptance Criteria

1. THE Review_Generator SHALL be built in a new dedicated folder (e.g., `ai-review-generator/`) that is completely independent of `index.html` and `shop2.html`.
2. THE Review_Generator project SHALL separate concerns into distinct layers: frontend UI, LLM_Service client, configuration loader, and Fallback_Pool data.
3. THE Review_Generator SHALL include a `README.md` that documents how to run the project, configure backends, add new categories, and add new languages.
4. THE LLM_Service SHALL be implemented as a lightweight Node.js server (Express) that the frontend communicates with over a local HTTP API, keeping LLM API keys and backend URLs out of the browser.
5. THE Review_Generator frontend SHALL be a single HTML file with embedded or linked JavaScript that requires no build step to run, keeping the deployment simple.
6. THE Review_Generator project SHALL include a `config.json` file at the project root that serves as the single source of truth for all runtime configuration.
