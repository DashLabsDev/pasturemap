'use client';

import Link from 'next/link';
import type { Herd } from '@/lib/types';

interface Props {
  herd: Herd;
  paddockName?: string;
}

const typeLabels: Record<string, string> = {
  'cow-calf': 'Cow-Calf',
  stocker: 'Stocker',
  bull: 'Bull',
  'dry-cows': 'Dry Cows',
  heifers: 'Heifers',
  sheep: 'Sheep',
  goat: 'Goat',
  other: 'Other',
};

const statusBadge: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border border-green-500/20',
  suspended: 'bg-white/[0.08] text-white/50 border border-white/10',
  'moved-out': 'bg-white/[0.08] text-white/50 border border-white/10',
  sold: 'bg-red-500/20 text-red-400 border border-red-500/20',
};

export default function HerdCard({ herd, paddockName }: Props) {
  return (
    <Link
      href={`/herds/${herd.id}`}
      className="block bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-xl p-4 hover:bg-zinc-900/95 transition-colors duration-150"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white/90 truncate">{herd.name}</h3>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge[herd.status ?? 'active']}`}>
          {herd.status ?? 'active'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-white/40 font-medium">Head</p>
          <p className="text-sm font-semibold text-white/80 mt-0.5">{herd.head_count}</p>
        </div>
        <div>
          <p className="text-xs text-white/40 font-medium">Avg Weight</p>
          <p className="text-sm font-semibold text-white/80 mt-0.5">{herd.avg_weight_lbs ?? '—'} lbs</p>
        </div>
        <div>
          <p className="text-xs text-white/40 font-medium">Type</p>
          <p className="text-sm font-semibold text-white/80 mt-0.5">{typeLabels[herd.herd_type ?? ''] ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-white/40 font-medium">Paddock</p>
          <p className="text-sm font-semibold text-white/80 mt-0.5 truncate">{paddockName ?? '—'}</p>
        </div>
      </div>
    </Link>
  );
}
