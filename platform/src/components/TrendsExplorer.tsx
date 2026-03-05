'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { scoreColor, scoreBg, scoreLabel } from '@aiready/components';
import type { Repository, Analysis } from '@/lib/db';
import { TrendingUpIcon, RocketIcon } from './Icons';

interface Props {
  repos: Repository[];
}

export default function TrendsExplorer({ repos }: Props) {
  const [selectedRepoId, setSelectedRepoId] = useState<string>(
    repos[0]?.id || ''
  );
  const [history, setHistory] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedRepoId) {
      fetchHistory(selectedRepoId);
    }
  }, [selectedRepoId]);

  async function fetchHistory(repoId: string) {
    try {
      setLoading(true);
      const res = await fetch(`/api/repos/${repoId}/history?limit=30`);
      const data = await res.json();
      if (res.ok) {
        setHistory(data.analyses.reverse());
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  }

  const selectedRepo = repos.find((r) => r.id === selectedRepoId);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <TrendingUpIcon className="w-8 h-8 text-cyan-400" />
            Trends Explorer
          </h1>
          <p className="text-slate-400 mt-1">
            Track your AI-Readiness progress over time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Repository:
          </label>
          <select
            value={selectedRepoId}
            onChange={(e) => setSelectedRepoId(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            {repos.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="h-[400px] flex flex-col items-center justify-center gap-4 bg-slate-900/20 rounded-3xl border border-slate-800">
          <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest animate-pulse">
            Loading History...
          </p>
        </div>
      ) : history.length < 2 ? (
        <div className="h-[400px] flex flex-col items-center justify-center text-center p-8 bg-slate-900/20 rounded-3xl border border-slate-800">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-6 text-3xl">
            📉
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Not enough data</h3>
          <p className="text-slate-400 max-w-sm">
            We need at least two analysis runs for{' '}
            <strong>{selectedRepo?.name}</strong> to show trend insights.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card rounded-3xl p-8 border border-white/5 shadow-2xl overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <TrendingUpIcon className="w-48 h-48" />
              </div>

              <TrendChart history={history} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InsightCard
                title="Total Progress"
                value={`${history[history.length - 1].aiScore! - history[0].aiScore!} pts`}
                description="Change since first scan"
                trend={
                  history[history.length - 1].aiScore! >= history[0].aiScore!
                    ? 'up'
                    : 'down'
                }
              />
              <InsightCard
                title="Latest Jump"
                value={`${history[history.length - 1].aiScore! - (history[history.length - 2]?.aiScore || 0)} pts`}
                description="Change from previous scan"
                trend={
                  history[history.length - 1].aiScore! >=
                  (history[history.length - 2]?.aiScore || 0)
                    ? 'up'
                    : 'down'
                }
              />
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">
              Recent Scans
            </h3>
            <div className="space-y-3">
              {history
                .slice()
                .reverse()
                .map((analysis, idx) => (
                  <div
                    key={analysis.id}
                    className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-between group hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-bold text-white mb-0.5">
                        {new Date(analysis.timestamp).toLocaleDateString(
                          undefined,
                          {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }
                        )}
                      </p>
                      <p className="text-[10px] text-slate-500 uppercase font-black">
                        {scoreLabel(analysis.aiScore!)}
                      </p>
                    </div>
                    <div
                      className={`text-lg font-black ${scoreColor(analysis.aiScore!)}`}
                    >
                      {analysis.aiScore}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TrendChart({ history }: { history: Analysis[] }) {
  const scores = history.map((h) => h.aiScore || 0);
  const maxScore = 100;
  const height = 300;
  const width = 800;
  const padding = 50;

  const points = scores.map((score, i) => {
    const x = padding + (i * (width - 2 * padding)) / (scores.length - 1 || 1);
    const y = height - padding - (score * (height - 2 * padding)) / maxScore;
    return { x, y, score };
  });

  const pathD =
    points.length > 0
      ? `M ${points[0].x} ${points[0].y} ` +
        points
          .slice(1)
          .map((p) => `L ${p.x} ${p.y}`)
          .join(' ')
      : '';

  return (
    <div className="relative h-[350px] w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(34, 211, 238, 0.2)" />
            <stop offset="100%" stopColor="rgba(34, 211, 238, 0)" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {[0, 25, 50, 75, 100].map((level) => (
          <g key={level}>
            <line
              x1={padding}
              y1={height - padding - (level * (height - 2 * padding)) / 100}
              x2={width - padding}
              y2={height - padding - (level * (height - 2 * padding)) / 100}
              className="stroke-slate-800/50"
              strokeWidth="1"
            />
            <text
              x={padding - 15}
              y={height - padding - (level * (height - 2 * padding)) / 100}
              className="text-[10px] fill-slate-500 font-mono"
              textAnchor="end"
              alignmentBaseline="middle"
            >
              {level}
            </text>
          </g>
        ))}

        {/* Fill */}
        <path
          d={`${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`}
          fill="url(#trendGradient)"
        />

        {/* Path */}
        <motion.path
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
          d={pathD}
          fill="none"
          stroke="rgba(34, 211, 238, 0.8)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {points.map((p, i) => (
          <g key={i} className="group/dot">
            <circle
              cx={p.x}
              cy={p.y}
              r="6"
              className={`fill-slate-950 stroke-[3] transition-all duration-300 ${scoreColor(p.score).replace('text', 'stroke')}`}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r="12"
              className="fill-transparent cursor-help"
            />
            <g className="opacity-0 group-hover/dot:opacity-100 transition-opacity">
              <rect
                x={p.x - 20}
                y={p.y - 35}
                width="40"
                height="24"
                rx="6"
                className="fill-slate-800 stroke-slate-700"
              />
              <text
                x={p.x}
                y={p.y - 18}
                textAnchor="middle"
                className="text-xs font-bold fill-white"
              >
                {p.score}
              </text>
            </g>
          </g>
        ))}
      </svg>
      <div className="flex justify-between mt-4 px-[50px] text-[10px] font-black text-slate-500 uppercase tracking-widest">
        <span>History Start</span>
        <span>Current Status</span>
      </div>
    </div>
  );
}

function InsightCard({
  title,
  value,
  description,
  trend,
}: {
  title: string;
  value: string;
  description: string;
  trend: 'up' | 'down';
}) {
  return (
    <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 flex items-start gap-4">
      <div
        className={`p-3 rounded-2xl ${trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}
      >
        {trend === 'up' ? '↗' : '↘'}
      </div>
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
          {title}
        </p>
        <p className="text-2xl font-black text-white">{value}</p>
        <p className="text-xs text-slate-400 mt-1">{description}</p>
      </div>
    </div>
  );
}
