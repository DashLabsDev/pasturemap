'use client';

import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-green-900 text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
        <p>Loading map...</p>
      </div>
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
