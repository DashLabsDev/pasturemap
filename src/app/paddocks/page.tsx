'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, DEFAULT_RANCH_ID } from '@/lib/supabase';
import type { Paddock, Herd, GrazingSession } from '@/lib/types';

const fenceTypes = ['permanent', 'electric', 'temporary', 'none'] as const;
const waterSources = ['pond', 'tank', 'creek', 'well', 'trough', 'none'] as const;

export default function PaddocksPage() {
  const [paddocks, setPaddocks] = useState<Paddock[]>([]);
  const [herds, setHerds] = useState<Herd[]>([]);
  const [sessions, setSessions] = useState<GrazingSession[]>([]);
  const [editing, setEditing] = useState<Paddock | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const [form, setForm] = useState({
    name: '',
    acreage: '',
    fence_type: '' as string,
    water_source: '' as string,
    notes: '',
    parent_paddock_id: '' as string,
  });

  const fetchData = useCallback(async () => {
    const [pRes, hRes, sRes] = await Promise.all([
      supabase.from('paddocks_geojson').select('*'),
      supabase.from('herds').select('*'),
      supabase.from('grazing_sessions').select('*').eq('status', 'active'),
    ]);
    if (pRes.data) setPaddocks(pRes.data as Paddock[]);
    if (hRes.data) setHerds(hRes.data as Herd[]);
    if (sRes.data) setSessions(sRes.data as GrazingSession[]);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getStatus = (paddockId: string) => {
    const session = sessions.find((s) => s.paddock_id === paddockId);
    if (session) return { label: 'Grazing', badge: 'bg-green-500/20 text-green-400 border border-green-500/20' };
    return { label: 'Resting', badge: 'bg-white/[0.08] text-white/50 border border-white/10' };
  };

  const getHerd = (paddockId: string) =>
    herds.find((h) => h.current_paddock_id === paddockId);

  const openEdit = (paddock: Paddock) => {
    setEditing(paddock);
    setShowAdd(false);
    setForm({
      name: paddock.name,
      acreage: paddock.acreage?.toString() ?? '',
      fence_type: paddock.fence_type ?? '',
      water_source: paddock.water_source ?? '',
      notes: paddock.notes ?? '',
      parent_paddock_id: paddock.parent_paddock_id ?? '',
    });
  };

  const openAdd = () => {
    setEditing(null);
    setShowAdd(true);
    setForm({ name: '', acreage: '', fence_type: '', water_source: '', notes: '', parent_paddock_id: '' });
  };

  const save = async () => {
    if (!form.name.trim()) return;
    const data = {
      name: form.name,
      acreage: form.acreage ? parseFloat(form.acreage) : null,
      fence_type: form.fence_type || null,
      water_source: form.water_source || null,
      notes: form.notes || null,
      parent_paddock_id: form.parent_paddock_id || null,
    };
    if (editing) {
      await supabase.from('paddocks').update(data).eq('id', editing.id);
    } else {
      await supabase.from('paddocks').insert({ ...data, ranch_id: DEFAULT_RANCH_ID });
    }
    setEditing(null);
    setShowAdd(false);
    fetchData();
  };

  const deletePaddock = async (id: string) => {
    if (!confirm('Delete this paddock?')) return;
    await supabase.from('paddocks').delete().eq('id', id);
    fetchData();
  };

  const inputCls = 'w-full px-3 py-2 text-sm bg-white/[0.08] border border-white/10 text-white placeholder-white/25 rounded-lg focus:outline-none focus:border-white/25 focus:bg-white/[0.10] transition-all duration-150';
  const labelCls = 'block text-xs text-white/40 font-medium mb-1';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-sm font-semibold text-white/90 uppercase tracking-wide">Paddocks</h1>
          <p className="text-xs text-white/40 mt-0.5">{paddocks.length} paddocks total</p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 text-zinc-900 rounded-lg transition-colors duration-150"
        >
          + Add Paddock
        </button>
      </div>

      {(showAdd || editing) && (
        <div className="bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-white/90 uppercase tracking-wide mb-4">
            {editing ? 'Edit Paddock' : 'New Paddock'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Paddock name" />
            </div>
            <div>
              <label className={labelCls}>Acreage</label>
              <input type="number" value={form.acreage} onChange={(e) => setForm({ ...form, acreage: e.target.value })} className={inputCls} placeholder="0.0" />
            </div>
            <div>
              <label className={labelCls}>Fence Type</label>
              <select value={form.fence_type} onChange={(e) => setForm({ ...form, fence_type: e.target.value })} className={inputCls}>
                <option value="">None selected</option>
                {fenceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Water Source</label>
              <select value={form.water_source} onChange={(e) => setForm({ ...form, water_source: e.target.value })} className={inputCls}>
                <option value="">None selected</option>
                {waterSources.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Parent Paddock (subdivision)</label>
              <select value={form.parent_paddock_id} onChange={(e) => setForm({ ...form, parent_paddock_id: e.target.value })} className={inputCls}>
                <option value="">None (top-level)</option>
                {paddocks.filter((p) => p.id !== editing?.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} placeholder="Optional notes" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={save} className="px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 text-zinc-900 rounded-lg transition-colors duration-150">
              {editing ? 'Update' : 'Create'}
            </button>
            <button onClick={() => { setEditing(null); setShowAdd(false); }} className="px-4 py-2 text-sm font-medium bg-white/[0.08] hover:bg-white/[0.12] text-white/60 hover:text-white/80 border border-white/10 rounded-lg transition-all duration-150">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.04] border-b border-white/[0.05]">
              <th className="text-left px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Acreage</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wide hidden md:table-cell">Fence</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wide hidden md:table-cell">Water</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Herd</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {paddocks.map((p) => {
              const status = getStatus(p.id);
              const herd = getHerd(p.id);
              return (
                <tr key={p.id} className="border-b border-white/[0.05] hover:bg-white/[0.04] transition-colors duration-100">
                  <td className="px-4 py-3 text-white/80 font-medium">
                    {p.name}
                    {p.parent_paddock_id && <span className="text-xs text-white/30 ml-1.5">sub</span>}
                  </td>
                  <td className="px-4 py-3 text-white/60">{p.acreage ?? '—'}</td>
                  <td className="px-4 py-3 text-white/60 capitalize hidden md:table-cell">{p.fence_type ?? '—'}</td>
                  <td className="px-4 py-3 text-white/60 capitalize hidden md:table-cell">{p.water_source ?? '—'}</td>
                  <td className="px-4 py-3 text-white/60">{herd?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.badge}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(p)} className="text-amber-400 hover:text-amber-300 text-xs mr-3 transition-colors">Edit</button>
                    <button onClick={() => deletePaddock(p.id)} className="text-red-400 hover:text-red-300 text-xs transition-colors">Delete</button>
                  </td>
                </tr>
              );
            })}
            {paddocks.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-white/30 text-sm">
                  No paddocks yet. Draw one on the map or add one here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
