'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRanch } from '@/components/auth/RanchProvider';
import type { Herd, Paddock } from '@/lib/types';
import HerdCard from '@/components/HerdCard';

const herdTypes = ['cow-calf', 'stocker', 'bull', 'dry-cows', 'heifers', 'sheep', 'goat', 'other'] as const;

const inputCls = 'w-full px-3 py-2 text-sm bg-white/[0.08] border border-white/10 text-white placeholder-white/25 rounded-lg focus:outline-none focus:border-white/25 focus:bg-white/[0.10] transition-all duration-150';
const labelCls = 'block text-xs text-white/40 font-medium mb-1';

export default function HerdsPage() {
  const { activeRanch } = useRanch();
  const [herds, setHerds] = useState<Herd[]>([]);
  const [paddocks, setPaddocks] = useState<Paddock[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Herd | null>(null);

  const [form, setForm] = useState({
    name: '',
    head_count: '',
    avg_weight_lbs: '',
    herd_type: '',
    current_paddock_id: '',
    notes: '',
  });

  const fetchData = useCallback(async () => {
    const [hRes, pRes] = await Promise.all([
      supabase.from('herds').select('*').order('name'),
      supabase.from('paddocks_geojson').select('*'),
    ]);
    if (hRes.data) setHerds(hRes.data as Herd[]);
    if (pRes.data) setPaddocks(pRes.data as Paddock[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    void fetchData();
  }, []);

  const paddockName = (id: string | null) =>
    paddocks.find((p) => p.id === id)?.name;

  const openAdd = () => {
    setEditing(null);
    setShowAdd(true);
    setForm({ name: '', head_count: '', avg_weight_lbs: '', herd_type: '', current_paddock_id: '', notes: '' });
  };

  const openEdit = (herd: Herd) => {
    setEditing(herd);
    setShowAdd(false);
    setForm({
      name: herd.name,
      head_count: herd.head_count.toString(),
      avg_weight_lbs: herd.avg_weight_lbs?.toString() ?? '',
      herd_type: herd.herd_type ?? '',
      current_paddock_id: herd.current_paddock_id ?? '',
      notes: herd.notes ?? '',
    });
  };

  const save = async () => {
    if (!form.name.trim()) return;
    const data = {
      name: form.name,
      head_count: parseInt(form.head_count) || 0,
      avg_weight_lbs: form.avg_weight_lbs ? parseFloat(form.avg_weight_lbs) : null,
      herd_type: form.herd_type || null,
      current_paddock_id: form.current_paddock_id || null,
      notes: form.notes || null,
    };

    if (editing) {
      await supabase.from('herds').update(data).eq('id', editing.id);
    } else {
      if (!activeRanch) return;
      await supabase.from('herds').insert({
        ...data,
        ranch_id: activeRanch.ranchId,
      });
    }
    setEditing(null);
    setShowAdd(false);
    fetchData();
  };

  const deleteHerd = async (id: string) => {
    if (!confirm('Delete this herd?')) return;
    await supabase.from('herds').delete().eq('id', id);
    fetchData();
  };

  return (
    <div className="px-6 pt-14 pb-6 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-base font-semibold text-white/90 tracking-tight">Herds</h1>
          <p className="text-xs text-white/40 mt-0.5">{herds.length} total</p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-zinc-900 rounded-lg transition-colors duration-150"
        >
          + Add Herd
        </button>
      </div>

      {/* Add/Edit Form */}
      {(showAdd || editing) && (
        <div className="bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-5 mb-5">
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">
            {editing ? 'Edit Herd' : 'New Herd'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls}
                placeholder="Herd name"
              />
            </div>
            <div>
              <label className={labelCls}>Head Count</label>
              <input
                type="number"
                value={form.head_count}
                onChange={(e) => setForm({ ...form, head_count: e.target.value })}
                className={inputCls}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelCls}>Avg Weight (lbs)</label>
              <input
                type="number"
                value={form.avg_weight_lbs}
                onChange={(e) => setForm({ ...form, avg_weight_lbs: e.target.value })}
                className={inputCls}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select
                value={form.herd_type}
                onChange={(e) => setForm({ ...form, herd_type: e.target.value })}
                className={inputCls}
              >
                <option value="">— Select —</option>
                {herdTypes.map((t) => (
                  <option key={t} value={t} className="bg-zinc-900 capitalize">{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Current Paddock</label>
              <select
                value={form.current_paddock_id}
                onChange={(e) => setForm({ ...form, current_paddock_id: e.target.value })}
                className={inputCls}
              >
                <option value="">None</option>
                {paddocks.map((p) => (
                  <option key={p.id} value={p.id} className="bg-zinc-900">{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={inputCls}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4 pt-4 border-t border-white/[0.06]">
            <button
              onClick={save}
              className="px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 text-zinc-900 rounded-lg transition-colors duration-150"
            >
              {editing ? 'Save Changes' : 'Create'}
            </button>
            <button
              onClick={() => { setEditing(null); setShowAdd(false); }}
              className="px-4 py-2 text-sm font-medium bg-white/[0.08] hover:bg-white/[0.12] text-white/60 hover:text-white/80 border border-white/10 rounded-lg transition-all duration-150"
            >
              Cancel
            </button>
            {editing && (
              <button
                onClick={() => deleteHerd(editing.id)}
                className="px-4 py-2 text-sm font-medium bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/20 rounded-lg transition-all duration-150 ml-auto"
              >
                Delete Herd
              </button>
            )}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {herds.map((h) => (
          <div key={h.id} onClick={() => openEdit(h)} className="cursor-pointer">
            <HerdCard herd={h} paddockName={paddockName(h.current_paddock_id)} />
          </div>
        ))}
      </div>

      {herds.length === 0 && (
        <div className="text-center text-white/20 text-sm py-12">
          No herds yet. Add one to get started.
        </div>
      )}
    </div>
  );
}
