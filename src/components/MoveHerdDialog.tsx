'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRanch } from '@/components/auth/RanchProvider';
import { calculateRotation } from '@/lib/grazing-calc';
import type { Herd, Paddock, GrazingSession } from '@/lib/types';

interface Props {
  session: GrazingSession;
  herd: Herd;
  paddocks: Paddock[];
  onClose: () => void;
  onComplete: () => void;
}

const inputCls = 'w-full px-3 py-2 text-sm bg-white/[0.08] border border-white/10 text-white placeholder-white/25 rounded-lg focus:outline-none focus:border-white/25 focus:bg-white/[0.10] transition-all duration-150';
const labelCls = 'block text-xs text-white/40 font-medium mb-1';

export default function MoveHerdDialog({ session, herd, paddocks, onClose, onComplete }: Props) {
  const [targetPaddockId, setTargetPaddockId] = useState('');
  const { activeRanch } = useRanch();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const targetPaddock = paddocks.find((p) => p.id === targetPaddockId);
  const recommendation = targetPaddock && herd.avg_weight_lbs
    ? calculateRotation({
        headCount: herd.head_count,
        avgWeightLbs: herd.avg_weight_lbs,
        acreage: targetPaddock.acreage ?? 0,
      })
    : null;

  const handleMove = async () => {
    if (!targetPaddockId) return;
    setSaving(true);

    const today = new Date().toISOString().slice(0, 10);

    await supabase
      .from('grazing_sessions')
      .update({
        status: 'completed',
        move_out_date: today,
        actual_days: Math.round(
          (Date.now() - new Date(session.move_in_date).getTime()) / (1000 * 60 * 60 * 24)
        ),
      })
      .eq('id', session.id);

    if (!activeRanch) return;

    await supabase.from('grazing_sessions').insert({
      ranch_id: activeRanch.ranchId,
      herd_id: herd.id,
      paddock_id: targetPaddockId,
      move_in_date: today,
      planned_days: recommendation ? Math.round(recommendation.maxDays) : null,
      status: 'active',
    });

    await supabase
      .from('herds')
      .update({ current_paddock_id: targetPaddockId })
      .eq('id', herd.id);

    await supabase.from('move_events').insert({
      ranch_id: activeRanch.ranchId,
      herd_id: herd.id,
      from_paddock_id: session.paddock_id,
      to_paddock_id: targetPaddockId,
      head_count: herd.head_count,
      event_type: 'move',
      notes,
    });

    setSaving(false);
    onComplete();
  };

  const availablePaddocks = paddocks.filter((p) => p.id !== session.paddock_id);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1100] flex items-center justify-center p-4">
      <div className="bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white/90 uppercase tracking-wide">Move Herd</h2>
              <p className="text-xs text-white/40 mt-0.5">
                {herd.name} · {herd.head_count} head
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/70 transition-colors ml-2"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Target paddock */}
          <div className="mb-3">
            <label className={labelCls}>Target Paddock</label>
            <select
              value={targetPaddockId}
              onChange={(e) => setTargetPaddockId(e.target.value)}
              className={inputCls}
            >
              <option value="">Select paddock...</option>
              {availablePaddocks.map((p) => (
                <option key={p.id} value={p.id} className="bg-zinc-900">
                  {p.name}{p.acreage ? ` (${p.acreage} ac)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Rotation recommendation */}
          {recommendation && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2.5 mb-3">
              <p className="text-xs font-medium text-white/60 mb-1.5 uppercase tracking-wide">Rotation Rec</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-white/50">
                <span>AU: {recommendation.animalUnits}</span>
                <span>DMI: {recommendation.dailyDMI} lbs/day</span>
                <span>Forage: {recommendation.foragePerAcrePerDay} lbs/ac/day</span>
                <span className="font-semibold text-white/80">Max: {recommendation.maxDays} days</span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="mb-4">
            <label className={labelCls}>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputCls + ' resize-none'}
              placeholder="Move notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 text-sm font-medium bg-white/[0.08] hover:bg-white/[0.12] text-white/60 hover:text-white/80 border border-white/10 rounded-lg transition-all duration-150"
            >
              Cancel
            </button>
            <button
              onClick={handleMove}
              disabled={!targetPaddockId || saving}
              className="flex-1 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 text-zinc-900 rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Moving…' : 'Confirm Move'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
