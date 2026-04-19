'use client';

import { useEffect, useState, useCallback } from 'react';
import { MoveRight, Pause, Play, Leaf, Flag, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MoveEvent, Herd } from '@/lib/types';

const eventIcon: Record<string, React.ReactNode> = {
  move: <MoveRight className="w-4 h-4" />,
  suspend: <Pause className="w-4 h-4" />,
  resume: <Play className="w-4 h-4" />,
  'graze-start': <Leaf className="w-4 h-4" />,
  'graze-end': <Flag className="w-4 h-4" />,
};

const eventLabel: Record<string, string> = {
  move: 'Moved',
  suspend: 'Suspended',
  resume: 'Resumed',
  'graze-start': 'Started Grazing',
  'graze-end': 'Ended Grazing',
};

const inputCls = 'px-3 py-2 text-sm bg-white/[0.08] border border-white/10 text-white placeholder-white/25 rounded-lg focus:outline-none focus:border-white/25 focus:bg-white/[0.10] transition-all duration-150';

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
    <div className="px-6 pt-14 pb-6 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-base font-semibold text-white/90 tracking-tight">Activity Feed</h1>
          <p className="text-xs text-white/40 mt-0.5">{filtered.length} events</p>
        </div>
        <select
          value={filterHerd}
          onChange={(e) => setFilterHerd(e.target.value)}
          className={inputCls}
        >
          <option value="">All herds</option>
          {herds.map((h) => (
            <option key={h.id} value={h.id} className="bg-zinc-900">{h.name}</option>
          ))}
        </select>
      </div>

      {/* Event list */}
      <div className="space-y-0.5">
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
                <p className="text-xs font-medium text-white/30 pt-5 pb-2 border-b border-white/[0.05] mb-1">
                  {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
              <div className="flex items-start gap-3 py-2.5 px-2 hover:bg-white/[0.03] rounded-lg transition-colors duration-100">
                <span className="text-white/30 mt-0.5 shrink-0">
                  {eventIcon[type] ?? <MapPin className="w-4 h-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80">
                    <span className="font-semibold text-white/90">{eventLabel[type] ?? type}</span>
                    {' '}
                    <span className="text-white/60">{herd?.name ?? 'Unknown herd'}</span>
                    {type === 'move' && from && to && (
                      <span className="text-white/40">
                        {' '}from <span className="text-white/60 font-medium">{from.name}</span> to <span className="text-white/60 font-medium">{to.name}</span>
                      </span>
                    )}
                    {(type === 'graze-start' || type === 'resume') && to && (
                      <span className="text-white/40">
                        {' '}in <span className="text-white/60 font-medium">{to.name}</span>
                      </span>
                    )}
                    {(type === 'graze-end' || type === 'suspend') && from && (
                      <span className="text-white/40">
                        {' '}from <span className="text-white/60 font-medium">{from.name}</span>
                      </span>
                    )}
                  </p>
                  {event.head_count && (
                    <p className="text-xs text-white/30 mt-0.5">{event.head_count} head</p>
                  )}
                  {event.notes && (
                    <p className="text-xs text-white/30 mt-0.5 italic">{event.notes}</p>
                  )}
                </div>
                <span className="text-xs text-white/25 whitespace-nowrap shrink-0">
                  {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center text-white/20 text-sm py-12">
            No activity recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
