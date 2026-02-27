export type EntityType = 'world' | 'character' | 'object' | 'location' | 'faction';
export type DataType = 'integer' | 'float' | 'boolean' | 'string' | 'enum';

export interface StateVariable {
  name: string;
  description: string;
  data_type: DataType;
  range: string;
  initial_value: string | number | boolean;
}

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  description: string;
  state_variables: StateVariable[];
}

export interface StoryRepresentation {
  title: string;
  opening: string;
  theme: string | null;
  entities: Entity[];
  rules: string[];
  num_rules: number;
  goal?: string;
  failure_conditions?: string[];
}

export interface StateChange {
  entity_id: string;
  variable_name: string;
  old_value: string | number | boolean;
  new_value: string | number | boolean;
  reason: string;
}

export interface RuleApplication {
  rule: string;
  explanation: string;
}

export interface ChatMessage {
  role: 'player' | 'master';
  content: string;
  timestamp: string;
}

export interface StartGameResponse {
  session_id: string;
  opening_message: string;
  suggested_actions: string[];
  entity_states: Record<string, Record<string, string | number | boolean>>;
}

export interface GameActionResponse {
  state_changes: StateChange[];
  story_continuation: string;
  rules_applied: RuleApplication[];
  suggested_actions: string[];
  goal_met: boolean;
  failure_met: boolean;
  ending: string | null;
  entity_states: Record<string, Record<string, string | number | boolean>>;
  status: 'active' | 'won' | 'lost';
}
