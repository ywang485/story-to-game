"""FastAPI application entry point."""

import json
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from game_engine import (
    get_game_log,
    get_session,
    process_action,
    start_game,
    update_goals,
)
from models import (
    GameActionRequest,
    GameActionResponse,
    StartGameRequest,
    StartGameResponse,
    StoryRepresentation,
    UpdateGoalsRequest,
)
from story_analyzer import analyze_story, extract_text

app = FastAPI(title="Story-to-Game API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Story analysis
# ---------------------------------------------------------------------------

@app.post("/api/analyze", response_model=StoryRepresentation)
async def analyze(
    file: UploadFile = File(...),
    num_rules: int = Form(default=7),
):
    """Upload a story file and extract entities, rules, state variables, etc."""
    if num_rules < 1 or num_rules > 30:
        raise HTTPException(status_code=400, detail="num_rules must be between 1 and 30")

    content = await file.read()
    try:
        story_text = extract_text(file.filename or "", content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not story_text.strip():
        raise HTTPException(status_code=400, detail="Extracted text is empty.")

    try:
        representation = analyze_story(story_text, num_rules)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")

    return representation


# ---------------------------------------------------------------------------
# Game session
# ---------------------------------------------------------------------------

@app.post("/api/game/start", response_model=StartGameResponse)
async def game_start(req: StartGameRequest):
    """Create a new game session from a story representation."""
    try:
        _sid, _session, response = start_game(
            story=req.story,
            player_character_id=req.player_character_id,
            goal=req.goal,
            failure_conditions=req.failure_conditions,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start game: {e}")
    return response


@app.post("/api/game/{session_id}/action", response_model=GameActionResponse)
async def game_action(session_id: str, req: GameActionRequest):
    """Process a player action and advance the game."""
    try:
        result = process_action(session_id, req.player_action)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Action failed: {e}")
    return result


@app.put("/api/game/{session_id}/goals")
async def game_update_goals(session_id: str, req: UpdateGoalsRequest):
    """Update goal and failure conditions for a session."""
    try:
        update_goals(session_id, req.goal, req.failure_conditions)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"ok": True}


@app.get("/api/game/{session_id}/log")
async def game_log(session_id: str):
    """Download the game log as JSON."""
    try:
        log = get_game_log(session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return Response(
        content=json.dumps(log, indent=2, default=str),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="game-log-{session_id[:8]}.json"'},
    )


@app.get("/api/game/{session_id}/state")
async def game_state(session_id: str):
    """Get full session state (for reconnecting)."""
    try:
        session = get_session(session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return session.model_dump()


@app.get("/api/health")
async def health():
    return {"status": "ok"}
