'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, DEFAULT_RANCH_ID } from '@/lib/supabase';
import type { GrazingSession, Herd, Paddock } from '@/lib/types';
import { calculateRotation } from '@/lib/grazing-calc';
import GrazingSessionCard from '@/components/GrazingSessionCard';
import MoveHerdDialog from '@/components/MoveHerdDialog';

type Tab = 'current' | 'planned' | 'recent';

const inputCls = 'w-full px-3 py-2 text-sm bg-white/[0.08] border border-white/10 text-white placeholder-white/25 rounded-lg focus:outline-none focus:border-white/25 focus:bg-white/[0.10] transition-all duration-150';
const labelCls = 'block text-xs text-white/40 font-medium mb-1';

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

    await supabase
      .from('herds')
      .update({ current_paddock_id: newForm.paddock_id })
      .eq('id', newForm.herd_id);

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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-base font-semibold text-white/90 tracking-tight">Grazing Sessions</h1>
          <p className="text-xs text-white/40 mt-0.5">{filtered.length} {tab}</p>
        </div>
        <button
          onClick={() => setShowNewSession(true)}
          className="px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-zinc-900 rounded-lg transition-colors duration-150"
        >
          + New Session
        </button>
      </div>

      {/* New session form */}
      {showNewSession && (
        <div className="bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-5 mb-5">
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">
            Start Grazing Session
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Herd</label>
              <select
                value={newForm.herd_id}
                onChange={(e) => setNewForm({ ...newForm, herd_id: e.target.value })}
                className={inputCls}
              >
                <option value="">Select herd...</option>
                {herds.filter((h) => h.status === 'active').map((h) => (
                  <option key={h.id} value={h.id} className="bg-zinc-900">
                    {h.name} ({h.head_count} head)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Paddock</label>
              <select
                value={newForm.paddock_id}
                onChange={(e) => setNewForm({ ...newForm, paddock_id: e.target.value })}
                className={inputCls}
              >
                <option value="">Select paddock...</option>
                {paddocks.map((p) => (
                  <option key={p.id} value={p.id} className="bg-zinc-900">
                    {p.name}{p.acreage ? ` (${p.acreage} ac)` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Move-in Date</label>
              <input
                type="date"
                value={newForm.move_in_date}
                onChange={(e) => setNewForm({ ...newForm, move_in_date: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-white/40 font-medium">Planned Days</label>
                {previewRec && (
                  <span className="text-xs text-amber-400/80 font-medium">rec: {previewRec.maxDays}</span>
                )}
              </div>
              <input
                type="number"
                value={newForm.planned_days}
                onChange={(e) => setNewForm({ ...newForm, planned_days: e.target.value })}
                placeholder={previewRec ? `${Math.round(previewRec.maxDays)}` : 'Days'}
                className={inputCls}
              />
            </div>
          </div>

          {previewRec && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2.5 mt-3">
              <p className="text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">Rotation Recommendation</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-xs text-white/50">
                <span>AU: {previewRec.animalUnits}</span>
                <span>DMI: {previewRec.dailyDMI} lbs/day</span>
                <span>Forage: {previewRec.foragePerAcrePerDay} lbs/ac/day</span>
                <span className="font-semibold text-white/80">Max: {previewRec.maxDays} days</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4 pt-4 border-t border-white/[0.06]">
            <button
              onClick={startNewSession}
              className="px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 text-zinc-900 rounded-lg transition-colors duration-150"
            >
              Start Session
            </button>
            <button
              onClick={() => setShowNewSession(false)}
              className="px-4 py-2 text-sm font-medium bg-white/[0.08] hover:bg-white/[0.12] text-white/60 hover:text-white/80 border border-white/10 rounded-lg transition-all duration-150"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0.5 mb-5 bg-white/[0.06] rounded-lg p-0.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-150 ${
              tab === t.key
                ? 'bg-white/[0.10] text-white/90'
                : 'text-white/40 hover:text-white/60'
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
            onMove={() => setMoveSession(s)}
            onSuspend={() => suspendSession(s)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-white/20 text-sm py-12">
            No {tab} sessions found.
          </div>
        )}
      </div>

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
