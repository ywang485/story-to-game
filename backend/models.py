from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional, Union
from enum import Enum


class EntityType(str, Enum):
    WORLD = "world"
    CHARACTER = "character"
    OBJECT = "object"
    LOCATION = "location"
    FACTION = "faction"


class DataType(str, Enum):
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    STRING = "string"
    ENUM = "enum"


class StateVariable(BaseModel):
    name: str
    description: str
    data_type: DataType
    range: str  # free-form description of possible values / scale
    initial_value: Union[str, int, float, bool]


class Entity(BaseModel):
    id: str
    type: EntityType
    name: str
    description: str
    state_variables: List[StateVariable] = []


class StoryRepresentation(BaseModel):
    title: str
    opening: str
    theme: Optional[str] = None
    entities: List[Entity]
    rules: List[str]
    num_rules: int


# ── Game session ──────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "player" | "master"
    content: str
    timestamp: str


class StateChange(BaseModel):
    entity_id: str
    variable_name: str
    old_value: Any
    new_value: Any
    reason: str = ""


class RuleApplication(BaseModel):
    rule: str
    explanation: str


class GameLogEntry(BaseModel):
    turn: int
    player_action: str
    state_changes: List[StateChange]
    story_continuation: str
    rules_applied: List[RuleApplication]
    timestamp: str


class GameSession(BaseModel):
    session_id: str
    story: StoryRepresentation
    player_character_id: str
    entity_states: Dict[str, Dict[str, Any]] = {}
    chat_history: List[ChatMessage] = []
    goal: Optional[str] = None
    failure_conditions: List[str] = []
    game_log: List[GameLogEntry] = []
    status: str = "active"  # active | won | lost
    suggested_actions: List[str] = []
    turn_number: int = 0


# ── API request / response models ─────────────────────────────────────────────

class StartGameRequest(BaseModel):
    story: StoryRepresentation
    player_character_id: str
    goal: Optional[str] = None
    failure_conditions: List[str] = []


class StartGameResponse(BaseModel):
    session_id: str
    opening_message: str
    suggested_actions: List[str]
    entity_states: Dict[str, Dict[str, Any]]


class GameActionRequest(BaseModel):
    player_action: str


class GameActionResponse(BaseModel):
    state_changes: List[StateChange]
    story_continuation: str
    rules_applied: List[RuleApplication]
    suggested_actions: List[str]
    goal_met: bool
    failure_met: bool
    ending: Optional[str]
    entity_states: Dict[str, Dict[str, Any]]
    status: str


class UpdateGoalsRequest(BaseModel):
    goal: Optional[str] = None
    failure_conditions: List[str] = []
