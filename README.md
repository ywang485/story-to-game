# Story to Game

Transform any story into a living textual simulation sandbox powered by Claude AI.

## What it does

Upload a story (PDF, TXT, or Markdown) and the system will:

1. **Extract entities** — characters, objects, locations, factions, and a root `world` entity. Each gets a paragraph-long description.
2. **Identify state variables** — aspects of each entity that change non-trivially throughout the story (e.g. a character's sanity, a kingdom's political stability, a relationship's status). Only meaningful, dynamic attributes are included.
3. **Distil world rules** — a configurable number of story-specific rules that govern cause and effect in this world (e.g. *"Jealousy escalates when a rival gains status"*).
4. **Capture the theme** — a paragraph summarising the author's central message, if one is present.
5. **Store everything as JSON** — entities + state variables + rules + an adventure-game opening, ready to power gameplay.

The app then lets you **play a text adventure** set in that story world:

- Choose any character to play as.
- A chat interface alternates between you (the player) and the **Game Master** (Claude).
- Every turn: state variables update, the Game Master narrates consequences, and suggested next actions are offered.
- Set a **victory condition** and/or **failure conditions** (plain English *or* formal expressions like `hamlet.sanity <= 0`). When met, the story ends conclusively.
- Download a full **JSON game log** (state changes, rules applied, story text) for every turn.

## Architecture

```
story-to-game/
├── backend/               # Python · FastAPI · Anthropic SDK
│   ├── main.py            # API routes
│   ├── models.py          # Pydantic data models
│   ├── story_analyzer.py  # Story → JSON extraction (Claude)
│   ├── game_engine.py     # Session management & turn processing
│   ├── requirements.txt
│   └── .env               # ANTHROPIC_API_KEY goes here
│
├── frontend/              # React · TypeScript · Vite · Tailwind CSS
│   └── src/
│       ├── pages/
│       │   ├── UploadPage.tsx    # File upload + rule count
│       │   ├── AnalysisPage.tsx  # Review entities/rules, pick character
│       │   └── GamePage.tsx      # Full game interface
│       ├── components/
│       │   └── EntityPanel.tsx   # Live entity state sidebar
│       ├── api/client.ts         # Typed API calls
│       └── types/index.ts        # Shared TypeScript types
│
└── start.sh               # One-command launcher
```

## Quick start

### Prerequisites

- Python 3.10+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### 1 — Configure

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and set ANTHROPIC_API_KEY=sk-ant-...
```

### 2 — Run

```bash
./start.sh
```

This will:
- Create a Python virtual environment and install dependencies
- Start the FastAPI backend on **http://localhost:8000**
- Install npm packages and start the Vite dev server on **http://localhost:5173**

Open **http://localhost:5173** in your browser.

### Manual start (two terminals)

```bash
# Terminal 1 — backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

## Configuration (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | *(required)* | Your Anthropic API key |
| `ANALYSIS_MODEL` | `claude-opus-4-6` | Model used for story extraction |
| `GAME_MODEL` | `claude-sonnet-4-6` | Model used for gameplay turns |
| `MAX_STORY_CHARS` | `200000` | Truncation limit for long stories |

## API reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/analyze` | Upload file + `num_rules` → `StoryRepresentation` JSON |
| `POST` | `/api/game/start` | Start session → `session_id` + opening message |
| `POST` | `/api/game/{id}/action` | Submit player action → story continuation + state updates |
| `PUT` | `/api/game/{id}/goals` | Update victory/failure conditions mid-game |
| `GET` | `/api/game/{id}/log` | Download full game log as JSON |
| `GET` | `/api/game/{id}/state` | Retrieve current session state |

## State variable types

| Type | Example values |
|---|---|
| `integer` | `0–100` scale (rendered as a progress bar) |
| `float` | Continuous numeric values |
| `boolean` | `true` / `false` |
| `string` | Free-form text |
| `enum` | `alive / wounded / dead` |

## Goal / failure condition syntax

Conditions can be written as **natural language** (evaluated by the LLM) or as **Python-style expressions** over entity state variables (evaluated directly):

```
# Natural language
Hamlet avenges his father's death

# Formal expression  (entity_id.variable_name op value)
hamlet.resolve_to_act >= 90
world.political_stability <= 10 and hamlet.sanity <= 20
```
