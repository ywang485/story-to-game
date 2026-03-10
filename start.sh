#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; AMBER='\033[0;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[story-to-game]${NC} $*"; }
warn()  { echo -e "${AMBER}[story-to-game]${NC} $*"; }
error() { echo -e "${RED}[story-to-game]${NC} $*"; }

# ── Check .env ───────────────────────────────────────────────────────────────
if [ ! -f "$BACKEND_DIR/.env" ]; then
  if [ -f "$BACKEND_DIR/.env.example" ]; then
    warn ".env not found — copying from .env.example"
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    warn "Edit backend/.env and add your ANTHROPIC_API_KEY, then re-run this script."
    exit 1
  fi
fi

if ! grep -q "ANTHROPIC_API_KEY=sk-" "$BACKEND_DIR/.env" 2>/dev/null; then
  error "ANTHROPIC_API_KEY not set in backend/.env — please add it."
  exit 1
fi

# ── Backend ───────────────────────────────────────────────────────────────────
info "Setting up Python backend…"
cd "$BACKEND_DIR"

if [ ! -d "venv" ]; then
  python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt

info "Starting backend on http://localhost:8000 …"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# ── Frontend ──────────────────────────────────────────────────────────────────
info "Setting up frontend…"
cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
  info "Installing npm packages…"
  npm install
fi

info "Starting frontend on http://localhost:5173 …"
npm run dev &
FRONTEND_PID=$!

# ── Cleanup on exit ───────────────────────────────────────────────────────────
cleanup() {
  info 'Shutting down…'
  # uvicorn --reload spawns a worker child under the reloader parent.
  # Kill children first so the reloader doesn't hang waiting for them.
  pkill -P "$BACKEND_PID"  2>/dev/null || true
  pkill -P "$FRONTEND_PID" 2>/dev/null || true
  # Now kill the parent processes gracefully.
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  # Give them a moment; force-kill anything still alive.
  sleep 0.8
  kill -9 "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

info ""
info "  Backend:  http://localhost:8000"
info "  Frontend: http://localhost:5173"
info ""
info "Press Ctrl+C to stop."

wait
