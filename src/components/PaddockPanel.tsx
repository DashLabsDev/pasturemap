'use client';

import { X, Scissors } from 'lucide-react';
import type { Paddock, Herd, GrazingSession } from '@/lib/types';
import { daysSince } from '@/lib/grazing-calc';

interface Props {
  paddock: Paddock;
  herd: Herd | null;
  session: GrazingSession | null;
  onClose: () => void;
  onSplit?: () => void;
}

export default function PaddockPanel({ paddock, herd, session, onClose, onSplit }: Props) {
  const grazingDays = session ? daysSince(session.move_in_date) : null;
  const isGrazing = session !== null;
  const progress =
    session?.planned_days && grazingDays !== null
      ? Math.min(100, (grazingDays / session.planned_days) * 100)
      : null;

  const inner = (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white/90">{paddock.name}</h3>
          {paddock.parent_paddock_id && (
            <span className="text-xs text-white/30">subdivision</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/80 transition-colors ml-2 flex-shrink-0"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Status badge */}
      <div className="mb-4">
        {isGrazing ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/20">
            Grazing
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/[0.08] text-white/50 border border-white/10">
            Resting
          </span>
        )}
      </div>

      {/* Data rows */}
      <div className="space-y-2 mb-4">
        {paddock.acreage && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">Acreage</span>
            <span className="text-sm font-semibold text-white/80">{paddock.acreage} ac</span>
          </div>
        )}
        {paddock.fence_type && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">Fence</span>
            <span className="text-sm text-white/80 capitalize">{paddock.fence_type}</span>
          </div>
        )}
        {paddock.water_source && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">Water</span>
            <span className="text-sm text-white/80 capitalize">{paddock.water_source}</span>
          </div>
        )}
      </div>

      {/* Herd section */}
      {herd && (
        <div className="bg-white/[0.06] rounded-lg px-3 py-2.5 mb-3">
          <p className="text-sm font-medium text-white/80">{herd.name}</p>
          <p className="text-xs text-white/40 mt-0.5">
            {herd.head_count} head{herd.avg_weight_lbs ? ` · ${herd.avg_weight_lbs} lbs avg` : ''}
          </p>
        </div>
      )}

      {/* Active session */}
      {session && grazingDays !== null && (
        <div className="bg-white/[0.06] rounded-lg px-3 py-2.5 mb-3">
          <div className="flex justify-between items-center mb-1.5">
            <p className="text-xs font-medium text-white/60 uppercase tracking-wide">Active Session</p>
            <p className="text-xs text-white/40">
              Day {grazingDays}{session.planned_days ? ` / ${session.planned_days}` : ''}
            </p>
          </div>
          {progress !== null && (
            <div className="bg-white/[0.08] rounded-full h-1.5">
              <div
                className="bg-green-500 rounded-full h-1.5 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {paddock.notes && (
        <p className="text-xs text-white/40 italic leading-relaxed mb-4">{paddock.notes}</p>
      )}

      {/* Split button */}
      {paddock.boundary_geojson && !paddock.parent_paddock_id && onSplit && (
        <button
          onClick={onSplit}
          className="w-full mt-1 py-2.5 text-xs font-medium text-white/70 hover:text-white/90 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          <Scissors className="w-3.5 h-3.5" />
          Split Paddock
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop: floating panel top-left */}
      <div className="hidden md:block absolute top-4 left-4 z-[1000] bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl w-72 max-h-[80vh] overflow-y-auto">
        {inner}
      </div>

      {/* Mobile: bottom sheet */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[1000] bg-zinc-900/95 backdrop-blur-md border-t border-white/10 rounded-t-2xl shadow-2xl max-h-[60vh] overflow-y-auto">
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        {inner}
      </div>
    </>
  );
}
