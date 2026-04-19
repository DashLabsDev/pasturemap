'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import turfArea from '@turf/area';
import { supabase, DEFAULT_RANCH_ID } from '@/lib/supabase';
import type { Paddock, Herd, GrazingSession } from '@/lib/types';
import PaddockPanel from './PaddockPanel';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const CENTER: [number, number] = [-92.3938, 36.9228];
const ZOOM = 14;

function buildPaddockFeatureCollection(
  paddocks: Paddock[],
  activeSessions: GrazingSession[]
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: paddocks
      .filter((p) => p.boundary_geojson)
      .map((p) => {
        const isActive = activeSessions.some(
          (s) => s.paddock_id === p.id && s.status === 'active'
        );
        return {
          type: 'Feature' as const,
          id: p.id,
          properties: {
            id: p.id,
            name: p.name,
            acreage: p.acreage,
            active: isActive ? 'yes' : 'no',
          },
          geometry: p.boundary_geojson!,
        };
      }),
  };
}

function buildHerdPoints(
  herds: Herd[],
  paddocks: Paddock[]
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const h of herds) {
    if (!h.current_paddock_id) continue;
    const paddock = paddocks.find((p) => p.id === h.current_paddock_id);
    if (!paddock?.boundary_geojson) continue;
    const coords = (paddock.boundary_geojson as GeoJSON.Polygon).coordinates?.[0];
    if (!coords || coords.length === 0) continue;
    const avgLng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
    const avgLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
    features.push({
      type: 'Feature',
      properties: {
        id: h.id,
        name: h.name,
        head_count: h.head_count,
      },
      geometry: { type: 'Point', coordinates: [avgLng, avgLat] },
    });
  }
  return { type: 'FeatureCollection', features };
}

function buildLabelPoints(paddocks: Paddock[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const p of paddocks) {
    if (!p.boundary_geojson) continue;
    const coords = (p.boundary_geojson as GeoJSON.Polygon).coordinates?.[0];
    if (!coords || coords.length === 0) continue;
    const avgLng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
    const avgLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
    features.push({
      type: 'Feature',
      properties: { name: p.name },
      geometry: { type: 'Point', coordinates: [avgLng, avgLat] },
    });
  }
  return { type: 'FeatureCollection', features };
}

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  const [paddocks, setPaddocks] = useState<Paddock[]>([]);
  const [herds, setHerds] = useState<Herd[]>([]);
  const [sessions, setSessions] = useState<GrazingSession[]>([]);
  const [selectedPaddock, setSelectedPaddock] = useState<Paddock | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newBoundary, setNewBoundary] = useState<GeoJSON.Geometry | null>(null);
  const [newName, setNewName] = useState('');
  const [newAcreage, setNewAcreage] = useState('');

  // Address search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; place_name: string; center: [number, number] }>>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const paddocksRef = useRef<Paddock[]>([]);
  paddocksRef.current = paddocks;

  const fetchData = useCallback(async () => {
    const [pRes, hRes, sRes] = await Promise.all([
      supabase.from('paddocks_geojson').select('*'),
      supabase.from('herds').select('*'),
      supabase
        .from('grazing_sessions')
        .select('*, herd:herds(name)')
        .eq('status', 'active'),
    ]);
    if (pRes.data) setPaddocks(pRes.data as Paddock[]);
    if (hRes.data) setHerds(hRes.data as Herd[]);
    if (sRes.data) setSessions(sRes.data as GrazingSession[]);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Initialize map once
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: CENTER,
      zoom: ZOOM,
    });

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: 'simple_select',
    });

    map.addControl(draw, 'top-right');
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    drawRef.current = draw;
    mapRef.current = map;

    map.on('load', () => {
      // Paddock fill source + layers
      map.addSource('paddocks', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'paddocks-fill',
        type: 'fill',
        source: 'paddocks',
        paint: {
          'fill-color': [
            'match',
            ['get', 'active'],
            'yes',
            '#22c55e',
            '#6b7280',
          ],
          'fill-opacity': 0.25,
        },
      });

      map.addLayer({
        id: 'paddocks-outline',
        type: 'line',
        source: 'paddocks',
        paint: {
          'line-color': [
            'match',
            ['get', 'active'],
            'yes',
            '#22c55e',
            '#6b7280',
          ],
          'line-width': 2,
        },
      });

      // Labels source + layer
      map.addSource('paddock-labels', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'paddock-labels-layer',
        type: 'symbol',
        source: 'paddock-labels',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 14,
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 1.5,
        },
      });

      // Herd markers source + layer
      map.addSource('herds', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'herds-circle',
        type: 'circle',
        source: 'herds',
        paint: {
          'circle-radius': 8,
          'circle-color': '#f59e0b',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.addLayer({
        id: 'herds-label',
        type: 'symbol',
        source: 'herds',
        layout: {
          'text-field': ['concat', ['get', 'name'], '\n', ['to-string', ['get', 'head_count']], ' hd'],
          'text-size': 11,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-offset': [0, 1.5],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#fbbf24',
          'text-halo-color': '#000000',
          'text-halo-width': 1,
        },
      });
    });

    // Paddock click handler
    map.on('click', 'paddocks-fill', (e) => {
      if (!e.features || e.features.length === 0) return;
      const feat = e.features[0];
      const pid = feat.properties?.id;
      if (!pid) return;
      const p = paddocksRef.current.find((pd) => pd.id === pid);
      if (p) setSelectedPaddock(p);
    });

    map.on('mouseenter', 'paddocks-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'paddocks-fill', () => {
      map.getCanvas().style.cursor = '';
    });

    // Draw create handler — auto-calculate acreage
    map.on('draw.create', (e: { features: GeoJSON.Feature[] }) => {
      if (e.features.length > 0) {
        const feat = e.features[0];
        const geo = feat.geometry;
        setNewBoundary(geo);
        // Calculate acreage from drawn polygon
        if (geo.type === 'Polygon') {
          const sqMeters = turfArea({ type: 'Feature', geometry: geo, properties: {} });
          const acres = sqMeters / 4046.8564224;
          setNewAcreage(acres.toFixed(2));
        }
        setShowNewForm(true);
        if (drawRef.current) {
          drawRef.current.deleteAll();
        }
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map data when paddocks/herds/sessions change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const update = () => {
      const paddockSrc = map.getSource('paddocks') as mapboxgl.GeoJSONSource | undefined;
      if (paddockSrc) {
        paddockSrc.setData(buildPaddockFeatureCollection(paddocks, sessions));
      }

      const labelSrc = map.getSource('paddock-labels') as mapboxgl.GeoJSONSource | undefined;
      if (labelSrc) {
        labelSrc.setData(buildLabelPoints(paddocks));
      }

      const herdSrc = map.getSource('herds') as mapboxgl.GeoJSONSource | undefined;
      if (herdSrc) {
        herdSrc.setData(buildHerdPoints(herds, paddocks));
      }
    };

    if (map.isStyleLoaded()) {
      update();
    } else {
      map.once('load', update);
    }
  }, [paddocks, herds, sessions]);

  const saveNewPaddock = async () => {
    if (!newName.trim() || !newBoundary) return;
    await supabase.rpc('upsert_paddock', {
      p_ranch_id: DEFAULT_RANCH_ID,
      p_name: newName.trim(),
      p_acreage: newAcreage ? parseFloat(newAcreage) : null,
      p_boundary_geojson: newBoundary,
    });
    setShowNewForm(false);
    setNewBoundary(null);
    setNewName('');
    setNewAcreage('');
    fetchData();
  };

  const herdForPaddock = (paddockId: string) =>
    herds.find((h) => h.current_paddock_id === paddockId);

  // Address search using Mapbox Geocoding API
  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!value.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?access_token=${token}&country=US&types=address,place,region,postcode,locality&proximity=-92.3938,36.9228&limit=5`
      );
      const data = await res.json();
      const features = data.features ?? [];
      setSearchResults(features.map((f: { id: string; place_name: string; center: [number, number] }) => ({
        id: f.id,
        place_name: f.place_name,
        center: f.center,
      })));
      setShowSearchResults(true);
    }, 350);
  };

  const flyToResult = (result: { center: [number, number]; place_name: string }) => {
    mapRef.current?.flyTo({ center: result.center, zoom: 15, duration: 1200 });
    setSearchQuery(result.place_name);
    setSearchResults([]);
    setShowSearchResults(false);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Address search bar */}
      <div className="absolute top-4 left-4 z-[1000] w-72">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none"
            fill="none" stroke="currentColor" strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search address or place..."
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-black/60 backdrop-blur-md text-white placeholder-white/40 border border-white/10 rounded-lg shadow-2xl focus:outline-none focus:border-white/25 focus:bg-black/70 transition-all duration-150"
          />
        </div>
        {showSearchResults && searchResults.length > 0 && (
          <ul className="mt-1 bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl overflow-hidden">
            {searchResults.map((r) => (
              <li
                key={r.id}
                onClick={() => flyToResult(r)}
                className="px-3 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/[0.08] cursor-pointer border-b border-white/5 last:border-0 truncate transition-colors duration-100"
              >
                {r.place_name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* New paddock form */}
      {showNewForm && (
        <div className="absolute top-4 left-16 md:left-4 z-[1000] w-72 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white/90 tracking-wide uppercase">New Paddock</h3>
            <button
              onClick={() => { setShowNewForm(false); setNewBoundary(null); }}
              className="text-white/30 hover:text-white/60 transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="mb-3">
            <label className="block text-xs text-white/40 mb-1 font-medium">Name</label>
            <input
              type="text"
              placeholder="e.g. North Pasture"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white/[0.08] border border-white/10 text-white placeholder-white/25 rounded-lg focus:outline-none focus:border-white/25 focus:bg-white/10 transition-all duration-150"
            />
          </div>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-white/40 font-medium">Acreage</label>
              {newAcreage && (
                <span className="text-xs text-amber-400/80 font-medium">auto-calculated</span>
              )}
            </div>
            <input
              type="number"
              placeholder="0.0"
              value={newAcreage}
              onChange={(e) => setNewAcreage(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white/[0.08] border border-white/10 text-white placeholder-white/25 rounded-lg focus:outline-none focus:border-white/25 focus:bg-white/10 transition-all duration-150"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveNewPaddock}
              className="flex-1 px-3 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 text-zinc-900 rounded-lg transition-colors duration-150"
            >
              Save Paddock
            </button>
            <button
              onClick={() => { setShowNewForm(false); setNewBoundary(null); }}
              className="px-3 py-2 text-sm font-medium bg-white/[0.08] hover:bg-white/[0.12] text-white/60 hover:text-white/80 border border-white/10 rounded-lg transition-all duration-150"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Paddock info panel */}
      {selectedPaddock && (
        <PaddockPanel
          paddock={selectedPaddock}
          herd={herdForPaddock(selectedPaddock.id) || null}
          session={
            sessions.find(
              (s) => s.paddock_id === selectedPaddock.id && s.status === 'active'
            ) || null
          }
          onClose={() => setSelectedPaddock(null)}
        />
      )}
    </div>
  );
}
