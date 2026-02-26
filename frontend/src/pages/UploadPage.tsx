import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyzeStory } from '../api/client';
import type { StoryRepresentation } from '../types';

const ACCEPT = '.pdf,.txt,.md';

export default function UploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [numRules, setNumRules] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (f: File) => {
    setFile(f);
    setError(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const onAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const story: StoryRepresentation = await analyzeStory(file, numRules);
      navigate('/analysis', { state: { story } });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="text-5xl mb-4">📖</div>
        <h1 className="text-4xl font-semibold text-amber-400 tracking-tight mb-2">
          Story to Game
        </h1>
        <p className="text-slate-400 text-sm max-w-md">
          Transform any story into a living textual simulation sandbox.
          Upload a story, and step inside it.
        </p>
      </div>

      {/* Upload card */}
      <div className="w-full max-w-lg">
        <div
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-amber-400 bg-amber-400/5'
              : file
              ? 'border-emerald-500 bg-emerald-500/5'
              : 'border-slate-600 hover:border-slate-400 bg-slate-900/50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {file ? (
            <>
              <div className="text-3xl mb-2">✓</div>
              <p className="text-emerald-400 font-medium">{file.name}</p>
              <p className="text-slate-500 text-xs mt-1">
                {(file.size / 1024).toFixed(1)} KB — click to change
              </p>
            </>
          ) : (
            <>
              <div className="text-3xl mb-3 text-slate-500">⬆</div>
              <p className="text-slate-300 font-medium mb-1">
                Drop your story here
              </p>
              <p className="text-slate-500 text-xs">
                PDF, TXT, or Markdown — click to browse
              </p>
            </>
          )}
        </div>

        {/* Rules slider */}
        <div className="mt-6 bg-slate-900 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <label className="text-slate-300 text-sm font-medium">
              Number of world rules to extract
            </label>
            <span className="text-amber-400 font-bold text-lg w-8 text-right">
              {numRules}
            </span>
          </div>
          <input
            type="range"
            min={3}
            max={20}
            value={numRules}
            onChange={(e) => setNumRules(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <div className="flex justify-between text-slate-600 text-xs mt-1">
            <span>3 — concise</span>
            <span>20 — detailed</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Analyze button */}
        <button
          onClick={onAnalyze}
          disabled={!file || loading}
          className="mt-6 w-full py-3 rounded-lg font-semibold text-sm transition-all
            disabled:opacity-40 disabled:cursor-not-allowed
            bg-amber-500 hover:bg-amber-400 text-slate-950"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Analyzing story… this may take a minute
            </span>
          ) : (
            'Extract & Analyze →'
          )}
        </button>

        <p className="mt-4 text-center text-slate-600 text-xs">
          Powered by Claude AI. Requires <code className="text-slate-400">ANTHROPIC_API_KEY</code> on the backend.
        </p>
      </div>
    </div>
  );
}
