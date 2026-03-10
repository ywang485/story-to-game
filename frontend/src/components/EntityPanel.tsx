import { useEffect, useRef, useState } from 'react';
import type { StateChange, StoryRepresentation } from '../types';

const TYPE_ICONS: Record<string, string> = {
  world: '🌍',
  character: '👤',
  object: '📦',
  location: '📍',
  faction: '⚔',
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/** Try to parse "0-100" or "0 to 100" style ranges */
function parseRange(range: string): [number, number] | null {
  const m = range.match(/(-?\d+(?:\.\d+)?)\s*[-–to]+\s*(-?\d+(?:\.\d+)?)/i);
  if (m) return [parseFloat(m[1]), parseFloat(m[2])];
  return null;
}

interface VarRowProps {
  name: string;
  value: string | number | boolean;
  range: string;
  dataType: string;
  changed: boolean;
}

function VarRow({ name, value, range, dataType, changed }: VarRowProps) {
  const prevChanged = useRef(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (changed && !prevChanged.current) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1500);
      return () => clearTimeout(t);
    }
    prevChanged.current = changed;
  }, [changed]);

  const parsedRange = (dataType === 'integer' || dataType === 'float') ? parseRange(range) : null;
  const numVal = typeof value === 'number' ? value : parseFloat(String(value));
  const showBar = parsedRange !== null && !isNaN(numVal);
  const pct = showBar
    ? ((clamp(numVal, parsedRange[0], parsedRange[1]) - parsedRange[0]) /
        (parsedRange[1] - parsedRange[0])) *
      100
    : 0;

  return (
    <div
      className={`px-3 py-1.5 transition-colors duration-700 ${
        flash ? 'bg-amber-500/10' : 'bg-transparent'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-400 text-xs truncate">{name}</span>
        <span
          className={`text-xs font-mono font-medium shrink-0 ${
            flash ? 'text-amber-300' : 'text-slate-200'
          }`}
        >
          {typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)}
        </span>
      </div>
      {showBar && (
        <div className="mt-1 h-0.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

interface EntityPanelProps {
  story: StoryRepresentation;
  entityStates: Record<string, Record<string, string | number | boolean>>;
  lastChanges: StateChange[];
}

export default function EntityPanel({ story, entityStates, lastChanges }: EntityPanelProps) {
  const changedKeys = new Set(
    lastChanges.map((sc) => `${sc.entity_id}.${sc.variable_name}`),
  );
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="py-2">
      <p className="text-slate-600 text-xs uppercase tracking-widest px-3 py-1.5">World State</p>
      {story.entities.map((entity) => {
        const state = entityStates[entity.id] ?? {};
        const isCollapsed = collapsed[entity.id] ?? false;
        const hasVars = entity.state_variables.length > 0;
        return (
          <div key={entity.id} className="border-b border-slate-800 last:border-0">
            <button
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-900 transition-colors text-left"
              onClick={() => toggle(entity.id)}
              disabled={!hasVars}
            >
              <span className="text-base">{TYPE_ICONS[entity.type] || '●'}</span>
              <span className="text-slate-200 text-xs font-medium flex-1 truncate">{entity.name}</span>
              {hasVars && (
                <span className="text-slate-600 text-xs">{isCollapsed ? '▶' : '▼'}</span>
              )}
            </button>
            {!isCollapsed && hasVars && (
              <div className="pb-1">
                {entity.state_variables.map((v) => (
                  <VarRow
                    key={v.name}
                    name={v.name}
                    value={state[v.name] ?? v.initial_value}
                    range={v.range}
                    dataType={v.data_type}
                    changed={changedKeys.has(`${entity.id}.${v.name}`)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
