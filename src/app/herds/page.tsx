'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, DEFAULT_RANCH_ID } from '@/lib/supabase';
import type { Herd, Paddock } from '@/lib/types';
import HerdCard from '@/components/HerdCard';

const herdTypes = ['cow-calf', 'stocker', 'bull', 'dry-cows', 'heifers', 'sheep', 'goat', 'other'] as const;

export default function HerdsPage() {
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

  useEffect(() => { fetchData(); }, [fetchData]);

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
      ranch_id: DEFAULT_RANCH_ID,
    };

    if (editing) {
      await supabase.from('herds').update(data).eq('id', editing.id);
    } else {
      await supabase.from('herds').insert(data);
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
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-green-900">Herds</h1>
          <p className="text-sm text-gray-500">{herds.length} herds total</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-600"
        >
          + Add Herd
        </button>
      </div>

      {/* Form */}
      {(showAdd || editing) && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <h2 className="font-bold text-green-900 mb-3">
            {editing ? 'Edit Herd' : 'New Herd'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Herd name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Head Count</label>
              <input
                type="number"
                value={form.head_count}
                onChange={(e) => setForm({ ...form, head_count: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Avg Weight (lbs)</label>
              <input
                type="number"
                value={form.avg_weight_lbs}
                onChange={(e) => setForm({ ...form, avg_weight_lbs: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                value={form.herd_type}
                onChange={(e) => setForm({ ...form, herd_type: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Select type...</option>
                {herdTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Current Paddock</label>
              <select
                value={form.current_paddock_id}
                onChange={(e) => setForm({ ...form, current_paddock_id: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {paddocks.map((p) => (
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
            {editing && (
              <button onClick={() => deleteHerd(editing.id)} className="text-red-500 text-sm ml-auto hover:text-red-700">
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
        <div className="text-center text-gray-400 py-12">
          No herds yet. Add one to get started.
        </div>
      )}
    </div>
  );
}
