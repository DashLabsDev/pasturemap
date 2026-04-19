'use client';

import type { GrazingSession } from '@/lib/types';
import { daysSince, daysBetween } from '@/lib/grazing-calc';

interface Props {
  session: GrazingSession;
  onMove?: () => void;
  onSuspend?: () => void;
}

const statusBadge: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border border-green-500/20',
  completed: 'bg-white/[0.08] text-white/50 border border-white/10',
  suspended: 'bg-white/[0.08] text-white/50 border border-white/10',
};

export default function GrazingSessionCard({ session, onMove, onSuspend }: Props) {
  const isActive = session.status === 'active';
  const actualDays = session.actual_days
    ?? (session.move_out_date
      ? daysBetween(session.move_in_date, session.move_out_date)
      : daysSince(session.move_in_date));
  const planned = session.planned_days;
  const pct = planned ? Math.min(100, (actualDays / planned) * 100) : 0;
  const overdue = planned && actualDays > planned;

  return (
    <div className="bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-xl p-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-white/90 truncate">
            {(session.herd as unknown as { name: string } | undefined)?.name ?? 'Herd'}
          </span>
          <span className="text-white/25 shrink-0">→</span>
          <span className="text-sm font-medium text-white/60 truncate">
            {(session.paddock as unknown as { name: string } | undefined)?.name ?? 'Paddock'}
          </span>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 ml-2 ${statusBadge[session.status ?? 'active']}`}>
          {session.status}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <p className="text-xs text-white/40 font-medium">Move In</p>
          <p className="text-sm font-semibold text-white/80 mt-0.5">{session.move_in_date}</p>
        </div>
        <div>
          <p className="text-xs text-white/40 font-medium">Planned</p>
          <p className="text-sm font-semibold text-white/80 mt-0.5">{planned ?? '—'} days</p>
        </div>
        <div>
          <p className="text-xs text-white/40 font-medium">Actual</p>
          <p className={`text-sm font-semibold mt-0.5 ${overdue ? 'text-red-400' : 'text-white/80'}`}>
            {actualDays} days
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {planned && (
        <div className="bg-white/[0.08] rounded-full h-1.5 mb-3">
          <div
            className={`rounded-full h-1.5 transition-all duration-300 ${overdue ? 'bg-red-500' : 'bg-green-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Actions */}
      {isActive && (onMove || onSuspend) && (
        <div className="flex gap-2 pt-1">
          {onMove && (
            <button
              onClick={onMove}
              className="flex-1 py-2 text-xs font-medium bg-amber-500 hover:bg-amber-400 text-zinc-900 rounded-lg transition-colors duration-150"
            >
              Move Herd
            </button>
          )}
          {onSuspend && (
            <button
              onClick={onSuspend}
              className="flex-1 py-2 text-xs font-medium bg-white/[0.08] hover:bg-white/[0.12] text-white/60 hover:text-white/80 border border-white/10 rounded-lg transition-all duration-150"
            >
              Suspend
            </button>
          )}
        </div>
      )}
    </div>
  );
}
