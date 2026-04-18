'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, DEFAULT_RANCH_ID } from '@/lib/supabase';
import type { GrazingSession, Herd, Paddock } from '@/lib/types';
import { calculateRotation } from '@/lib/grazing-calc';
import GrazingSessionCard from '@/components/GrazingSessionCard';
import MoveHerdDialog from '@/components/MoveHerdDialog';

type Tab = 'current' | 'planned' | 'recent';

export default function GrazingPage() {
  const [sessions, setSessions] = useState<GrazingSession[]>([]);
  const [herds, setHerds] = useState<Herd[]>([]);
  const [paddocks, setPaddocks] = useState<Paddock[]>([]);
  const [tab, setTab] = useState<Tab>('current');
  const [moveSession, setMoveSession] = useState<GrazingSession | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);

  const [newForm, setNewForm] = useState({
    herd_id: '',
    paddock_id: '',
    move_in_date: new Date().toISOString().slice(0, 10),
    planned_days: '',
  });

  const fetchData = useCallback(async () => {
    const [sRes, hRes, pRes] = await Promise.all([
      supabase
        .from('grazing_sessions')
        .select('*, herd:herds(id, name, head_count, avg_weight_lbs, herd_type, current_paddock_id, status), paddock:paddocks(id, name, acreage)')
        .order('move_in_date', { ascending: false }),
      supabase.from('herds').select('*'),
      supabase.from('paddocks_geojson').select('*'),
    ]);
    if (sRes.data) setSessions(sRes.data as unknown as GrazingSession[]);
    if (hRes.data) setHerds(hRes.data as Herd[]);
    if (pRes.data) setPaddocks(pRes.data as Paddock[]);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = sessions.filter((s) => {
    if (tab === 'current') return s.status === 'active';
    if (tab === 'planned') {
      const moveIn = new Date(s.move_in_date);
      return s.status === 'active' && moveIn > new Date();
    }
    return s.status === 'completed' || s.status === 'suspended';
  });

  const suspendSession = async (session: GrazingSession) => {
    if (!confirm('Suspend this grazing session?')) return;
    const today = new Date().toISOString().slice(0, 10);
    await supabase
      .from('grazing_sessions')
      .update({ status: 'suspended', suspended_date: today })
      .eq('id', session.id);

    // Log event
    await supabase.from('move_events').insert({
      herd_id: session.herd_id,
      from_paddock_id: session.paddock_id,
      event_type: 'suspend',
      head_count: (session.herd as unknown as Herd)?.head_count,
    });

    fetchData();
  };

  const startNewSession = async () => {
    if (!newForm.herd_id || !newForm.paddock_id) return;

    const herd = herds.find((h) => h.id === newForm.herd_id);
    const paddock = paddocks.find((p) => p.id === newForm.paddock_id);

    let plannedDays = newForm.planned_days ? parseInt(newForm.planned_days) : null;

    // Auto-calculate if not provided
    if (!plannedDays && herd && paddock && herd.avg_weight_lbs && paddock.acreage) {
      const rec = calculateRotation({
        headCount: herd.head_count,
        avgWeightLbs: herd.avg_weight_lbs,
        acreage: paddock.acreage,
      });
      plannedDays = Math.round(rec.maxDays);
    }

    await supabase.from('grazing_sessions').insert({
      herd_id: newForm.herd_id,
      paddock_id: newForm.paddock_id,
      move_in_date: newForm.move_in_date,
      planned_days: plannedDays,
      status: 'active',
    });

    // Update herd location
    await supabase
      .from('herds')
      .update({ current_paddock_id: newForm.paddock_id })
      .eq('id', newForm.herd_id);

    // Log event
    await supabase.from('move_events').insert({
      herd_id: newForm.herd_id,
      to_paddock_id: newForm.paddock_id,
      event_type: 'graze-start',
      head_count: herd?.head_count,
    });

    setShowNewSession(false);
    setNewForm({ herd_id: '', paddock_id: '', move_in_date: new Date().toISOString().slice(0, 10), planned_days: '' });
    fetchData();
  };

  const moveHerd = (session: GrazingSession) => {
    setMoveSession(session);
  };

  // Rotation recommendation preview
  const previewRec = (() => {
    if (!newForm.herd_id || !newForm.paddock_id) return null;
    const herd = herds.find((h) => h.id === newForm.herd_id);
    const paddock = paddocks.find((p) => p.id === newForm.paddock_id);
    if (!herd?.avg_weight_lbs || !paddock?.acreage) return null;
    return calculateRotation({
      headCount: herd.head_count,
      avgWeightLbs: herd.avg_weight_lbs,
      acreage: paddock.acreage,
    });
  })();

  const tabs: { key: Tab; label: string }[] = [
    { key: 'current', label: 'Current' },
    { key: 'planned', label: 'Planned' },
    { key: 'recent', label: 'Recent' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-green-900">Grazing Sessions</h1>
        <button
          onClick={() => setShowNewSession(true)}
          className="bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-600"
        >
          + New Session
        </button>
      </div>

      {/* New session form */}
      {showNewSession && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <h2 className="font-bold text-green-900 mb-3">Start Grazing Session</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Herd</label>
              <select
                value={newForm.herd_id}
                onChange={(e) => setNewForm({ ...newForm, herd_id: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Select herd...</option>
                {herds.filter((h) => h.status === 'active').map((h) => (
                  <option key={h.id} value={h.id}>{h.name} ({h.head_count} head)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Paddock</label>
              <select
                value={newForm.paddock_id}
                onChange={(e) => setNewForm({ ...newForm, paddock_id: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Select paddock...</option>
                {paddocks.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} {p.acreage ? `(${p.acreage} ac)` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Move-in Date</label>
              <input
                type="date"
                value={newForm.move_in_date}
                onChange={(e) => setNewForm({ ...newForm, move_in_date: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Planned Days {previewRec ? `(rec: ${previewRec.maxDays})` : ''}
              </label>
              <input
                type="number"
                value={newForm.planned_days}
                onChange={(e) => setNewForm({ ...newForm, planned_days: e.target.value })}
                placeholder={previewRec ? `${Math.round(previewRec.maxDays)}` : ''}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          {previewRec && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3 text-sm">
              <p className="font-medium text-green-900 mb-1">Rotation Recommendation</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-green-700 text-xs">
                <span>AU: {previewRec.animalUnits}</span>
                <span>DMI: {previewRec.dailyDMI} lbs/day</span>
                <span>Forage: {previewRec.foragePerAcrePerDay} lbs/ac/day</span>
                <span className="font-bold">Max: {previewRec.maxDays} days</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button onClick={startNewSession} className="bg-green-700 text-white rounded px-4 py-2 text-sm font-medium hover:bg-green-600">
              Start Session
            </button>
            <button onClick={() => setShowNewSession(false)} className="bg-gray-200 text-gray-700 rounded px-4 py-2 text-sm font-medium">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-green-100 rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-green-900 shadow-sm' : 'text-green-700 hover:text-green-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sessions list */}
      <div className="space-y-3">
        {filtered.map((s) => (
          <GrazingSessionCard
            key={s.id}
            session={s}
            onMove={() => moveHerd(s)}
            onSuspend={() => suspendSession(s)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            No {tab} sessions found.
          </div>
        )}
      </div>

      {/* Move dialog */}
      {moveSession && (
        <MoveHerdDialog
          session={moveSession}
          herd={moveSession.herd as unknown as Herd}
          paddocks={paddocks}
          onClose={() => setMoveSession(null)}
          onComplete={() => { setMoveSession(null); fetchData(); }}
        />
      )}
    </div>
  );
}
