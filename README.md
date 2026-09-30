# PocketSmart AI — FastAPI + Gemini

PocketSmart AI is a budget and recommendation assistant with the existing redesigned frontend preserved as the main single-page UI.

## Features
- Home Interior Planner
- Party / Event Planner
- Jewelry Recommendation with optional outfit image
- FastAPI backend
- Gemini AI generation
- Local browser authentication and plan history from the redesigned frontend
- Jinja2 template structure
- Uploaded jewelry images stored under `static/uploads`

## 1. Install backend packages

Activate your existing virtual environment in the VS Code terminal and run:

```powershell
pip install -r requirements.txt
```

## 2. Configure Gemini

Copy `.env.example` to `.env` and add your Gemini API key:

```env
GEMINI_API_KEY=your_real_key_here
GEMINI_MODEL=gemini-3.6-flash
```

Keep `.env` private and never commit it to GitHub.

The project uses Google's current `google-genai` Python SDK. The SDK supports `client.models.generate_content(...)` and structured JSON responses.

## 3. Run

```powershell
uvicorn app:app --reload
```

Open:

```text
http://127.0.0.1:8000
```

Health check:

```text
http://127.0.0.1:8000/health
```

## API endpoints

- `POST /generate-home`
- `POST /generate-party`
- `POST /generate-jewelry`
- Compatibility: `/api/generate-home`, `/api/generate-party`

If Gemini is not configured or unavailable, the frontend falls back to the original browser demo allocation so the UI remains usable.
