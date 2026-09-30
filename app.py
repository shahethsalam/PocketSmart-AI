from __future__ import annotations

import io
import json
import os
import re
import uuid
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse,FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from google import genai
from google.genai import types
from PIL import Image
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

app = FastAPI(title="PocketSmart AI", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Keep the existing redesigned frontend files intact while FastAPI serves them.
app.mount("/css", StaticFiles(directory=BASE_DIR / "css"), name="css")
app.mount("/js", StaticFiles(directory=BASE_DIR / "js"), name="js")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
UPLOAD_DIR = BASE_DIR / "static" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash").strip()
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


class HomeRequest(BaseModel):
    budget: float = Field(gt=0)
    rooms: list[str] = []
    lights: int = Field(default=0, ge=0)
    fans: int = Field(default=0, ge=0)
    furniture: int = Field(default=0, ge=0)
    dining: int = Field(default=0, ge=0)
    notes: str = ""


class PartyRequest(BaseModel):
    budget: float = Field(gt=0)
    guests: int = Field(gt=0)
    type: str = "Birthday"
    venue: str = "Home"
    catering: bool = True
    decor: bool = True
    entertainment: bool = True
    notes: str = ""


def require_gemini() -> genai.Client:
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="Gemini is not configured. Add GEMINI_API_KEY to the .env file and restart FastAPI.",
        )
    return client


def extract_json(text: str) -> dict[str, Any]:
    """Extract a JSON object even if the model wraps it in markdown fences."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.I)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.S)
        if not match:
            raise HTTPException(status_code=502, detail="Gemini returned an invalid recommendation format.")
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=502, detail="Gemini returned an invalid recommendation format.") from exc


def generate_json(prompt: str, schema: dict[str, Any]) -> dict[str, Any]:
    ai = require_gemini()
    try:
        response = ai.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.35,
                response_mime_type="application/json",
                response_schema=schema,
            ),
        )
        return extract_json(response.text or "")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {exc}") from exc


def allocation_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "allocations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "label": {"type": "string"},
                        "amount": {"type": "number"},
                        "reason": {"type": "string"},
                    },
                    "required": ["label", "amount", "reason"],
                },
            },
            "tips": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["summary", "allocations", "tips"],
    }


def jewelry_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "recommendations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "description": {"type": "string"},
                        "budget_amount": {"type": "number"},
                        "why": {"type": "string"},
                    },
                    "required": ["name", "description", "budget_amount", "why"],
                },
            },
            "allocations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "label": {"type": "string"},
                        "amount": {"type": "number"},
                        "reason": {"type": "string"},
                    },
                    "required": ["label", "amount", "reason"],
                },
            },
            "tips": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["summary", "recommendations", "allocations", "tips"],
    }


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(
    request=request,
    name="index.html",
    context={}
)


@app.get("/health")
async def health():
    return {"status": "ok", "gemini_configured": bool(GEMINI_API_KEY), "model": GEMINI_MODEL}


@app.post("/generate-home")
async def generate_home(data: HomeRequest):
    prompt = f"""
You are PocketSmart AI, a practical Indian budget-planning assistant.
Create a realistic home interior budget recommendation. Keep the total allocation at or below the user's budget.
Do not invent product prices or claim live shopping prices. Give category-level recommendations only.

User input:
Budget: ₹{data.budget:,.0f}
Rooms: {', '.join(data.rooms) if data.rooms else 'Living Room'}
Lights/fixtures: {data.lights}
Ceiling fans: {data.fans}
Furniture pieces: {data.furniture}
Dining tables: {data.dining}
Special requirements: {data.notes or 'None'}

Return concise JSON with 4-7 allocation categories, practical reasons, and useful tips.
"""
    result = generate_json(prompt, allocation_schema())
    return {"type": "home", "title": "AI home interior plan", "budget": data.budget, **result}


@app.post("/generate-party")
async def generate_party(data: PartyRequest):
    prompt = f"""
You are PocketSmart AI, a practical Indian event-budget assistant.
Create a realistic party/event budget recommendation. Keep total allocations at or below the budget.
Respect the selected priorities. Do not claim live vendor prices.

Budget: ₹{data.budget:,.0f}
Guests: {data.guests}
Party type: {data.type}
Venue: {data.venue}
Catering selected: {data.catering}
Decoration selected: {data.decor}
Entertainment selected: {data.entertainment}
Additional requirements: {data.notes or 'None'}

Return concise JSON with 4-7 allocation categories, reasons, and practical tips.
"""
    result = generate_json(prompt, allocation_schema())
    return {"type": "party", "title": "AI party budget plan", "budget": data.budget, **result}


@app.post("/generate-jewelry")
async def generate_jewelry(
    budget: float = Form(...),
    occasion: str = Form(...),
    style: str = Form(...),
    outfit_image: UploadFile | None = File(default=None),
):
    if budget <= 0:
        raise HTTPException(status_code=400, detail="Budget must be greater than zero.")

    ai = require_gemini()
    prompt = f"""
You are PocketSmart AI, a jewelry recommendation assistant for Indian occasions.
Recommend jewelry that fits the user's budget and style. If an outfit image is provided, use only visible,
non-sensitive fashion details such as color, neckline, pattern and overall style. Do not identify the person.
Do not invent live product listings or prices.

Budget: ₹{budget:,.0f}
Occasion: {occasion}
Preferred style: {style}

Return 3-5 jewelry recommendations and a budget allocation. Keep total allocation at or below the budget.
"""

    saved_image = None
    image = None
    if outfit_image and outfit_image.filename:
        raw = await outfit_image.read()
        if len(raw) > 8 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Image is too large. Please use an image under 8 MB.")
        try:
            image = Image.open(io.BytesIO(raw)).convert("RGB")
        except Exception as exc:
            raise HTTPException(status_code=400, detail="The uploaded file is not a valid image.") from exc
        saved_image = UPLOAD_DIR / f"{uuid.uuid4().hex}.jpg"
        image.save(saved_image, format="JPEG")
        prompt += "\nAn outfit image is included. Base the recommendations on visible outfit styling."

    contents: list[Any] = [prompt] + ([image] if image else [])

    try:
        response = ai.models.generate_content(
            model=GEMINI_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=0.4,
                response_mime_type="application/json",
                response_schema=jewelry_schema(),
            ),
        )
        result = extract_json(response.text or "")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {exc}") from exc

    return {
        "type": "jewelry",
        "title": "AI jewelry recommendation",
        "budget": budget,
        "image_saved": f"/static/uploads/{saved_image.name}" if saved_image else None,
        **result,
    }


# Compatibility routes matching the project specification naming.
@app.post("/api/generate-home")
async def api_generate_home(data: HomeRequest):
    return await generate_home(data)


@app.post("/api/generate-party")
async def api_generate_party(data: PartyRequest):
    return await generate_party(data)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
