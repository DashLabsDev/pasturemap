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
    if (session) return { label: 'Grazing', style: 'bg-green-100 text-green-800' };
    return { label: 'Idle', style: 'bg-gray-100 text-gray-600' };
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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-green-900">Paddocks</h1>
          <p className="text-sm text-gray-500">{paddocks.length} paddocks total</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-600"
        >
          + Add Paddock
        </button>
      </div>

      {/* Form */}
      {(showAdd || editing) && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <h2 className="font-bold text-green-900 mb-3">
            {editing ? 'Edit Paddock' : 'New Paddock'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Paddock name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Acreage</label>
              <input
                type="number"
                value={form.acreage}
                onChange={(e) => setForm({ ...form, acreage: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="0.0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fence Type</label>
              <select
                value={form.fence_type}
                onChange={(e) => setForm({ ...form, fence_type: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">None selected</option>
                {fenceTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Water Source</label>
              <select
                value={form.water_source}
                onChange={(e) => setForm({ ...form, water_source: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">None selected</option>
                {waterSources.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Parent Paddock (for subdivide)</label>
              <select
                value={form.parent_paddock_id}
                onChange={(e) => setForm({ ...form, parent_paddock_id: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">None (top-level)</option>
                {paddocks
                  .filter((p) => p.id !== editing?.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Optional notes"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={save} className="bg-green-700 text-white rounded px-4 py-2 text-sm font-medium hover:bg-green-600">
              {editing ? 'Update' : 'Create'}
            </button>
            <button onClick={() => { setEditing(null); setShowAdd(false); }} className="bg-gray-200 text-gray-700 rounded px-4 py-2 text-sm font-medium">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-green-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-green-900">Name</th>
              <th className="text-left px-4 py-3 font-medium text-green-900">Acreage</th>
              <th className="text-left px-4 py-3 font-medium text-green-900 hidden md:table-cell">Fence</th>
              <th className="text-left px-4 py-3 font-medium text-green-900 hidden md:table-cell">Water</th>
              <th className="text-left px-4 py-3 font-medium text-green-900">Herd</th>
              <th className="text-left px-4 py-3 font-medium text-green-900">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paddocks.map((p) => {
              const status = getStatus(p.id);
              const herd = getHerd(p.id);
              return (
                <tr key={p.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium">
                    {p.name}
                    {p.parent_paddock_id && (
                      <span className="text-xs text-gray-400 ml-1">(sub)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{p.acreage ?? '—'}</td>
                  <td className="px-4 py-3 capitalize hidden md:table-cell">{p.fence_type ?? '—'}</td>
                  <td className="px-4 py-3 capitalize hidden md:table-cell">{p.water_source ?? '—'}</td>
                  <td className="px-4 py-3">{herd?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.style}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(p)} className="text-green-700 hover:text-green-900 text-xs mr-2">
                      Edit
                    </button>
                    <button onClick={() => deletePaddock(p.id)} className="text-red-500 hover:text-red-700 text-xs">
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {paddocks.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
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
