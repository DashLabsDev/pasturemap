'use client';

import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0e0f0f]">
      <div className="w-5 h-5 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
    </div>
  ),
});

export default function MapPage() {
  return (
    <div className="w-full h-full">
      <MapView />
    </div>
  );
}
