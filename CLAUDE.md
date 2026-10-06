# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JFT Exam Hub — PWA for JFT-Basic (Japan Foundation Test for Basic Japanese) simulation exams. 400+ exams, each with ~50 questions across 4 sections. Pure frontend (HTML/CSS/JS) deployed on Netlify. AI question explanations proxied through a Netlify Function.

## Architecture

```
index.html          — Hub/landing page (exam grid, search, dark mode)
exam.html           — Exam-taking interface (timer, sidebar, question rendering)
history.html        — Progress dashboard (stats, weak areas, spaced repetition pool)
seminar.html        — Bengali-language Japan visa/language seminar landing page (separate from exam app)
css/style.css       — Single shared stylesheet (51KB)
js/app.js           — Core exam engine (state mgmt, rendering, audio, AI explain)
sw.js               — Service worker (cache-first for static, network-first for API)
manifest.json       — PWA manifest

exams/              — 400+ exam directories (jft1..jft405)
  jftN/
    data.json       — Exam content (sections, questions, answers)
    images/        — Generated question images (q1.jpeg, q2.jpeg, ...)
  metadata.json     — Index of all exams (id, title, description, duration, questionCount)

netlify/functions/chat.js  — AI proxy (forwards to LongCat API, handles CORS/timeouts; 9s fetch timeout to stay under Netlify free tier 10s limit)
```

### Exam Data Model

Each `exams/jftN/data.json` has:
- `sections[]` — 4 sections: "Script and Vocabulary", "Conversation and Expression", "Listening Comprehension", "Reading Comprehension"
- `questions[]` per section with `type`: `"text"`, `"image"`, or `"audio"`
- Image questions: `imagePrompt` (for generation), image loaded from `images/q{id}.jpeg`
- Audio questions: `audio` filename + `audioTranscript` (speakers: 男／女)
- All questions: `stem`, `options[]`, `answer`

### State Management (js/app.js)

Global singletons: `examData`, `currentSectionIdx`, `currentQIdx`, `timeLeft`, `examMode`, `examFinished`. Per-question state stored in `state[sectionIdx][questionIdx]` with `{selected, flagged, answered}`. Progress auto-saved to localStorage.

### AI Integration

- **Exam explanations**: Settings popup → "AI Explain" sends question + user answer + correct answer to Netlify function
- **Proxy**: `netlify/functions/chat.js` forwards to `api.longcat.chat/openai/v1/chat/completions`, API key from `LONGCAT_API_KEY` env var
- **Generation scripts** (Python, run locally): `generate_exam_data.py` uses Gemini 2.5 Flash (Vertex AI) to create exam JSONs; `generate_images.py` uses Imagen 3 for question images; `generate_audio.py` for TTS

## Key Conventions

- All exam content in Japanese; UI strings mix English + Bengali (বাংলা)
- Dark mode persisted in `localStorage.jft_dark_mode`
- Last exam tracked in `localStorage.last_jft_exam` for resume
- Exam history in `localStorage.jft_exam_history`
- Wrong answer pool in `localStorage.jft_wrong_pool` (spaced repetition, not yet fully implemented)
- `localStorage.jft_lang` toggles English/Bengali

## Python Scripts (generation pipeline)

| Script | Purpose |
|---|---|
| `generate_exam_data.py` | Generate exam JSON via Gemini 2.5 Flash (Vertex AI) |
| `generate_metadata.py` | Rebuild `exams/metadata.json` from all exam dirs |
| `generate_images.py` | Generate question images via Imagen 3 (unlimited retry on 429) |
| `generate_audio.py` | Generate audio files for listening questions |
| `resize_images.py` | Batch-resize generated images |
| `check_iam.py` / `check_missing.py` / `check_missing_images.py` | Validation/QA scripts |
| `list_models.py` | List available Vertex AI models |

All Python scripts use Vertex AI with service account at `nihongo-pathway-8b5926fad51e.json` (project: `nihongo-pathway`, location: `us-central1`).

## Deployment

- Hosted on Netlify. `netlify.toml` routes `/api/*` to `netlify/functions/`.
- No build step — static files served from repo root.
- Environment variable `LONGCAT_API_KEY` must be set in Netlify dashboard.

## Graphify

Knowledge graph at `graphify-out/`. Read `graphify-out/GRAPH_REPORT.md` for architecture overview. After modifying code, run `graphify update .` to refresh.
