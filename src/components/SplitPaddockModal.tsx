'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { Paddock } from '@/lib/types';

interface Props {
  paddock: Paddock;
  onConfirm: (mode: 'count' | 'acreage', value: number) => void;
  onClose: () => void;
}

function getSplitDirection(paddock: Paddock): 'east–west' | 'north–south' {
  const geo = paddock.boundary_geojson as GeoJSON.Polygon | null;
  if (!geo?.coordinates?.[0]) return 'east–west';
  const coords = geo.coordinates[0];
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const midLat = (minLat + maxLat) / 2;
  const widthM = (maxLng - minLng) * 111320 * Math.cos((midLat * Math.PI) / 180);
  const heightM = (maxLat - minLat) * 110574;
  // If wider than tall → strips run N-S (split direction = east–west)
  // If taller than wide → strips run E-W (split direction = north–south)
  return widthM >= heightM ? 'east–west' : 'north–south';
}

export default function SplitPaddockModal({ paddock, onConfirm, onClose }: Props) {
  const splitDirection = getSplitDirection(paddock);
  const [mode, setMode] = useState<'count' | 'acreage'>('count');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const totalAcres = paddock.acreage ?? 0;

  const handleConfirm = () => {
    const num = parseFloat(value);
    if (!value || isNaN(num) || num <= 0) {
      setError('Enter a valid number');
      return;
    }
    if (mode === 'count' && (num < 2 || num > 70 || !Number.isInteger(num))) {
      setError('Count must be a whole number between 2 and 70');
      return;
    }
    if (mode === 'acreage' && totalAcres > 0 && num >= totalAcres) {
      setError(`Must be less than total acreage (${totalAcres} ac)`);
      return;
    }
    setError('');
    onConfirm(mode, num);
  };

  const previewCount =
    mode === 'count'
      ? Math.floor(parseFloat(value) || 0)
      : totalAcres > 0 && parseFloat(value) > 0
      ? Math.floor(totalAcres / parseFloat(value))
      : null;

  const previewAcres =
    mode === 'count' && totalAcres > 0 && parseFloat(value) > 0
      ? (totalAcres / parseFloat(value)).toFixed(1)
      : mode === 'acreage'
      ? parseFloat(value).toFixed(1)
      : null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl w-80 p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white/90">Split Paddock</h3>
            <p className="text-xs text-white/40 mt-0.5">{paddock.name}{totalAcres ? ` · ${totalAcres} ac` : ''}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition-colors ml-2"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg bg-white/[0.06] p-0.5 mb-4">
          <button
            onClick={() => { setMode('count'); setValue(''); setError(''); }}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
              mode === 'count'
                ? 'bg-white/10 text-white/90'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            # of paddocks
          </button>
          <button
            onClick={() => { setMode('acreage'); setValue(''); setError(''); }}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
              mode === 'acreage'
                ? 'bg-white/10 text-white/90'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Acres per strip
          </button>
        </div>

        {/* Input */}
        <div className="mb-3">
          <label className="block text-xs text-white/40 mb-1.5">
            {mode === 'count' ? 'Number of equal paddocks' : 'Acres per strip'}
          </label>
          <input
            type="number"
            min="1"
            step={mode === 'count' ? '1' : '0.1'}
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(''); }}
            placeholder={mode === 'count' ? 'e.g. 4' : 'e.g. 5'}
            className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 placeholder-white/20 focus:outline-none focus:border-white/25"
            autoFocus
          />
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>

        {/* Preview */}
        {previewCount !== null && previewCount > 0 && previewAcres !== null && (
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 mb-4">
            <p className="text-xs text-white/40">
              Creates <span className="text-white/70 font-medium">{previewCount} strips</span>
              {' '}of <span className="text-white/70 font-medium">~{previewAcres} ac</span> each
            </p>
            <p className="text-xs text-white/25 mt-0.5">Splits {splitDirection} along longest axis</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-xs font-medium text-white/40 hover:text-white/60 bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2 text-xs font-medium bg-amber-500 hover:bg-amber-400 text-zinc-900 rounded-lg transition-colors"
          >
            Split
          </button>
        </div>
      </div>
    </div>
  );
}
