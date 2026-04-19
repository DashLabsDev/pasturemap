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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

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
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    fetchData();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === paddocks.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paddocks.map((p) => p.id)));
    }
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} paddock${selected.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    await supabase.from('paddocks').delete().in('id', Array.from(selected));
    setSelected(new Set());
    setBulkDeleting(false);
    fetchData();
  };

  const allSelected = paddocks.length > 0 && selected.size === paddocks.length;
  const someSelected = selected.size > 0 && selected.size < paddocks.length;

  const inputCls = 'w-full px-3 py-2 text-sm bg-white/[0.06] border border-white/[0.08] text-white placeholder-white/20 rounded-lg focus:outline-none focus:border-white/25 focus:bg-white/[0.08] transition-all duration-150';
  const labelCls = 'block text-xs text-white/35 font-medium mb-1.5 uppercase tracking-wide';

  return (
    <div className="px-6 pt-14 pb-6 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-base font-semibold text-white/90 tracking-tight">Paddocks</h1>
          <p className="text-xs text-white/35 mt-0.5">{paddocks.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={bulkDelete}
              disabled={bulkDeleting}
              className="px-3 py-2 text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/30 rounded-lg transition-all duration-150 disabled:opacity-50"
            >
              {bulkDeleting ? 'Deleting…' : `Delete ${selected.size}`}
            </button>
          )}
          <button
            onClick={openAdd}
            className="px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-zinc-900 rounded-lg transition-colors duration-150"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {(showAdd || editing) && (
        <div className="bg-zinc-900 border border-white/[0.08] rounded-xl shadow-2xl p-5 mb-5">
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">
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
                <option value="">— Select —</option>
                {fenceTypes.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Water Source</label>
              <select value={form.water_source} onChange={(e) => setForm({ ...form, water_source: e.target.value })} className={inputCls}>
                <option value="">— Select —</option>
                {waterSources.map((w) => <option key={w} value={w} className="capitalize">{w}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Parent Paddock</label>
              <select value={form.parent_paddock_id} onChange={(e) => setForm({ ...form, parent_paddock_id: e.target.value })} className={inputCls}>
                <option value="">None (top-level)</option>
                {paddocks.filter((p) => p.id !== editing?.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} placeholder="Optional" />
            </div>
          </div>
          <div className="flex gap-2 mt-4 pt-4 border-t border-white/[0.06]">
            <button onClick={save} className="px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 text-zinc-900 rounded-lg transition-colors duration-150">
              {editing ? 'Save Changes' : 'Create'}
            </button>
            <button onClick={() => { setEditing(null); setShowAdd(false); }} className="px-4 py-2 text-sm font-medium text-white/40 hover:text-white/70 transition-colors duration-150">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-zinc-900 border border-white/[0.08] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleSelectAll}
                  className="w-3.5 h-3.5 rounded border-white/20 bg-white/[0.06] accent-amber-500 cursor-pointer"
                />
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-white/35 uppercase tracking-widest">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-white/35 uppercase tracking-widest">Acres</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-white/35 uppercase tracking-widest hidden md:table-cell">Fence</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-white/35 uppercase tracking-widest hidden md:table-cell">Water</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-white/35 uppercase tracking-widest">Herd</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-white/35 uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {paddocks.map((p) => {
              const status = getStatus(p.id);
              const herd = getHerd(p.id);
              const isSelected = selected.has(p.id);
              return (
                <tr
                  key={p.id}
                  className={`border-b border-white/[0.04] transition-colors duration-100 ${isSelected ? 'bg-amber-500/[0.04]' : 'hover:bg-white/[0.03]'}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(p.id)}
                      className="w-3.5 h-3.5 rounded border-white/20 bg-white/[0.06] accent-amber-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 text-white/80 font-medium">
                    {p.name}
                    {p.parent_paddock_id && <span className="text-[10px] text-white/25 ml-1.5 font-normal">sub</span>}
                  </td>
                  <td className="px-4 py-3 text-white/50 tabular-nums">{p.acreage ?? '—'}</td>
                  <td className="px-4 py-3 text-white/50 capitalize hidden md:table-cell">{p.fence_type ?? '—'}</td>
                  <td className="px-4 py-3 text-white/50 capitalize hidden md:table-cell">{p.water_source ?? '—'}</td>
                  <td className="px-4 py-3 text-white/50">{herd?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide ${status.badge}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(p)} className="text-white/30 hover:text-amber-400 text-xs mr-3 transition-colors">Edit</button>
                    <button onClick={() => deletePaddock(p.id)} className="text-white/30 hover:text-red-400 text-xs transition-colors">✕</button>
                  </td>
                </tr>
              );
            })}
            {paddocks.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-white/20 text-sm">
                  No paddocks yet — draw one on the map or add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
