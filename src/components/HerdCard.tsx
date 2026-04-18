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

const statusStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-yellow-100 text-yellow-800',
  'moved-out': 'bg-gray-100 text-gray-600',
  sold: 'bg-red-100 text-red-800',
};

export default function HerdCard({ herd, paddockName }: Props) {
  return (
    <Link
      href={`/herds/${herd.id}`}
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-green-900">{herd.name}</h3>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[herd.status ?? 'active']}`}>
          {herd.status ?? 'active'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-gray-500">Head</span>
          <p className="font-medium">{herd.head_count}</p>
        </div>
        <div>
          <span className="text-gray-500">Avg Weight</span>
          <p className="font-medium">{herd.avg_weight_lbs ?? '—'} lbs</p>
        </div>
        <div>
          <span className="text-gray-500">Type</span>
          <p className="font-medium">{typeLabels[herd.herd_type ?? ''] ?? '—'}</p>
        </div>
        <div>
          <span className="text-gray-500">Paddock</span>
          <p className="font-medium truncate">{paddockName ?? '—'}</p>
        </div>
      </div>
    </Link>
  );
}
