import type {
  GameActionResponse,
  StartGameResponse,
  StoryRepresentation,
} from '../types';

const BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function analyzeStory(
  file: File,
  numRules: number,
): Promise<StoryRepresentation> {
  const form = new FormData();
  form.append('file', file);
  form.append('num_rules', String(numRules));
  const res = await fetch(`${BASE}/analyze`, { method: 'POST', body: form });
  return handleResponse<StoryRepresentation>(res);
}

export async function startGame(
  story: StoryRepresentation,
  playerCharacterId: string,
  goal?: string,
  failureConditions?: string[],
): Promise<StartGameResponse> {
  const res = await fetch(`${BASE}/game/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      story,
      player_character_id: playerCharacterId,
      goal: goal || null,
      failure_conditions: failureConditions || [],
    }),
  });
  return handleResponse<StartGameResponse>(res);
}

export async function submitAction(
  sessionId: string,
  playerAction: string,
): Promise<GameActionResponse> {
  const res = await fetch(`${BASE}/game/${sessionId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_action: playerAction }),
  });
  return handleResponse<GameActionResponse>(res);
}

export async function updateGoals(
  sessionId: string,
  goal: string | null,
  failureConditions: string[],
): Promise<void> {
  const res = await fetch(`${BASE}/game/${sessionId}/goals`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, failure_conditions: failureConditions }),
  });
  await handleResponse<void>(res);
}

export function gameLogUrl(sessionId: string): string {
  return `${BASE}/game/${sessionId}/log`;
}
