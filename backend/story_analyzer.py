"""Story analysis: extract entities, state variables, rules, theme, and opening."""

import json
import os
import re
import io
from pathlib import Path
from typing import Optional

import anthropic

from models import StoryRepresentation

# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def extract_text(filename: str, content: bytes) -> str:
    """Extract plain text from PDF, TXT, or MD file content."""
    suffix = Path(filename).suffix.lower()

    if suffix == ".pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content))
            pages = [page.extract_text() or "" for page in reader.pages]
            return "\n\n".join(pages)
        except Exception as e:
            raise ValueError(f"Failed to parse PDF: {e}")

    if suffix in (".txt", ".md"):
        for enc in ("utf-8", "latin-1", "cp1252"):
            try:
                return content.decode(enc)
            except UnicodeDecodeError:
                continue
        raise ValueError("Could not decode text file.")

    raise ValueError(f"Unsupported file type: {suffix}. Use PDF, TXT, or MD.")


# ---------------------------------------------------------------------------
# Story analysis prompt
# ---------------------------------------------------------------------------

ANALYSIS_PROMPT = """You are analyzing a story to create a textual simulation sandbox.
Read the story carefully, then extract the following information.
Return ONLY valid JSON — no markdown fences, no extra text.

CRITICAL CONSTRAINTS:
- State variables must ONLY cover aspects of entities that change NON-TRIVIALLY throughout the story. Omit static traits, fixed attributes, or things that never meaningfully change.
- Rules must be SPECIFIC to this storyworld's logic — not generic common sense applicable to every story.
- Always include an entity with id="world" representing the entire fictional world.
- initial_value for each state variable should reflect the state at the very beginning of the story.

Number of rules to extract: {num_rules}

Return JSON exactly matching this schema:
{{
  "title": "Story title (infer if not stated)",
  "opening": "2-3 paragraph adventure-game opening in second person (You...) that introduces the player to the world and their character's starting situation, inspired by but not copied from the story's opening",
  "theme": "One paragraph summarizing the author's central message or theme, or null if not strongly present",
  "entities": [
    {{
      "id": "snake_case_unique_id",
      "type": "world | character | object | location | faction",
      "name": "Human-readable name",
      "description": "One paragraph describing this entity",
      "state_variables": [
        {{
          "name": "snake_case_variable_name",
          "description": "What this variable represents and why it matters",
          "data_type": "integer | float | boolean | string | enum",
          "range": "Free-form description of possible values, e.g. '0-100 where 0 is dead and 100 is thriving', or 'alive / wounded / dead', or 'any descriptive text'",
          "initial_value": <value at the very start of the story>
        }}
      ]
    }}
  ],
  "rules": [
    "Rule specific to this storyworld's dynamics",
    ...
  ]
}}

Story text:
---
{story_text}
---"""


# ---------------------------------------------------------------------------
# Analyser
# ---------------------------------------------------------------------------

def analyze_story(story_text: str, num_rules: int) -> StoryRepresentation:
    """Call Claude to extract story structure and return a StoryRepresentation."""
    max_chars = int(os.getenv("MAX_STORY_CHARS", "200000"))
    if len(story_text) > max_chars:
        story_text = story_text[:max_chars] + "\n\n[... story truncated for length ...]"

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    model = os.getenv("ANALYSIS_MODEL", "claude-opus-4-6")

    prompt = ANALYSIS_PROMPT.format(num_rules=num_rules, story_text=story_text)

    raw = _call_claude(client, model, prompt, max_tokens=8192)
    data = _extract_json(raw)

    # Inject num_rules so the representation carries it
    data["num_rules"] = num_rules

    try:
        return StoryRepresentation(**data)
    except Exception as e:
        raise ValueError(f"Parsed JSON does not match expected schema: {e}\n\nRaw response:\n{raw[:2000]}")


def _call_claude(client: anthropic.Anthropic, model: str, prompt: str, max_tokens: int = 4096) -> str:
    """Send a single-turn message and return the text response."""
    message = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


def _extract_json(text: str) -> dict:
    """Robustly extract JSON from Claude's response."""
    # Try direct parse first
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to find JSON between ```json ... ``` fences
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence_match:
        try:
            return json.loads(fence_match.group(1))
        except json.JSONDecodeError:
            pass

    # Try to extract the outermost { ... } block
    brace_match = re.search(r"\{.*\}", text, re.DOTALL)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not extract valid JSON from Claude's response. First 500 chars:\n{text[:500]}")
