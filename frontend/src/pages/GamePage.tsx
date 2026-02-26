import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { gameLogUrl, submitAction, updateGoals } from '../api/client';
import EntityPanel from '../components/EntityPanel';
import type {
  ChatMessage,
  GameActionResponse,
  StateChange,
  StoryRepresentation,
} from '../types';

// ---------------------------------------------------------------------------
// Types for this page
// ---------------------------------------------------------------------------
interface LocationState {
  story: StoryRepresentation;
  sessionId: string;
  openingMessage: string;
  suggestedActions: string[];
  entityStates: Record<string, Record<string, string | number | boolean>>;
  goal: string | null;
  failureConditions: string[];
  playerCharacterId: string;
}

// ---------------------------------------------------------------------------
// Typewriter effect component
// ---------------------------------------------------------------------------
function TypewriterText({ text, speed = 12 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, 1000 / speed);
    return () => clearInterval(interval);
  }, [text, speed]);
  return <span>{displayed}{!done && <span className="animate-pulse text-amber-400">▌</span>}</span>;
}

// ---------------------------------------------------------------------------
// Chat bubble
// ---------------------------------------------------------------------------
function Bubble({
  msg,
  isLatest,
}: {
  msg: ChatMessage;
  isLatest: boolean;
}) {
  const isMaster = msg.role === 'master';
  return (
    <div className={`flex ${isMaster ? 'justify-start' : 'justify-end'} mb-4 animate-slide-up`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
          isMaster
            ? 'bg-slate-800 text-amber-100 border border-slate-700'
            : 'bg-sky-900 text-sky-100 border border-sky-700'
        }`}
      >
        <div className="text-xs mb-1.5 font-semibold opacity-60">
          {isMaster ? '🎭 Game Master' : '⚔ You'}
        </div>
        <div className="whitespace-pre-wrap">
          {isMaster && isLatest ? (
            <TypewriterText text={msg.content} speed={18} />
          ) : (
            msg.content
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goal panel
// ---------------------------------------------------------------------------
function GoalPanel({
  sessionId,
  initialGoal,
  initialFailures,
}: {
  sessionId: string;
  initialGoal: string | null;
  initialFailures: string[];
}) {
  const [goal, setGoal] = useState(initialGoal || '');
  const [failures, setFailures] = useState<string[]>(
    initialFailures.length > 0 ? initialFailures : [''],
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const addFailure = () => setFailures((p) => [...p, '']);
  const updateF = (i: number, v: string) =>
    setFailures((p) => p.map((f, idx) => (idx === i ? v : f)));
  const removeF = (i: number) => setFailures((p) => p.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    try {
      await updateGoals(
        sessionId,
        goal.trim() || null,
        failures.filter((f) => f.trim()),
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="text-slate-400 text-xs uppercase tracking-widest block mb-1">Victory Condition</label>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={2}
          placeholder="Natural language or formal expression…"
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none text-xs"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-slate-400 text-xs uppercase tracking-widest">Failure Conditions</label>
          <button onClick={addFailure} className="text-xs text-red-500 hover:text-red-400">+ Add</button>
        </div>
        {failures.map((f, i) => (
          <div key={i} className="flex gap-1 mb-1">
            <input
              value={f}
              onChange={(e) => updateF(i, e.target.value)}
              placeholder="Condition…"
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500"
            />
            <button onClick={() => removeF(i)} className="text-slate-600 hover:text-red-400 text-xs px-1">✕</button>
          </div>
        ))}
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="w-full py-1.5 rounded text-xs font-semibold transition-all bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-40"
      >
        {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Goals'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// State-change log modal
// ---------------------------------------------------------------------------
function StateChangeBadges({ changes }: { changes: StateChange[] }) {
  if (changes.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mb-3 px-1">
      {changes.map((sc, i) => {
        const increased =
          typeof sc.new_value === 'number' &&
          typeof sc.old_value === 'number' &&
          sc.new_value > sc.old_value;
        const decreased =
          typeof sc.new_value === 'number' &&
          typeof sc.old_value === 'number' &&
          sc.new_value < sc.old_value;
        return (
          <span
            key={i}
            title={sc.reason}
            className={`text-xs px-2 py-0.5 rounded border font-mono ${
              increased
                ? 'border-emerald-700 bg-emerald-900/40 text-emerald-300'
                : decreased
                ? 'border-red-700 bg-red-900/40 text-red-300'
                : 'border-slate-700 bg-slate-800 text-slate-400'
            }`}
          >
            {sc.entity_id}.{sc.variable_name}: {String(sc.old_value)} → {String(sc.new_value)}
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main GamePage
// ---------------------------------------------------------------------------
export default function GamePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  const [chat, setChat] = useState<ChatMessage[]>(() =>
    state
      ? [{ role: 'master', content: state.openingMessage, timestamp: new Date().toISOString() }]
      : [],
  );
  const [entityStates, setEntityStates] = useState(state?.entityStates ?? {});
  const [suggestedActions, setSuggestedActions] = useState(state?.suggestedActions ?? []);
  const [actionInput, setActionInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastChanges, setLastChanges] = useState<StateChange[]>([]);
  const [gameStatus, setGameStatus] = useState<'active' | 'won' | 'lost'>('active');
  const [error, setError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  if (!state) {
    navigate('/');
    return null;
  }

  const { story, sessionId, playerCharacterId } = state;
  const playerEntity = story.entities.find((e) => e.id === playerCharacterId);

  const sendAction = async (action: string) => {
    if (!action.trim() || loading || gameStatus !== 'active') return;
    setError(null);
    setLoading(true);
    setLastChanges([]);

    // Add player message immediately
    const playerMsg: ChatMessage = {
      role: 'player',
      content: action.trim(),
      timestamp: new Date().toISOString(),
    };
    setChat((prev) => [...prev, playerMsg]);
    setActionInput('');

    try {
      const result: GameActionResponse = await submitAction(sessionId, action.trim());

      // Update entity states
      setEntityStates(result.entity_states);
      setLastChanges(result.state_changes);
      setSuggestedActions(result.suggested_actions);
      setGameStatus(result.status);

      // Add master message
      const masterMsg: ChatMessage = {
        role: 'master',
        content: result.story_continuation,
        timestamp: new Date().toISOString(),
      };
      setChat((prev) => [...prev, masterMsg]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      // Remove the player message we optimistically added
      setChat((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAction(actionInput);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950">
        <button onClick={() => navigate('/analysis', { state: { story } })} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
          ← Story
        </button>
        <div className="text-center">
          <h1 className="text-amber-400 font-semibold text-sm">{story.title}</h1>
          <p className="text-slate-500 text-xs">Playing as {playerEntity?.name}</p>
        </div>
        <a
          href={gameLogUrl(sessionId)}
          download
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          ↓ Log
        </a>
      </header>

      {/* Status banner */}
      {gameStatus !== 'active' && (
        <div
          className={`shrink-0 text-center py-2 text-sm font-bold ${
            gameStatus === 'won'
              ? 'bg-emerald-900/60 text-emerald-300 border-b border-emerald-700'
              : 'bg-red-900/60 text-red-300 border-b border-red-700'
          }`}
        >
          {gameStatus === 'won' ? '🏆 Victory — your goal has been achieved!' : '💀 Defeat — a failure condition was triggered.'}
        </div>
      )}

      {/* Three-column layout */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT: Entity panel */}
        <aside className="w-64 shrink-0 border-r border-slate-800 overflow-y-auto bg-slate-950 hidden lg:block">
          <EntityPanel story={story} entityStates={entityStates} lastChanges={lastChanges} />
        </aside>

        {/* CENTER: Chat */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Chat history */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {chat.map((msg, i) => (
              <Bubble key={i} msg={msg} isLatest={i === chat.length - 1 && msg.role === 'master'} />
            ))}

            {loading && (
              <div className="flex justify-start mb-4">
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3">
                  <div className="text-xs mb-1.5 font-semibold opacity-60">🎭 Game Master</div>
                  <div className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* State changes */}
          {lastChanges.length > 0 && (
            <div className="shrink-0 px-4 pt-2 border-t border-slate-800/50">
              <StateChangeBadges changes={lastChanges} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="shrink-0 mx-4 mb-2 bg-red-900/30 border border-red-700 rounded px-3 py-2 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Suggested actions */}
          {gameStatus === 'active' && suggestedActions.length > 0 && (
            <div className="shrink-0 px-4 pb-2 border-t border-slate-800 pt-2">
              <p className="text-slate-600 text-xs mb-1.5">Suggested actions:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => sendAction(action)}
                    disabled={loading}
                    className="text-xs px-3 py-1.5 rounded-full border border-slate-700 bg-slate-800 text-slate-300
                      hover:border-amber-500 hover:text-amber-300 transition-all disabled:opacity-40"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          {gameStatus === 'active' && (
            <div className="shrink-0 px-4 pb-4 pt-2 border-t border-slate-800 flex gap-2">
              <textarea
                ref={inputRef}
                value={actionInput}
                onChange={(e) => setActionInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your action… (Enter to send, Shift+Enter for newline)"
                rows={2}
                disabled={loading}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200
                  placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none disabled:opacity-50 transition-colors"
              />
              <button
                onClick={() => sendAction(actionInput)}
                disabled={loading || !actionInput.trim()}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm
                  disabled:opacity-40 disabled:cursor-not-allowed transition-all self-end"
              >
                {loading ? '…' : '→'}
              </button>
            </div>
          )}
        </main>

        {/* RIGHT: Goals panel */}
        <aside className="w-56 shrink-0 border-l border-slate-800 bg-slate-950 p-3 overflow-y-auto hidden xl:block">
          <p className="text-slate-400 text-xs uppercase tracking-widest mb-3">Goals & Conditions</p>
          <GoalPanel
            sessionId={sessionId}
            initialGoal={state.goal}
            initialFailures={state.failureConditions}
          />

          <div className="mt-6">
            <p className="text-slate-400 text-xs uppercase tracking-widest mb-2">World Rules</p>
            <ul className="space-y-2">
              {story.rules.map((rule, i) => (
                <li key={i} className="text-slate-500 text-xs leading-relaxed border-l-2 border-slate-700 pl-2">
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
