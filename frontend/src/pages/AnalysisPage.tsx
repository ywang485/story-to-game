import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { startGame } from '../api/client';
import type { DataType, Entity, EntityType, StateVariable, StoryRepresentation } from '../types';

const TYPE_COLORS: Record<string, string> = {
  world: 'bg-violet-800 text-violet-200',
  character: 'bg-sky-800 text-sky-200',
  object: 'bg-amber-800 text-amber-200',
  location: 'bg-emerald-800 text-emerald-200',
  faction: 'bg-rose-800 text-rose-200',
};

const ENTITY_TYPES: EntityType[] = ['world', 'character', 'object', 'location', 'faction'];
const DATA_TYPES: DataType[] = ['integer', 'float', 'boolean', 'string', 'enum'];

function EntityCard({
  entity,
  onChange,
  onRemove,
}: {
  entity: Entity;
  onChange: (updated: Entity) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(entity.type === 'character' || entity.type === 'world');

  const set = <K extends keyof Entity>(field: K, value: Entity[K]) =>
    onChange({ ...entity, [field]: value });

  const setVar = (i: number, field: keyof StateVariable, value: StateVariable[keyof StateVariable]) =>
    onChange({
      ...entity,
      state_variables: entity.state_variables.map((v, idx) =>
        idx === i ? { ...v, [field]: value } : v,
      ),
    });

  const addVar = () =>
    onChange({
      ...entity,
      state_variables: [
        ...entity.state_variables,
        { name: '', description: '', data_type: 'string' as DataType, range: '', initial_value: '' },
      ],
    });

  const removeVar = (i: number) =>
    onChange({
      ...entity,
      state_variables: entity.state_variables.filter((_, idx) => idx !== i),
    });

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-slate-500 hover:text-slate-300 text-xs w-4 shrink-0 transition-colors"
        >
          {open ? '▲' : '▼'}
        </button>
        <select
          value={entity.type}
          onChange={(e) => set('type', e.target.value as EntityType)}
          className={`text-xs px-2 py-0.5 rounded font-medium cursor-pointer border-0 focus:outline-none ${TYPE_COLORS[entity.type] || 'bg-slate-700 text-slate-300'}`}
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          value={entity.name}
          onChange={(e) => set('name', e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-slate-100 font-medium text-sm focus:outline-none focus:bg-slate-700 rounded px-1 -mx-1"
          placeholder="Entity name…"
        />
        <button
          onClick={onRemove}
          className="text-slate-600 hover:text-red-400 text-xs transition-colors shrink-0 ml-1"
          title="Remove entity"
        >
          ✕
        </button>
      </div>

      {open && (
        <div className="px-3 pb-3 pt-2 space-y-2">
          {/* Description */}
          <textarea
            value={entity.description}
            onChange={(e) => set('description', e.target.value)}
            rows={2}
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-slate-500 resize-none"
            placeholder="Entity description…"
          />

          {/* State variables */}
          <div className="flex items-center justify-between">
            <p className="text-slate-500 text-xs uppercase tracking-widest">State Variables</p>
            <button
              onClick={addVar}
              className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              + Add variable
            </button>
          </div>

          {entity.state_variables.length === 0 && (
            <p className="text-slate-600 text-xs italic">No state variables.</p>
          )}

          <div className="space-y-2">
            {entity.state_variables.map((v, i) => (
              <div key={i} className="bg-slate-800 rounded px-3 py-2 space-y-1.5">
                {/* Row 1: name · type · = · initial_value · remove */}
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    value={v.name}
                    onChange={(e) => setVar(i, 'name', e.target.value)}
                    className="flex-1 min-w-0 bg-slate-700 rounded px-2 py-0.5 text-sm text-amber-300 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="variable_name"
                  />
                  <select
                    value={v.data_type}
                    onChange={(e) => setVar(i, 'data_type', e.target.value as DataType)}
                    className="bg-slate-700 text-slate-400 text-xs rounded px-1.5 py-0.5 focus:outline-none"
                  >
                    {DATA_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <span className="text-slate-600 text-xs">=</span>
                  <input
                    value={String(v.initial_value)}
                    onChange={(e) => setVar(i, 'initial_value', e.target.value)}
                    className="w-24 bg-slate-700 rounded px-2 py-0.5 text-sm text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="initial"
                  />
                  <button
                    onClick={() => removeVar(i)}
                    className="text-slate-600 hover:text-red-400 text-xs transition-colors"
                    title="Remove variable"
                  >
                    ✕
                  </button>
                </div>
                {/* Row 2: description */}
                <input
                  value={v.description}
                  onChange={(e) => setVar(i, 'description', e.target.value)}
                  className="w-full bg-slate-700 rounded px-2 py-0.5 text-xs text-slate-400 focus:outline-none"
                  placeholder="Description…"
                />
                {/* Row 3: range */}
                <input
                  value={v.range}
                  onChange={(e) => setVar(i, 'range', e.target.value)}
                  className="w-full bg-slate-700 rounded px-2 py-0.5 text-xs text-slate-500 italic focus:outline-none"
                  placeholder="Range / possible values…"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalysisPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [story] = useState<StoryRepresentation>(
    location.state?.story as StoryRepresentation,
  );
  const [entities, setEntities] = useState<Entity[]>(story?.entities ?? []);
  const [rules, setRules] = useState<string[]>(story?.rules ?? []);
  const [selectedCharId, setSelectedCharId] = useState<string>('');
  const [goal, setGoal] = useState(story?.goal ?? '');
  const [failureInputs, setFailureInputs] = useState<string[]>(
    story?.failure_conditions?.length ? story.failure_conditions : [''],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!story) {
    navigate('/');
    return null;
  }

  const characters = entities.filter((e) => e.type === 'character');

  const exportStory = () => {
    const failures = failureInputs.filter((f) => f.trim() !== '');
    const data = JSON.stringify({
      ...story,
      rules,
      entities,
      goal: goal.trim() || undefined,
      failure_conditions: failures.length ? failures : undefined,
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${story.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.story.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Entity handlers ──────────────────────────────────────────────────────────

  const updateEntity = (i: number, updated: Entity) =>
    setEntities((prev) => prev.map((e, idx) => (idx === i ? updated : e)));

  const removeEntity = (i: number) => {
    if (entities[i].id === selectedCharId) setSelectedCharId('');
    setEntities((prev) => prev.filter((_, idx) => idx !== i));
  };

  const addEntity = () =>
    setEntities((prev) => [
      ...prev,
      {
        id: `entity_${Date.now()}`,
        type: 'character' as EntityType,
        name: 'New Entity',
        description: '',
        state_variables: [],
      },
    ]);

  // ── Rule handlers ────────────────────────────────────────────────────────────

  const updateRule = (i: number, val: string) =>
    setRules((prev) => prev.map((r, idx) => (idx === i ? val : r)));
  const addRule = () => setRules((prev) => [...prev, '']);
  const removeRule = (i: number) => setRules((prev) => prev.filter((_, idx) => idx !== i));

  // ── Failure handlers ─────────────────────────────────────────────────────────

  const addFailure = () => setFailureInputs((prev) => [...prev, '']);
  const updateFailure = (i: number, val: string) =>
    setFailureInputs((prev) => prev.map((f, idx) => (idx === i ? val : f)));
  const removeFailure = (i: number) =>
    setFailureInputs((prev) => prev.filter((_, idx) => idx !== i));

  // ── Start game ───────────────────────────────────────────────────────────────

  const onStartGame = async () => {
    if (!selectedCharId) return;
    setLoading(true);
    setError(null);
    const updatedStory = { ...story, rules, entities };
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
        <button
          onClick={exportStory}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          title="Export story representation as JSON"
        >
          ↓ Export JSON
        </button>
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
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-slate-400 text-xs uppercase tracking-widest">
                Entities ({entities.length})
              </h2>
              <button
                onClick={addEntity}
                className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
              >
                + Add entity
              </button>
            </div>
            <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
              {entities.map((e, i) => (
                <EntityCard
                  key={e.id}
                  entity={e}
                  onChange={(updated) => updateEntity(i, updated)}
                  onRemove={() => removeEntity(i)}
                />
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
