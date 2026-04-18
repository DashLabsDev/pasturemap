'use client';

import type { Paddock, Herd, GrazingSession } from '@/lib/types';
import { daysSince } from '@/lib/grazing-calc';

interface Props {
  paddock: Paddock;
  herd: Herd | null;
  session: GrazingSession | null;
  onClose: () => void;
}

export default function PaddockPanel({ paddock, herd, session, onClose }: Props) {
  const grazingDays = session ? daysSince(session.move_in_date) : null;
  const statusLabel = session ? 'Grazing' : 'Resting';
  const statusColor = session ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600';

  return (
    <div className="absolute bottom-4 right-4 z-[1000] bg-white rounded-lg shadow-xl w-80 max-h-[60vh] overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg text-green-900">{paddock.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            &times;
          </button>
        </div>

        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
          {statusLabel}
        </span>

        <div className="mt-3 space-y-2 text-sm">
          {paddock.acreage && (
            <div className="flex justify-between">
              <span className="text-gray-500">Acreage</span>
              <span className="font-medium">{paddock.acreage} ac</span>
            </div>
          )}
          {paddock.fence_type && (
            <div className="flex justify-between">
              <span className="text-gray-500">Fence</span>
              <span className="font-medium capitalize">{paddock.fence_type}</span>
            </div>
          )}
          {paddock.water_source && (
            <div className="flex justify-between">
              <span className="text-gray-500">Water</span>
              <span className="font-medium capitalize">{paddock.water_source}</span>
            </div>
          )}
        </div>

        {herd && (
          <div className="mt-4 p-3 bg-amber-50 rounded-lg">
            <p className="text-sm font-medium text-amber-900">
              🐄 {herd.name}
            </p>
            <p className="text-xs text-amber-700 mt-1">
              {herd.head_count} head &middot; {herd.avg_weight_lbs ?? '?'} lbs avg
            </p>
          </div>
        )}

        {session && grazingDays !== null && (
          <div className="mt-3 p-3 bg-green-50 rounded-lg">
            <p className="text-sm font-medium text-green-900">Active Session</p>
            <p className="text-xs text-green-700 mt-1">
              Day {grazingDays} of {session.planned_days ?? '?'} planned
            </p>
            {session.planned_days && (
              <div className="mt-2 bg-green-200 rounded-full h-2">
                <div
                  className="bg-green-600 rounded-full h-2 transition-all"
                  style={{ width: `${Math.min(100, (grazingDays / session.planned_days) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {paddock.notes && (
          <p className="mt-3 text-xs text-gray-500 italic">{paddock.notes}</p>
        )}
      </div>
    </div>
  );
}
