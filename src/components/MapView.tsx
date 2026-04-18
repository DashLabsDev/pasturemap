'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
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

    // Draw create handler
    map.on('draw.create', (e: { features: GeoJSON.Feature[] }) => {
      if (e.features.length > 0) {
        const geo = e.features[0].geometry;
        setNewBoundary(geo);
        setShowNewForm(true);
        // Remove drawn feature from draw (we handle it ourselves)
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

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* New paddock form */}
      {showNewForm && (
        <div className="absolute top-4 left-16 md:left-4 z-[1000] bg-white rounded-lg shadow-xl p-4 w-72">
          <h3 className="font-bold text-green-900 mb-3">New Paddock</h3>
          <input
            type="text"
            placeholder="Paddock name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full border rounded px-3 py-2 mb-2 text-sm"
          />
          <input
            type="number"
            placeholder="Acreage"
            value={newAcreage}
            onChange={(e) => setNewAcreage(e.target.value)}
            className="w-full border rounded px-3 py-2 mb-3 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={saveNewPaddock}
              className="flex-1 bg-green-700 text-white rounded px-3 py-2 text-sm font-medium hover:bg-green-600"
            >
              Save
            </button>
            <button
              onClick={() => {
                setShowNewForm(false);
                setNewBoundary(null);
              }}
              className="flex-1 bg-gray-200 text-gray-700 rounded px-3 py-2 text-sm font-medium hover:bg-gray-300"
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
