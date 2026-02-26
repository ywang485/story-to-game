import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { startGame } from '../api/client';
import type { Entity, StoryRepresentation } from '../types';

const TYPE_COLORS: Record<string, string> = {
  world: 'bg-violet-800 text-violet-200',
  character: 'bg-sky-800 text-sky-200',
  object: 'bg-amber-800 text-amber-200',
  location: 'bg-emerald-800 text-emerald-200',
  faction: 'bg-rose-800 text-rose-200',
};

function EntityCard({ entity }: { entity: Entity }) {
  const [open, setOpen] = useState(entity.type === 'character' || entity.type === 'world');
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800 transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_COLORS[entity.type] || 'bg-slate-700 text-slate-300'}`}>
            {entity.type}
          </span>
          <span className="text-slate-100 font-medium">{entity.name}</span>
        </div>
        <span className="text-slate-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm">
          <p className="text-slate-400 leading-relaxed mb-3">{entity.description}</p>
          {entity.state_variables.length > 0 && (
            <>
              <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">State Variables</p>
              <div className="space-y-2">
                {entity.state_variables.map((v) => (
                  <div key={v.name} className="flex items-start gap-3 bg-slate-800 rounded px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-amber-300 font-medium">{v.name}</span>
                        <span className="text-slate-600 text-xs">{v.data_type}</span>
                        <span className="text-emerald-500 text-xs font-medium">
                          = {String(v.initial_value)}
                        </span>
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5">{v.description}</p>
                      <p className="text-slate-600 text-xs italic">Range: {v.range}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AnalysisPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [story, setStory] = useState<StoryRepresentation>(
    location.state?.story as StoryRepresentation,
  );
  const [rules, setRules] = useState<string[]>(story?.rules ?? []);
  const [selectedCharId, setSelectedCharId] = useState<string>('');
  const [goal, setGoal] = useState('');
  const [failureInputs, setFailureInputs] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!story) {
    navigate('/');
    return null;
  }

  const characters = story.entities.filter((e) => e.type === 'character');

  const updateRule = (i: number, val: string) => {
    setRules((prev) => prev.map((r, idx) => (idx === i ? val : r)));
  };

  const addRule = () => setRules((prev) => [...prev, '']);
  const removeRule = (i: number) => setRules((prev) => prev.filter((_, idx) => idx !== i));

  const addFailure = () => setFailureInputs((prev) => [...prev, '']);
  const updateFailure = (i: number, val: string) =>
    setFailureInputs((prev) => prev.map((f, idx) => (idx === i ? val : f)));
  const removeFailure = (i: number) =>
    setFailureInputs((prev) => prev.filter((_, idx) => idx !== i));

  const onStartGame = async () => {
    if (!selectedCharId) return;
    setLoading(true);
    setError(null);
    const updatedStory = { ...story, rules };
    const failures = failureInputs.filter((f) => f.trim() !== '');
    try {
      const resp = await startGame(
        updatedStory,
        selectedCharId,
        goal.trim() || undefined,
        failures,
      );
      navigate('/game', {
        state: {
          story: updatedStory,
          sessionId: resp.session_id,
          openingMessage: resp.opening_message,
          suggestedActions: resp.suggested_actions,
          entityStates: resp.entity_states,
          goal: goal.trim() || null,
          failureConditions: failures,
          playerCharacterId: selectedCharId,
        },
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-950 sticky top-0 z-10">
        <button onClick={() => navigate('/')} className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
          ← Back
        </button>
        <h1 className="text-amber-400 font-semibold text-lg">{story.title}</h1>
        <div className="w-16" />
      </header>

      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* LEFT: Story overview */}
        <div className="space-y-6">
          {/* Opening */}
          <section>
            <h2 className="text-slate-400 text-xs uppercase tracking-widest mb-2">Adventure Opening</h2>
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-slate-300 text-sm leading-relaxed italic">
              {story.opening}
            </div>
          </section>

          {/* Theme */}
          {story.theme && (
            <section>
              <h2 className="text-slate-400 text-xs uppercase tracking-widest mb-2">Author's Theme</h2>
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-slate-400 text-sm leading-relaxed">
                {story.theme}
              </div>
            </section>
          )}

          {/* Rules */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-slate-400 text-xs uppercase tracking-widest">World Rules</h2>
              <button onClick={addRule} className="text-xs text-amber-500 hover:text-amber-400 transition-colors">
                + Add rule
              </button>
            </div>
            <div className="space-y-2">
              {rules.map((rule, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-slate-600 text-xs mt-2.5 w-5 shrink-0">{i + 1}.</span>
                  <input
                    value={rule}
                    onChange={(e) => updateRule(i, e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                  <button
                    onClick={() => removeRule(i)}
                    className="text-slate-600 hover:text-red-400 text-xs mt-2.5 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT: Entities + Game start */}
        <div className="space-y-6">
          {/* Entities */}
          <section>
            <h2 className="text-slate-400 text-xs uppercase tracking-widest mb-2">
              Entities ({story.entities.length})
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {story.entities.map((e) => (
                <EntityCard key={e.id} entity={e} />
              ))}
            </div>
          </section>

          {/* Character select */}
          <section className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <h2 className="text-slate-400 text-xs uppercase tracking-widest mb-3">Play as</h2>
            <div className="grid grid-cols-2 gap-2">
              {characters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCharId(c.id)}
                  className={`px-3 py-2 rounded text-sm text-left transition-all border ${
                    selectedCharId === c.id
                      ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                      : 'border-slate-700 hover:border-slate-500 text-slate-300'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            {characters.length === 0 && (
              <p className="text-slate-500 text-sm">No character entities detected.</p>
            )}
          </section>

          {/* Goal */}
          <section className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-3">
            <h2 className="text-slate-400 text-xs uppercase tracking-widest">Victory Condition (optional)</h2>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Hamlet avenges his father  |  hamlet.resolve_to_act >= 90"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />

            <div className="flex items-center justify-between">
              <h2 className="text-slate-400 text-xs uppercase tracking-widest">Failure Conditions (optional)</h2>
              <button onClick={addFailure} className="text-xs text-red-500 hover:text-red-400 transition-colors">
                + Add
              </button>
            </div>
            {failureInputs.map((f, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={f}
                  onChange={(e) => updateFailure(i, e.target.value)}
                  placeholder="e.g. Hamlet loses his sanity  |  hamlet.sanity <= 0"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors"
                />
                <button onClick={() => removeFailure(i)} className="text-slate-600 hover:text-red-400 text-xs transition-colors">
                  ✕
                </button>
              </div>
            ))}
          </section>

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={onStartGame}
            disabled={!selectedCharId || loading}
            className="w-full py-3 rounded-lg font-semibold text-sm transition-all
              disabled:opacity-40 disabled:cursor-not-allowed
              bg-amber-500 hover:bg-amber-400 text-slate-950"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Generating opening…
              </span>
            ) : (
              `Start Adventure as ${characters.find((c) => c.id === selectedCharId)?.name || '…'} →`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
