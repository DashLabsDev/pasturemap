'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { MoveEvent, Herd } from '@/lib/types';

const eventIcons: Record<string, string> = {
  move: '🚚',
  suspend: '⏸️',
  resume: '▶️',
  'graze-start': '🌱',
  'graze-end': '🏁',
};

const eventLabels: Record<string, string> = {
  move: 'Moved',
  suspend: 'Suspended',
  resume: 'Resumed',
  'graze-start': 'Started Grazing',
  'graze-end': 'Ended Grazing',
};

export default function ActivityPage() {
  const [events, setEvents] = useState<MoveEvent[]>([]);
  const [herds, setHerds] = useState<Herd[]>([]);
  const [filterHerd, setFilterHerd] = useState('');

  const fetchData = useCallback(async () => {
    const [eRes, hRes] = await Promise.all([
      supabase
        .from('move_events')
        .select('*, herd:herds(id, name), from_paddock:paddocks!move_events_from_paddock_id_fkey(id, name), to_paddock:paddocks!move_events_to_paddock_id_fkey(id, name)')
        .order('event_date', { ascending: false })
        .limit(100),
      supabase.from('herds').select('*').order('name'),
    ]);
    if (eRes.data) setEvents(eRes.data as unknown as MoveEvent[]);
    if (hRes.data) setHerds(hRes.data as Herd[]);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = filterHerd
    ? events.filter((e) => e.herd_id === filterHerd)
    : events;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-green-900">Activity Feed</h1>
          <p className="text-sm text-gray-500">{filtered.length} events</p>
        </div>
        <select
          value={filterHerd}
          onChange={(e) => setFilterHerd(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All herds</option>
          {herds.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        {filtered.map((event, i) => {
          const herd = event.herd as unknown as { id: string; name: string } | null;
          const from = event.from_paddock as unknown as { id: string; name: string } | null;
          const to = event.to_paddock as unknown as { id: string; name: string } | null;
          const type = event.event_type ?? 'move';
          const date = new Date(event.event_date);
          const isNewDay =
            i === 0 ||
            new Date(filtered[i - 1].event_date).toDateString() !== date.toDateString();

          return (
            <div key={event.id}>
              {isNewDay && (
                <div className="text-xs font-medium text-gray-500 pt-4 pb-2 border-b border-gray-100">
                  {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              )}
              <div className="flex items-start gap-3 py-3 px-2 hover:bg-stone-50 rounded-lg">
                <span className="text-xl mt-0.5">{eventIcons[type] ?? '📌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium text-green-900">{eventLabels[type] ?? type}</span>
                    {' '}
                    <span className="text-gray-600">{herd?.name ?? 'Unknown herd'}</span>
                    {type === 'move' && from && to && (
                      <span className="text-gray-500">
                        {' '}from <span className="font-medium">{from.name}</span> to <span className="font-medium">{to.name}</span>
                      </span>
                    )}
                    {(type === 'graze-start' || type === 'resume') && to && (
                      <span className="text-gray-500">
                        {' '}in <span className="font-medium">{to.name}</span>
                      </span>
                    )}
                    {(type === 'graze-end' || type === 'suspend') && from && (
                      <span className="text-gray-500">
                        {' '}from <span className="font-medium">{from.name}</span>
                      </span>
                    )}
                  </p>
                  {event.head_count && (
                    <p className="text-xs text-gray-400 mt-0.5">{event.head_count} head</p>
                  )}
                  {event.notes && (
                    <p className="text-xs text-gray-400 mt-0.5 italic">{event.notes}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            No activity recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
