'use client';

import type { GrazingSession } from '@/lib/types';
import { daysSince, daysBetween } from '@/lib/grazing-calc';

interface Props {
  session: GrazingSession;
  onMove?: () => void;
  onSuspend?: () => void;
}

const statusStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  suspended: 'bg-yellow-100 text-yellow-800',
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
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-bold text-green-900">
            {(session.herd as unknown as { name: string } | undefined)?.name ?? 'Herd'}
          </span>
          <span className="text-gray-400 mx-2">&rarr;</span>
          <span className="font-medium text-gray-700">
            {(session.paddock as unknown as { name: string } | undefined)?.name ?? 'Paddock'}
          </span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[session.status ?? 'active']}`}>
          {session.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm mb-3">
        <div>
          <span className="text-gray-500">Move In</span>
          <p className="font-medium">{session.move_in_date}</p>
        </div>
        <div>
          <span className="text-gray-500">Planned</span>
          <p className="font-medium">{planned ?? '—'} days</p>
        </div>
        <div>
          <span className="text-gray-500">Actual</span>
          <p className={`font-medium ${overdue ? 'text-red-600' : ''}`}>
            {actualDays} days
          </p>
        </div>
      </div>

      {planned && (
        <div className="bg-gray-100 rounded-full h-2 mb-3">
          <div
            className={`rounded-full h-2 transition-all ${overdue ? 'bg-red-500' : 'bg-green-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {isActive && (onMove || onSuspend) && (
        <div className="flex gap-2">
          {onMove && (
            <button
              onClick={onMove}
              className="flex-1 bg-green-700 text-white rounded px-3 py-1.5 text-sm font-medium hover:bg-green-600"
            >
              Move Herd
            </button>
          )}
          {onSuspend && (
            <button
              onClick={onSuspend}
              className="flex-1 bg-yellow-500 text-white rounded px-3 py-1.5 text-sm font-medium hover:bg-yellow-400"
            >
              Suspend
            </button>
          )}
        </div>
      )}
    </div>
  );
}
