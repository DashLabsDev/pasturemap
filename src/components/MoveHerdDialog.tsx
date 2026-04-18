'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateRotation } from '@/lib/grazing-calc';
import type { Herd, Paddock, GrazingSession } from '@/lib/types';

interface Props {
  session: GrazingSession;
  herd: Herd;
  paddocks: Paddock[];
  onClose: () => void;
  onComplete: () => void;
}

export default function MoveHerdDialog({ session, herd, paddocks, onClose, onComplete }: Props) {
  const [targetPaddockId, setTargetPaddockId] = useState('');
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

    // End current session
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

    // Start new session
    await supabase.from('grazing_sessions').insert({
      herd_id: herd.id,
      paddock_id: targetPaddockId,
      move_in_date: today,
      planned_days: recommendation ? Math.round(recommendation.maxDays) : null,
      status: 'active',
    });

    // Update herd current paddock
    await supabase
      .from('herds')
      .update({ current_paddock_id: targetPaddockId })
      .eq('id', herd.id);

    // Log move event
    await supabase.from('move_events').insert({
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

  const availablePaddocks = paddocks.filter(
    (p) => p.id !== session.paddock_id
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-5">
          <h2 className="text-lg font-bold text-green-900 mb-1">Move Herd</h2>
          <p className="text-sm text-gray-500 mb-4">
            Moving <strong>{herd.name}</strong> ({herd.head_count} head)
          </p>

          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Paddock
          </label>
          <select
            value={targetPaddockId}
            onChange={(e) => setTargetPaddockId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 mb-3 text-sm"
          >
            <option value="">Select paddock...</option>
            {availablePaddocks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.acreage ? `(${p.acreage} ac)` : ''}
              </option>
            ))}
          </select>

          {recommendation && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 text-sm">
              <p className="font-medium text-green-900 mb-1">Rotation Recommendation</p>
              <div className="grid grid-cols-2 gap-1 text-green-700 text-xs">
                <span>Animal Units: {recommendation.animalUnits}</span>
                <span>Daily DMI: {recommendation.dailyDMI} lbs</span>
                <span>Forage Rate: {recommendation.foragePerAcrePerDay} lbs/ac/day</span>
                <span className="font-bold text-green-900">
                  Max Days: {recommendation.maxDays}
                </span>
              </div>
            </div>
          )}

          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full border rounded-lg px-3 py-2 mb-4 text-sm"
            placeholder="Move notes..."
          />

          <div className="flex gap-2">
            <button
              onClick={handleMove}
              disabled={!targetPaddockId || saving}
              className="flex-1 bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-600 disabled:opacity-50"
            >
              {saving ? 'Moving...' : 'Confirm Move'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
