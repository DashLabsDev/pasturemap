'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Herd, Animal, WeightRecord } from '@/lib/types';

const sexOptions = ['bull', 'cow', 'heifer', 'steer', 'calf'] as const;

export default function HerdDetailPage() {
  const params = useParams();
  const router = useRouter();
  const herdId = params.id as string;

  const [herd, setHerd] = useState<Herd | null>(null);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [weightHistory, setWeightHistory] = useState<WeightRecord[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Animal | null>(null);

  const [form, setForm] = useState({
    tag_number: '',
    name: '',
    breed: '',
    sex: '',
    birth_date: '',
    weight_lbs: '',
    dmi_percent: '2.0',
    notes: '',
  });

  const fetchData = useCallback(async () => {
    const [hRes, aRes] = await Promise.all([
      supabase.from('herds').select('*').eq('id', herdId).single(),
      supabase.from('animals').select('*').eq('herd_id', herdId).order('tag_number'),
    ]);
    if (hRes.data) setHerd(hRes.data as Herd);
    if (aRes.data) setAnimals(aRes.data as Animal[]);
  }, [herdId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const loadWeightHistory = async (animalId: string) => {
    const { data } = await supabase
      .from('weight_records')
      .select('*')
      .eq('animal_id', animalId)
      .order('recorded_at', { ascending: true });
    setWeightHistory((data ?? []) as WeightRecord[]);
  };

  const selectAnimal = (animal: Animal) => {
    setSelectedAnimal(animal);
    loadWeightHistory(animal.id);
  };

  const openAdd = () => {
    setEditing(null);
    setShowAdd(true);
    setForm({ tag_number: '', name: '', breed: '', sex: '', birth_date: '', weight_lbs: '', dmi_percent: '2.0', notes: '' });
  };

  const openEdit = (animal: Animal) => {
    setEditing(animal);
    setShowAdd(false);
    setForm({
      tag_number: animal.tag_number ?? '',
      name: animal.name ?? '',
      breed: animal.breed ?? '',
      sex: animal.sex ?? '',
      birth_date: animal.birth_date ?? '',
      weight_lbs: animal.weight_lbs?.toString() ?? '',
      dmi_percent: animal.dmi_percent?.toString() ?? '2.0',
      notes: animal.notes ?? '',
    });
  };

  const save = async () => {
    const data = {
      herd_id: herdId,
      tag_number: form.tag_number || null,
      name: form.name || null,
      breed: form.breed || null,
      sex: form.sex || null,
      birth_date: form.birth_date || null,
      weight_lbs: form.weight_lbs ? parseFloat(form.weight_lbs) : null,
      dmi_percent: form.dmi_percent ? parseFloat(form.dmi_percent) : 2.0,
      notes: form.notes || null,
    };

    if (editing) {
      await supabase.from('animals').update(data).eq('id', editing.id);
    } else {
      await supabase.from('animals').insert(data);
    }
    setEditing(null);
    setShowAdd(false);
    fetchData();
  };

  const deleteAnimal = async (id: string) => {
    if (!confirm('Remove this animal?')) return;
    await supabase.from('animals').delete().eq('id', id);
    setSelectedAnimal(null);
    fetchData();
  };

  // Simple bar chart for weight history
  const maxWeight = weightHistory.length > 0
    ? Math.max(...weightHistory.map((w) => w.weight_lbs))
    : 0;

  if (!herd) {
    return (
      <div className="p-6 text-center text-gray-400">Loading herd...</div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button onClick={() => router.push('/herds')} className="text-green-700 text-sm mb-4 hover:text-green-900">
        &larr; Back to Herds
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-green-900">{herd.name}</h1>
          <p className="text-sm text-gray-500">
            {herd.head_count} head &middot; {herd.avg_weight_lbs ?? '?'} lbs avg &middot; {herd.herd_type ?? 'untyped'}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-600"
        >
          + Add Animal
        </button>
      </div>

      {/* Form */}
      {(showAdd || editing) && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <h2 className="font-bold text-green-900 mb-3">
            {editing ? 'Edit Animal' : 'New Animal'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tag #</label>
              <input
                value={form.tag_number}
                onChange={(e) => setForm({ ...form, tag_number: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Breed</label>
              <input
                value={form.breed}
                onChange={(e) => setForm({ ...form, breed: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sex</label>
              <select
                value={form.sex}
                onChange={(e) => setForm({ ...form, sex: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Select...</option>
                {sexOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Birth Date</label>
              <input
                type="date"
                value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Weight (lbs)</label>
              <input
                type="number"
                value={form.weight_lbs}
                onChange={(e) => setForm({ ...form, weight_lbs: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">DMI %</label>
              <input
                type="number"
                step="0.1"
                value={form.dmi_percent}
                onChange={(e) => setForm({ ...form, dmi_percent: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={save} className="bg-green-700 text-white rounded px-4 py-2 text-sm font-medium hover:bg-green-600">
              {editing ? 'Update' : 'Add'}
            </button>
            <button onClick={() => { setEditing(null); setShowAdd(false); }} className="bg-gray-200 text-gray-700 rounded px-4 py-2 text-sm font-medium">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Animal list */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-green-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-green-900">Tag</th>
                  <th className="text-left px-4 py-3 font-medium text-green-900">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-green-900 hidden md:table-cell">Breed</th>
                  <th className="text-left px-4 py-3 font-medium text-green-900">Sex</th>
                  <th className="text-left px-4 py-3 font-medium text-green-900">Weight</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {animals.map((a) => (
                  <tr
                    key={a.id}
                    className={`hover:bg-stone-50 cursor-pointer ${selectedAnimal?.id === a.id ? 'bg-green-50' : ''}`}
                    onClick={() => selectAnimal(a)}
                  >
                    <td className="px-4 py-3 font-mono">{a.tag_number ?? '—'}</td>
                    <td className="px-4 py-3">{a.name ?? '—'}</td>
                    <td className="px-4 py-3 hidden md:table-cell">{a.breed ?? '—'}</td>
                    <td className="px-4 py-3 capitalize">{a.sex ?? '—'}</td>
                    <td className="px-4 py-3">{a.weight_lbs ?? '—'} lbs</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(a); }}
                        className="text-green-700 hover:text-green-900 text-xs mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteAnimal(a.id); }}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {animals.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      No animals in this herd yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Animal detail panel */}
        <div>
          {selectedAnimal ? (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-bold text-green-900 mb-3">
                {selectedAnimal.name || selectedAnimal.tag_number || 'Animal'}
              </h3>

              {selectedAnimal.photo_url && (
                <img
                  src={selectedAnimal.photo_url}
                  alt={selectedAnimal.name ?? 'Animal'}
                  className="w-full h-40 object-cover rounded-lg mb-3"
                />
              )}

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Tag</span>
                  <span className="font-mono">{selectedAnimal.tag_number ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Breed</span>
                  <span>{selectedAnimal.breed ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sex</span>
                  <span className="capitalize">{selectedAnimal.sex ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Weight</span>
                  <span>{selectedAnimal.weight_lbs ?? '—'} lbs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">DMI %</span>
                  <span>{selectedAnimal.dmi_percent ?? 2.0}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Birth Date</span>
                  <span>{selectedAnimal.birth_date ?? '—'}</span>
                </div>
              </div>

              {/* Weight history chart */}
              {weightHistory.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-medium text-gray-600 mb-2">Weight History</h4>
                  <div className="flex items-end gap-1 h-24">
                    {weightHistory.map((w) => (
                      <div
                        key={w.id}
                        className="bg-green-500 rounded-t flex-1 min-w-[8px] relative group"
                        style={{ height: `${(w.weight_lbs / maxWeight) * 100}%` }}
                        title={`${w.weight_lbs} lbs — ${new Date(w.recorded_at).toLocaleDateString()}`}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap mb-1">
                          {w.weight_lbs} lbs
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>{new Date(weightHistory[0].recorded_at).toLocaleDateString()}</span>
                    <span>{new Date(weightHistory[weightHistory.length - 1].recorded_at).toLocaleDateString()}</span>
                  </div>
                </div>
              )}

              {selectedAnimal.notes && (
                <p className="mt-3 text-xs text-gray-500 italic">{selectedAnimal.notes}</p>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-400 text-sm">
              Select an animal to see details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
