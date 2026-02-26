"""Game engine: session management, turn processing, state evaluation."""

import ast
import json
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import anthropic

from models import (
    ChatMessage,
    Entity,
    GameActionResponse,
    GameLogEntry,
    GameSession,
    RuleApplication,
    StartGameResponse,
    StateChange,
    StoryRepresentation,
)

# In-memory session store  {session_id -> GameSession}
SESSIONS: Dict[str, GameSession] = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def _game_model() -> str:
    return os.getenv("GAME_MODEL", "claude-sonnet-4-6")


def _call(client: anthropic.Anthropic, prompt: str, max_tokens: int = 4096) -> str:
    msg = client.messages.create(
        model=_game_model(),
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text


def _extract_json(text: str) -> dict:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        try:
            return json.loads(fence.group(1))
        except json.JSONDecodeError:
            pass
    brace = re.search(r"\{.*\}", text, re.DOTALL)
    if brace:
        try:
            return json.loads(brace.group(0))
        except json.JSONDecodeError:
            pass
    raise ValueError(f"Cannot extract JSON from response: {text[:300]}")


def _entity_by_id(story: StoryRepresentation, entity_id: str) -> Optional[Entity]:
    for e in story.entities:
        if e.id == entity_id:
            return e
    return None


def _format_entity_states(story: StoryRepresentation, states: Dict[str, Dict[str, Any]]) -> str:
    lines = []
    for entity in story.entities:
        state = states.get(entity.id, {})
        lines.append(f"### {entity.name} ({entity.type})")
        if not entity.state_variables:
            lines.append("  (no tracked state variables)")
        for var in entity.state_variables:
            val = state.get(var.name, var.initial_value)
            lines.append(f"  - {var.name}: {val}  [{var.range}]")
        lines.append("")
    return "\n".join(lines)


def _format_recent_history(chat_history: List[ChatMessage], n: int = 10) -> str:
    recent = chat_history[-n:] if len(chat_history) > n else chat_history
    lines = []
    for msg in recent:
        role = "Game Master" if msg.role == "master" else "Player"
        lines.append(f"{role}: {msg.content}")
    return "\n\n".join(lines)


# ---------------------------------------------------------------------------
# Goal / failure evaluation
# ---------------------------------------------------------------------------

def _safe_eval_expr(expr: str, states: Dict[str, Dict[str, Any]]) -> Optional[bool]:
    """Try to evaluate a formal expression like 'hamlet.health <= 0'.
    Returns None if expression is not evaluable as code (treat as NL)."""
    # Build a flat namespace: entity_id.var_name accessible as attributes
    class _EntityProxy:
        def __init__(self, d):
            self.__dict__.update(d)

    ns = {eid: _EntityProxy(vals) for eid, vals in states.items()}

    # Only allow safe characters
    if not re.match(r'^[\w\s\.\+\-\*\/\%\<\>\=\!\(\)\&\|\,]+$', expr):
        return None
    try:
        result = eval(expr, {"__builtins__": {}}, ns)  # noqa: S307
        if isinstance(result, bool):
            return result
        return bool(result)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Game session lifecycle
# ---------------------------------------------------------------------------

OPENING_PROMPT = """You are the Game Master for a text adventure based on the following story.

Story Title: {title}
World Rules:
{rules}

The player is playing as: {character_name}
Character description: {character_description}

Current state of the world:
{entity_states}

Write a compelling 2-3 paragraph opening for the text adventure in second person ("You...").
Set the scene, introduce the player's character and their situation, and hint at the central conflict.
Make it immersive and true to the story's tone. End with the player in a moment of decision or tension.
Return ONLY the opening text, no JSON, no extra formatting."""


TURN_PROMPT = """You are the Game Master for a text adventure simulation.

## Story: {title}
## Theme: {theme}

## World Rules (specific to this story):
{rules}

## Entity Descriptions:
{entity_descriptions}

## Current State of the World:
{entity_states}

## Player Character: {character_name}
{character_description}

## Story So Far (recent events):
{recent_history}

## Player's Action:
"{player_action}"

## Player's Goal (if set): {goal}
## Failure Conditions (if set): {failure_conditions}

Your tasks:
1. Determine which state variables change as a direct result of this action (following the world rules). Be selective — only change what is genuinely affected.
2. Write 2-3 paragraphs of story continuation in second person ("You...") that vividly portrays the consequences of the action and advances the narrative.
3. Note which world rules were applied and how.
4. Suggest 3-4 distinct actions the player could take next, based on their character and current situation.
5. Assess whether the player's goal has been achieved and/or whether any failure conditions have been triggered. For natural-language conditions, use your best judgment.

Respond with ONLY valid JSON (no markdown fences):
{{
  "state_changes": [
    {{
      "entity_id": "...",
      "variable_name": "...",
      "old_value": <current value>,
      "new_value": <updated value>,
      "reason": "Brief explanation (one short sentence)"
    }}
  ],
  "story_continuation": "2-3 paragraphs...",
  "rules_applied": [
    {{"rule": "...", "explanation": "How it applied here"}}
  ],
  "suggested_actions": ["action 1", "action 2", "action 3", "action 4"],
  "goal_met": false,
  "failure_met": false,
  "ending": null
}}

If goal_met or failure_met is true, provide a satisfying conclusive ending paragraph in the "ending" field."""


SUGGESTIONS_ONLY_PROMPT = """Based on the current situation in this story world, suggest 3-4 actions the player could take.

Player character: {character_name}
Character description: {character_description}
Current world state: {entity_states}
Recent events: {recent_history}

Return ONLY valid JSON:
{{"suggested_actions": ["action 1", "action 2", "action 3"]}}"""


def start_game(
    story: StoryRepresentation,
    player_character_id: str,
    goal: Optional[str],
    failure_conditions: List[str],
) -> Tuple[str, GameSession, StartGameResponse]:
    """Create a new game session and generate the opening message."""
    # Initialize entity states from initial_value fields
    entity_states: Dict[str, Dict[str, Any]] = {}
    for entity in story.entities:
        entity_states[entity.id] = {
            var.name: var.initial_value for var in entity.state_variables
        }

    player_entity = _entity_by_id(story, player_character_id)
    if player_entity is None:
        raise ValueError(f"Character '{player_character_id}' not found in story entities.")

    client = _client()

    # Generate opening message
    entity_descriptions = "\n\n".join(
        f"**{e.name}** ({e.type}): {e.description}" for e in story.entities
    )
    formatted_states = _format_entity_states(story, entity_states)
    rules_text = "\n".join(f"- {r}" for r in story.rules)

    opening_prompt = OPENING_PROMPT.format(
        title=story.title,
        rules=rules_text,
        character_name=player_entity.name,
        character_description=player_entity.description,
        entity_states=formatted_states,
    )
    opening_text = _call(client, opening_prompt, max_tokens=1024)

    # Generate initial suggestions
    sugg_prompt = SUGGESTIONS_ONLY_PROMPT.format(
        character_name=player_entity.name,
        character_description=player_entity.description,
        entity_states=formatted_states,
        recent_history=opening_text,
    )
    try:
        sugg_data = _extract_json(_call(client, sugg_prompt, max_tokens=512))
        suggestions = sugg_data.get("suggested_actions", [])
    except Exception:
        suggestions = []

    session_id = str(uuid.uuid4())
    initial_chat = ChatMessage(role="master", content=opening_text, timestamp=_now())

    session = GameSession(
        session_id=session_id,
        story=story,
        player_character_id=player_character_id,
        entity_states=entity_states,
        chat_history=[initial_chat],
        goal=goal,
        failure_conditions=failure_conditions,
        suggested_actions=suggestions,
        turn_number=0,
    )
    SESSIONS[session_id] = session

    response = StartGameResponse(
        session_id=session_id,
        opening_message=opening_text,
        suggested_actions=suggestions,
        entity_states=entity_states,
    )
    return session_id, session, response


def process_action(session_id: str, player_action: str) -> GameActionResponse:
    """Process a player action: update states, generate story continuation."""
    session = SESSIONS.get(session_id)
    if session is None:
        raise ValueError(f"Session '{session_id}' not found.")
    if session.status != "active":
        raise ValueError("Game is already over.")

    story = session.story
    client = _client()

    player_entity = _entity_by_id(story, session.player_character_id)
    character_name = player_entity.name if player_entity else session.player_character_id
    character_description = player_entity.description if player_entity else ""

    entity_descriptions = "\n\n".join(
        f"**{e.name}** ({e.type}): {e.description}" for e in story.entities
    )
    formatted_states = _format_entity_states(story, session.entity_states)
    rules_text = "\n".join(f"- {r}" for r in story.rules)
    recent_history = _format_recent_history(session.chat_history)

    goal_text = session.goal or "None set"
    failure_text = (
        "\n".join(f"- {c}" for c in session.failure_conditions)
        if session.failure_conditions
        else "None set"
    )

    prompt = TURN_PROMPT.format(
        title=story.title,
        theme=story.theme or "Not specified",
        rules=rules_text,
        entity_descriptions=entity_descriptions,
        entity_states=formatted_states,
        character_name=character_name,
        character_description=character_description,
        recent_history=recent_history,
        player_action=player_action,
        goal=goal_text,
        failure_conditions=failure_text,
    )

    raw = _call(client, prompt, max_tokens=4096)
    data = _extract_json(raw)

    # Parse state changes
    state_changes: List[StateChange] = []
    for sc in data.get("state_changes", []):
        entity_id = sc.get("entity_id", "")
        var_name = sc.get("variable_name", "")
        old_val = session.entity_states.get(entity_id, {}).get(var_name)
        new_val = sc.get("new_value")
        state_changes.append(StateChange(
            entity_id=entity_id,
            variable_name=var_name,
            old_value=old_val,
            new_value=new_val,
            reason=sc.get("reason", ""),
        ))
        # Apply change to session
        if entity_id in session.entity_states and var_name in session.entity_states[entity_id]:
            session.entity_states[entity_id][var_name] = new_val

    rules_applied = [
        RuleApplication(rule=r.get("rule", ""), explanation=r.get("explanation", ""))
        for r in data.get("rules_applied", [])
    ]
    story_continuation = data.get("story_continuation", "")
    suggested_actions = data.get("suggested_actions", [])
    goal_met = bool(data.get("goal_met", False))
    failure_met = bool(data.get("failure_met", False))
    ending = data.get("ending")

    # Also evaluate formal expressions in conditions
    if not goal_met and session.goal:
        result = _safe_eval_expr(session.goal, session.entity_states)
        if result is True:
            goal_met = True

    if not failure_met:
        for cond in session.failure_conditions:
            result = _safe_eval_expr(cond, session.entity_states)
            if result is True:
                failure_met = True
                break

    # Update session status
    new_status = "active"
    if goal_met:
        new_status = "won"
    elif failure_met:
        new_status = "lost"
    session.status = new_status

    # Append messages to chat history
    session.turn_number += 1
    session.chat_history.append(ChatMessage(role="player", content=player_action, timestamp=_now()))
    master_content = story_continuation
    if ending:
        master_content = story_continuation + "\n\n" + ending
    session.chat_history.append(ChatMessage(role="master", content=master_content, timestamp=_now()))

    session.suggested_actions = suggested_actions if new_status == "active" else []

    # Log the turn
    log_entry = GameLogEntry(
        turn=session.turn_number,
        player_action=player_action,
        state_changes=state_changes,
        story_continuation=master_content,
        rules_applied=rules_applied,
        timestamp=_now(),
    )
    session.game_log.append(log_entry)

    return GameActionResponse(
        state_changes=state_changes,
        story_continuation=master_content,
        rules_applied=rules_applied,
        suggested_actions=session.suggested_actions,
        goal_met=goal_met,
        failure_met=failure_met,
        ending=ending,
        entity_states=session.entity_states,
        status=new_status,
    )


def get_session(session_id: str) -> GameSession:
    session = SESSIONS.get(session_id)
    if session is None:
        raise ValueError(f"Session '{session_id}' not found.")
    return session


def update_goals(session_id: str, goal: Optional[str], failure_conditions: List[str]) -> None:
    session = SESSIONS.get(session_id)
    if session is None:
        raise ValueError(f"Session '{session_id}' not found.")
    session.goal = goal
    session.failure_conditions = failure_conditions


def get_game_log(session_id: str) -> dict:
    session = get_session(session_id)
    return {
        "session_id": session_id,
        "story_title": session.story.title,
        "player_character": session.player_character_id,
        "status": session.status,
        "goal": session.goal,
        "failure_conditions": session.failure_conditions,
        "turns": [entry.model_dump() for entry in session.game_log],
    }
