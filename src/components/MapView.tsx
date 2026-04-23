'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import turfArea from '@turf/area';
import turfBbox from '@turf/bbox';
import turfIntersect from '@turf/intersect';
import { featureCollection, feature, polygon as turfPolygon } from '@turf/helpers';
import { supabase } from '@/lib/supabase';
import { useRanch } from '@/components/auth/RanchProvider';
import type { Paddock, Herd, GrazingSession } from '@/lib/types';
import PaddockPanel from './PaddockPanel';
import SplitPaddockModal from './SplitPaddockModal';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const DEFAULT_CENTER: [number, number] = [-92.3938, 36.9228];
const DEFAULT_ZOOM = 14;
const VIEW_KEY = 'pasturemap:view';
const HOME_KEY = 'pasturemap:home';
const STYLE_KEY = 'pasturemap:style';

type MapStyleKey = 'satellite' | 'streets' | 'outdoors';
const MAP_STYLES: Record<MapStyleKey, { label: string; url: string }> = {
  satellite: { label: 'Satellite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  streets:   { label: 'Streets',   url: 'mapbox://styles/mapbox/streets-v12' },
  outdoors:  { label: 'Outdoors',  url: 'mapbox://styles/mapbox/outdoors-v12' },
};

function loadMapStyle(): MapStyleKey {
  if (typeof window === 'undefined') return 'satellite';
  try {
    const raw = localStorage.getItem(STYLE_KEY);
    if (raw === 'satellite' || raw === 'streets' || raw === 'outdoors') return raw;
  } catch { /* ignore */ }
  return 'satellite';
}

function saveMapStyle(s: MapStyleKey) {
  try { localStorage.setItem(STYLE_KEY, s); } catch { /* ignore */ }
}

function loadSavedView(): { center: [number, number]; zoom: number } {
  if (typeof window === 'undefined') return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (Array.isArray(v.center) && v.center.length === 2 && typeof v.zoom === 'number') {
        return { center: v.center as [number, number], zoom: v.zoom };
      }
    }
  } catch { /* ignore */ }
  return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
}

function saveView(center: [number, number], zoom: number) {
  try { localStorage.setItem(VIEW_KEY, JSON.stringify({ center, zoom })); } catch { /* ignore */ }
}

function loadHomeLocation(): { center: [number, number]; zoom: number } {
  if (typeof window === 'undefined') return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
  try {
    const raw = localStorage.getItem(HOME_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (Array.isArray(v.center) && v.center.length === 2 && typeof v.zoom === 'number') {
        return { center: v.center as [number, number], zoom: v.zoom };
      }
    }
  } catch { /* ignore */ }
  return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
}

function saveHomeLocation(center: [number, number], zoom: number) {
  try { localStorage.setItem(HOME_KEY, JSON.stringify({ center, zoom })); } catch { /* ignore */ }
}

// Haversine distance between two lng/lat points in meters
function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function haversineLineLength(coords: [number, number][]): number {
  let sum = 0;
  for (let i = 1; i < coords.length; i++) sum += haversineMeters(coords[i - 1], coords[i]);
  return sum;
}

function ToolTile({ label, onClick, icon }: { label: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-2 group">
      <span className="w-12 h-12 flex items-center justify-center rounded-full bg-white/[0.08] group-hover:bg-white/[0.14] border border-white/10 text-white/85 transition-colors [&>svg]:w-6 [&>svg]:h-6">
        {icon}
      </span>
      <span className="text-[11px] leading-tight text-center text-white/75 group-hover:text-white">{label}</span>
    </button>
  );
}

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
      properties: { id: h.id, name: h.name, head_count: h.head_count },
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

// Detect best split axis based on paddock shape.
// 'ew' = wider than tall → cut west→east (vertical strips)
// 'ns' = taller than wide → cut north→south (horizontal strips)
function detectSplitAxis(bbox: [number, number, number, number]): 'ew' | 'ns' {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const midLat = (minLat + maxLat) / 2;
  const cosLat = Math.cos((midLat * Math.PI) / 180);
  const widthM = (maxLng - minLng) * 111320 * cosLat;
  const heightM = (maxLat - minLat) * 110574;
  return widthM >= heightM ? 'ew' : 'ns';
}

// Clip a polygon feature to a bounding box and return the largest polygon piece
function clipToBox(feat: GeoJSON.Feature<GeoJSON.Polygon>, box: GeoJSON.Feature<GeoJSON.Polygon>): GeoJSON.Polygon | null {
  const intersection = turfIntersect(featureCollection([feat, box]));
  if (!intersection) return null;
  if (intersection.geometry.type === 'Polygon') return intersection.geometry as GeoJSON.Polygon;
  if (intersection.geometry.type === 'MultiPolygon') {
    const polys = (intersection.geometry as GeoJSON.MultiPolygon).coordinates;
    const largest = polys.reduce((a, b) =>
      turfArea(turfPolygon(a)) > turfArea(turfPolygon(b)) ? a : b
    );
    return { type: 'Polygon', coordinates: largest };
  }
  return null;
}

// Build a clipping box from coordinate bounds
function makeBox(minLng: number, minLat: number, maxLng: number, maxLat: number) {
  return turfPolygon([[
    [minLng, minLat], [maxLng, minLat],
    [maxLng, maxLat], [minLng, maxLat],
    [minLng, minLat],
  ]]);
}

// Measure the area (m²) of the polygon on one side of a cut line
function areaOnSide(
  feat: GeoJSON.Feature<GeoJSON.Polygon>,
  bbox: [number, number, number, number],
  axis: 'ew' | 'ns',
  cutValue: number,
): number {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const buf = 0.00001;
  const box = axis === 'ew'
    ? makeBox(minLng - buf, minLat - buf, cutValue, maxLat + buf)
    : makeBox(minLng - buf, minLat - buf, maxLng + buf, cutValue);
  const clipped = clipToBox(feat, box);
  return clipped ? turfArea(feature(clipped)) : 0;
}

// Binary search for the cut line where the 'low' side has exactly targetArea (m²)
function findEqualAreaCut(
  feat: GeoJSON.Feature<GeoJSON.Polygon>,
  bbox: [number, number, number, number],
  axis: 'ew' | 'ns',
  lo: number,
  hi: number,
  targetArea: number,
): number {
  let low = lo, high = hi;
  for (let iter = 0; iter < 30; iter++) {
    const mid = (low + high) / 2;
    const area = areaOnSide(feat, bbox, axis, mid);
    if (area < targetArea) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

function splitPolygonIntoStrips(boundary: GeoJSON.Polygon, count: number): GeoJSON.Polygon[] {
  const feat = feature(boundary);
  const bbox = turfBbox(feat) as [number, number, number, number];
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const axis = detectSplitAxis(bbox);
  const buf = 0.00001;
  const totalArea = turfArea(feat);
  const targetPerStrip = totalArea / count;

  // Find N-1 cut lines using binary search so each strip has equal area
  const cuts: number[] = [];
  const coordMin = axis === 'ew' ? minLng : minLat;
  const coordMax = axis === 'ew' ? maxLng : maxLat;
  for (let i = 1; i < count; i++) {
    const cumulativeTarget = targetPerStrip * i;
    cuts.push(findEqualAreaCut(feat, bbox, axis, coordMin, coordMax, cumulativeTarget));
  }

  // Build strips from the cut lines
  const boundaries = [coordMin - buf, ...cuts, coordMax + buf];
  const results: GeoJSON.Polygon[] = [];
  for (let i = 0; i < count; i++) {
    const box = axis === 'ew'
      ? makeBox(boundaries[i], minLat - buf, boundaries[i + 1], maxLat + buf)
      : makeBox(minLng - buf, boundaries[i], maxLng + buf, boundaries[i + 1]);
    const clipped = clipToBox(feat, box);
    if (clipped) results.push(clipped);
  }
  return results;
}

export default function MapView() {
  const { activeRanch } = useRanch();
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
  const [splitTarget, setSplitTarget] = useState<Paddock | null>(null);
  const [splitting, setSplitting] = useState(false);

  const [homeSaved, setHomeSaved] = useState(false);

  // Walk Mode: null = inactive; array (possibly empty) = active. Each entry is [lng, lat].
  const [walkVertices, setWalkVertices] = useState<[number, number][] | null>(null);
  const [dropping, setDropping] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [toolsOpen, setToolsOpen] = useState(false);
  const [userPins, setUserPins] = useState<Array<{ id: string; lng: number; lat: number }>>([]);
  const [measureResult, setMeasureResult] = useState<string | null>(null);
  const [measuring, setMeasuring] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; place_name: string; center: [number, number] }>>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [mapStyle, setMapStyleState] = useState<MapStyleKey>('satellite');
  const [stylePickerOpen, setStylePickerOpen] = useState(false);

  const paddocksRef = useRef<Paddock[]>([]);
  const herdsRef = useRef<Herd[]>([]);
  const sessionsRef = useRef<GrazingSession[]>([]);
  const walkVerticesRef = useRef<[number, number][] | null>(null);
  const userPinsRef = useRef<Array<{ id: string; lng: number; lat: number }>>([]);

  useEffect(() => {
    paddocksRef.current = paddocks;
  }, [paddocks]);

  useEffect(() => {
    herdsRef.current = herds;
  }, [herds]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    walkVerticesRef.current = walkVertices;
  }, [walkVertices]);

  useEffect(() => {
    userPinsRef.current = userPins;
  }, [userPins]);

  const fetchData = useCallback(async () => {
    const [pRes, hRes, sRes] = await Promise.all([
      supabase.from('paddocks_geojson').select('*'),
      supabase.from('herds').select('*'),
      supabase.from('grazing_sessions').select('*, herd:herds(name)').eq('status', 'active'),
    ]);
    if (pRes.data) setPaddocks(pRes.data as Paddock[]);
    if (hRes.data) setHerds(hRes.data as Herd[]);
    if (sRes.data) setSessions(sRes.data as GrazingSession[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const { center, zoom } = loadSavedView();
    const initialStyle = loadMapStyle();
    setMapStyleState(initialStyle);

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLES[initialStyle].url,
      center,
      zoom,
    });

    // Draw instance kept hidden; we trigger modes from the Tools tray
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      defaultMode: 'simple_select',
    });

    map.addControl(draw, 'top-right');
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    // Built-in GPS control — blue dot, accuracy circle, handles platform quirks
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
      showAccuracyCircle: true,
    });
    map.addControl(geolocate, 'bottom-left');

    geolocate.on('error', (e: GeolocationPositionError) => {
      const msg = e?.code === 1 ? 'Location permission denied — enable it in Settings › Safari › Location'
        : e?.code === 2 ? 'GPS unavailable — no signal'
        : e?.code === 3 ? 'GPS timed out — try again with a clear sky view'
        : (e?.message || 'GPS error');
      setGpsError(msg);
    });
    geolocate.on('geolocate', () => { setGpsError(null); });

    drawRef.current = draw;
    mapRef.current = map;

    // Auto-save position whenever the user pans/zooms
    map.on('moveend', () => {
      const c = map.getCenter();
      saveView([c.lng, c.lat], map.getZoom());
    });

    const installStyleLayers = () => {
      if (map.getSource('paddocks')) return; // layers still present after this style load
      map.addSource('paddocks', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'paddocks-fill', type: 'fill', source: 'paddocks',
        paint: { 'fill-color': ['match', ['get', 'active'], 'yes', '#22c55e', '#6b7280'], 'fill-opacity': 0.25 } });
      map.addLayer({ id: 'paddocks-outline', type: 'line', source: 'paddocks',
        paint: { 'line-color': ['match', ['get', 'active'], 'yes', '#22c55e', '#6b7280'], 'line-width': 2 } });

      map.addSource('paddock-labels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'paddock-labels-layer', type: 'symbol', source: 'paddock-labels',
        layout: { 'text-field': ['get', 'name'], 'text-size': 14,
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'], 'text-allow-overlap': true },
        paint: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1.5 } });

      // Walk Mode in-progress polygon
      map.addSource('walk-progress', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'walk-progress-fill', type: 'fill', source: 'walk-progress',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.2 } });
      map.addLayer({ id: 'walk-progress-line', type: 'line', source: 'walk-progress',
        filter: ['!=', ['geometry-type'], 'Point'],
        paint: { 'line-color': '#f59e0b', 'line-width': 3, 'line-dasharray': [2, 1] } });
      map.addLayer({ id: 'walk-progress-points', type: 'circle', source: 'walk-progress',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-radius': 6, 'circle-color': '#f59e0b',
          'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } });

      // User-dropped pins (session-only, not persisted)
      map.addSource('user-pins', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'user-pins-circle', type: 'circle', source: 'user-pins',
        paint: { 'circle-radius': 7, 'circle-color': '#ef4444',
          'circle-stroke-width': 2.5, 'circle-stroke-color': '#ffffff' } });

      map.addSource('herds', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'herds-circle', type: 'circle', source: 'herds',
        paint: { 'circle-radius': 8, 'circle-color': '#f59e0b',
          'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } });
      map.addLayer({ id: 'herds-label', type: 'symbol', source: 'herds',
        layout: { 'text-field': ['concat', ['get', 'name'], '\n', ['to-string', ['get', 'head_count']], ' hd'],
          'text-size': 11, 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-offset': [0, 1.5], 'text-allow-overlap': true },
        paint: { 'text-color': '#fbbf24', 'text-halo-color': '#000000', 'text-halo-width': 1 } });

      // Re-apply current state data (style.load wipes sources, this repopulates them)
      (map.getSource('paddocks') as mapboxgl.GeoJSONSource).setData(
        buildPaddockFeatureCollection(paddocksRef.current, sessionsRef.current)
      );
      (map.getSource('paddock-labels') as mapboxgl.GeoJSONSource).setData(
        buildLabelPoints(paddocksRef.current)
      );
      (map.getSource('herds') as mapboxgl.GeoJSONSource).setData(
        buildHerdPoints(herdsRef.current, paddocksRef.current)
      );
      const wv = walkVerticesRef.current;
      if (wv && wv.length > 0) {
        const features: GeoJSON.Feature[] = wv.map((c, i) => ({
          type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: { index: i },
        }));
        if (wv.length >= 2) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: wv }, properties: {} });
        if (wv.length >= 3) features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...wv, wv[0]]] }, properties: {} });
        (map.getSource('walk-progress') as mapboxgl.GeoJSONSource).setData({ type: 'FeatureCollection', features });
      }
      const pins = userPinsRef.current;
      if (pins.length > 0) {
        (map.getSource('user-pins') as mapboxgl.GeoJSONSource).setData({
          type: 'FeatureCollection',
          features: pins.map((p) => ({
            type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { id: p.id },
          })),
        });
      }
    };

    map.on('style.load', installStyleLayers);

    map.on('click', 'paddocks-fill', (e) => {
      if (!e.features || e.features.length === 0) return;
      const pid = e.features[0].properties?.id;
      if (!pid) return;
      const p = paddocksRef.current.find((pd) => pd.id === pid);
      if (p) setSelectedPaddock(p);
    });
    map.on('mouseenter', 'paddocks-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'paddocks-fill', () => { map.getCanvas().style.cursor = ''; });

    map.on('draw.create', (e: { features: GeoJSON.Feature[] }) => {
      if (e.features.length === 0) return;
      const geo = e.features[0].geometry;
      if (geo.type === 'Polygon') {
        const acres = turfArea({ type: 'Feature', geometry: geo, properties: {} }) / 4046.8564224;
        setNewBoundary(geo);
        setNewAcreage(acres.toFixed(2));
        setShowNewForm(true);
        drawRef.current?.deleteAll();
      } else if (geo.type === 'LineString') {
        const meters = haversineLineLength(geo.coordinates as [number, number][]);
        const feet = meters * 3.28084;
        const label = feet < 1000
          ? `${feet.toFixed(0)} ft`
          : `${(feet / 5280).toFixed(2)} mi (${feet.toFixed(0)} ft)`;
        setMeasureResult(label);
        setMeasuring(false);
        drawRef.current?.deleteAll();
      }
    });

    return () => { map.remove(); mapRef.current = null; drawRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      (map.getSource('paddocks') as mapboxgl.GeoJSONSource | undefined)
        ?.setData(buildPaddockFeatureCollection(paddocks, sessions));
      (map.getSource('paddock-labels') as mapboxgl.GeoJSONSource | undefined)
        ?.setData(buildLabelPoints(paddocks));
      (map.getSource('herds') as mapboxgl.GeoJSONSource | undefined)
        ?.setData(buildHerdPoints(herds, paddocks));
    };
    if (map.isStyleLoaded()) update(); else map.once('style.load', update);
  }, [paddocks, herds, sessions]);

  const saveNewPaddock = async () => {
    if (!newName.trim() || !newBoundary) return;
    await supabase.rpc('upsert_paddock', {
      p_ranch_id: activeRanch?.ranchId,
      p_name: newName.trim(),
      p_acreage: newAcreage ? parseFloat(newAcreage) : null,
      p_boundary_geojson: newBoundary,
    });
    setShowNewForm(false); setNewBoundary(null); setNewName(''); setNewAcreage('');
    fetchData();
  };

  const handleSplitConfirm = async (mode: 'count' | 'acreage', value: number) => {
    if (!splitTarget?.boundary_geojson) return;
    setSplitting(true);
    const boundary = splitTarget.boundary_geojson as GeoJSON.Polygon;
    const totalAcres = splitTarget.acreage ?? 0;
    const count = mode === 'count' ? Math.round(value) : Math.max(2, Math.round(totalAcres / value));
    const strips = splitPolygonIntoStrips(boundary, count);
    for (let i = 0; i < strips.length; i++) {
      // Let PostGIS compute acreage server-side using EPSG:5070 equal-area projection
      await supabase.rpc('upsert_paddock', {
        p_ranch_id: activeRanch?.ranchId,
        p_name: `${splitTarget.name} – ${i + 1}`,
        p_acreage: null,
        p_boundary_geojson: strips[i],
        p_parent_paddock_id: splitTarget.id,
      });
    }
    setSplitting(false); setSplitTarget(null); setSelectedPaddock(null);
    fetchData();
  };


  // Sync in-progress walk polygon to the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource('walk-progress') as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    if (!walkVertices || walkVertices.length === 0) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    const features: GeoJSON.Feature[] = walkVertices.map((c, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: c },
      properties: { index: i },
    }));
    if (walkVertices.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: walkVertices },
        properties: {},
      });
    }
    if (walkVertices.length >= 3) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[...walkVertices, walkVertices[0]]] },
        properties: {},
      });
    }
    src.setData({ type: 'FeatureCollection', features });
  }, [walkVertices]);

  // Sync dropped user pins to the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource('user-pins') as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: 'FeatureCollection',
      features: userPins.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { id: p.id },
      })),
    });
  }, [userPins]);

  const startWalkMode = () => {
    setToolsOpen(false);
    setWalkVertices([]);
    setGpsError(null);
  };

  const startDrawArea = () => {
    setToolsOpen(false);
    drawRef.current?.changeMode('draw_polygon');
  };

  const startMeasure = () => {
    setToolsOpen(false);
    setMeasureResult(null);
    setMeasuring(true);
    drawRef.current?.changeMode('draw_line_string');
  };

  const cancelMeasure = () => {
    setMeasuring(false);
    drawRef.current?.deleteAll();
    drawRef.current?.changeMode('simple_select');
  };

  const dropPinAtGps = () => {
    setToolsOpen(false);
    setDropping(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPins((prev) => [
          ...prev,
          { id: String(Date.now()), lng: pos.coords.longitude, lat: pos.coords.latitude },
        ]);
        mapRef.current?.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], duration: 400 });
        setDropping(false);
      },
      (err) => { setGpsError(err.message || 'GPS unavailable'); setDropping(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const clearUserPins = () => setUserPins([]);

  const changeMapStyle = (key: MapStyleKey) => {
    setMapStyleState(key);
    saveMapStyle(key);
    setStylePickerOpen(false);
    mapRef.current?.setStyle(MAP_STYLES[key].url);
  };

  const dropCorner = () => {
    if (dropping) return;
    setDropping(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setWalkVertices((prev) => (prev ? [...prev, pt] : [pt]));
        mapRef.current?.easeTo({ center: pt, duration: 400 });
        setDropping(false);
      },
      (err) => { setGpsError(err.message || 'GPS unavailable'); setDropping(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const undoCorner = () => {
    setWalkVertices((prev) => (prev && prev.length > 0 ? prev.slice(0, -1) : prev));
  };

  const finishWalk = () => {
    if (!walkVertices || walkVertices.length < 3) return;
    const ring: [number, number][] = [...walkVertices, walkVertices[0]];
    const geo: GeoJSON.Polygon = { type: 'Polygon', coordinates: [ring] };
    const acres = turfArea({ type: 'Feature', geometry: geo, properties: {} }) / 4046.8564224;
    setNewBoundary(geo);
    setNewAcreage(acres.toFixed(2));
    setShowNewForm(true);
    setWalkVertices(null);
  };

  const cancelWalk = () => {
    setWalkVertices(null);
    setGpsError(null);
  };

  // Tap → fly to saved home; long-press → save current view as home
  const homePressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const homeLongFired = useRef(false);

  const handleHomePointerDown = () => {
    homeLongFired.current = false;
    homePressTimer.current = setTimeout(() => {
      homeLongFired.current = true;
      const map = mapRef.current;
      if (!map) return;
      const c = map.getCenter();
      saveHomeLocation([c.lng, c.lat], map.getZoom());
      setHomeSaved(true);
      setTimeout(() => setHomeSaved(false), 2000);
    }, 600);
  };

  const handleHomePointerUp = () => {
    if (homePressTimer.current) clearTimeout(homePressTimer.current);
    if (homeLongFired.current) return; // already saved
    // Short tap → fly to saved home
    const map = mapRef.current;
    if (!map) return;
    const home = loadHomeLocation();
    map.flyTo({ center: home.center, zoom: home.zoom, duration: 1000 });
  };

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!value.trim()) { setSearchResults([]); setShowSearchResults(false); return; }
    searchTimeoutRef.current = setTimeout(async () => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?access_token=${token}&country=US&types=address,place,region,postcode,locality&proximity=-92.3938,36.9228&limit=5`
      );
      const data = await res.json();
      setSearchResults((data.features ?? []).map((f: { id: string; place_name: string; center: [number, number] }) => ({
        id: f.id, place_name: f.place_name, center: f.center,
      })));
      setShowSearchResults(true);
    }, 350);
  };

  const flyToResult = (result: { center: [number, number]; place_name: string }) => {
    mapRef.current?.flyTo({ center: result.center, zoom: 15, duration: 1200 });
    setSearchQuery(result.place_name); setSearchResults([]); setShowSearchResults(false);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Search — collapsed magnifying-glass FAB, expands on tap. Respects landscape notch. */}
      <div
        className="absolute top-4 z-[1000]"
        style={{ left: 'calc(0.625rem + env(safe-area-inset-left))' }}
      >
        {!searchExpanded ? (
          <button
            onClick={() => {
              setSearchExpanded(true);
              setTimeout(() => searchInputRef.current?.focus(), 30);
            }}
            aria-label="Search"
            title="Search"
            className="w-[30px] h-[30px] flex items-center justify-center bg-white hover:bg-gray-100 text-gray-700 rounded shadow transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          <div
            style={{
              width: 'min(calc(100vw - 5.25rem - env(safe-area-inset-left) - env(safe-area-inset-right)), 22rem)',
            }}
          >
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none"
                fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
              </svg>
              <input ref={searchInputRef} type="text" placeholder="Search address or place..."
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                className="w-full pl-9 pr-9 py-2.5 text-sm bg-black/60 backdrop-blur-md text-white placeholder-white/40 border border-white/10 rounded-lg shadow-2xl focus:outline-none focus:border-white/25 focus:bg-black/70 transition-all duration-150"
              />
              <button
                onClick={() => {
                  setSearchExpanded(false);
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchResults(false);
                }}
                aria-label="Close search"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-white/50 hover:text-white/90 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {showSearchResults && searchResults.length > 0 && (
              <ul className="mt-1 bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl overflow-hidden">
                {searchResults.map((r) => (
                  <li key={r.id} onClick={() => flyToResult(r)}
                    className="px-3 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/[0.08] cursor-pointer border-b border-white/5 last:border-0 truncate transition-colors duration-100">
                    {r.place_name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Pin Home button — bottom-left, above Mapbox geolocate control */}
      <div
        className="absolute bottom-20 z-[1000]"
        style={{ left: 'calc(0.625rem + env(safe-area-inset-left))' }}
      >
        <button
          onPointerDown={handleHomePointerDown}
          onPointerUp={handleHomePointerUp}
          onPointerCancel={() => homePressTimer.current && clearTimeout(homePressTimer.current)}
          title="Tap: go home · Hold: save this view as home"
          className={`w-[30px] h-[30px] flex items-center justify-center rounded shadow transition-all duration-150 select-none ${
            homeSaved
              ? 'bg-amber-500 border-amber-400 text-zinc-900'
              : 'bg-white text-gray-600 hover:text-black hover:bg-gray-100'
          }`}>
          {homeSaved ? (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="9,22 9,12 15,12 15,22" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>

      {/* GPS error toast — surfaces geolocate permission/timeout failures */}
      {gpsError && !walkVertices && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1500] w-[min(92vw,22rem)]">
          <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/15 backdrop-blur-md border border-red-500/40 rounded-lg shadow-xl">
            <svg className="w-4 h-4 text-red-300 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="flex-1 text-xs text-red-200 leading-snug">{gpsError}</div>
            <button onClick={() => setGpsError(null)} className="text-red-300/60 hover:text-red-300 flex-shrink-0" aria-label="Dismiss">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Right-edge button stack: map style toggle (top) + tools (bottom). Respects landscape notch. */}
      {!walkVertices && !showNewForm && !measuring && (
        <div
          className="absolute bottom-20 z-[1000] flex flex-col gap-2"
          style={{ right: 'calc(0.625rem + env(safe-area-inset-right))' }}
        >
          <button onClick={() => setStylePickerOpen(true)}
            title={`Map style: ${MAP_STYLES[mapStyle].label}`}
            aria-label="Change map style"
            className="w-[30px] h-[30px] flex items-center justify-center bg-white hover:bg-gray-100 text-gray-700 rounded shadow transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <polygon points="12,2 22,8 12,14 2,8" strokeLinejoin="round" />
              <polyline points="2,12 12,18 22,12" strokeLinejoin="round" strokeLinecap="round" />
              <polyline points="2,16 12,22 22,16" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          </button>
          <button onClick={() => setToolsOpen(true)}
            title="Tools"
            aria-label="Open tools"
            className="w-[30px] h-[30px] flex items-center justify-center bg-amber-500 hover:bg-amber-400 text-zinc-900 rounded shadow transition-colors duration-150">
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path d="M14.7 6.3a4 4 0 11-5 5L4 17v3h3l5.7-5.7a4 4 0 01-.3-5z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* Map style picker sheet */}
      {stylePickerOpen && (
        <>
          <div className="fixed inset-0 z-[1900] bg-black/50 backdrop-blur-sm" onClick={() => setStylePickerOpen(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-[2000] bg-zinc-900/98 backdrop-blur-md border-t border-white/10 rounded-t-2xl shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="flex items-center justify-between px-5 pt-2 pb-4">
              <h2 className="text-lg font-semibold text-white">Map Style</h2>
              <button onClick={() => setStylePickerOpen(false)}
                className="text-white/30 hover:text-white/60 transition-colors" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="px-5 pb-6 flex flex-col gap-2">
              {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((key) => {
                const isActive = mapStyle === key;
                return (
                  <button key={key} onClick={() => changeMapStyle(key)}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                        : 'bg-white/[0.06] hover:bg-white/[0.10] text-white/80 border border-white/10'
                    }`}>
                    <span>{MAP_STYLES[key].label}</span>
                    {isActive && (
                      <svg className="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Measure in-progress banner */}
      {measuring && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1500] w-[min(92vw,22rem)]">
          <div className="flex items-center gap-3 px-3 py-2.5 bg-zinc-900/95 backdrop-blur-md border border-amber-400/30 rounded-lg shadow-xl">
            <div className="flex-1 text-xs text-white/80 leading-snug">Tap two points on the map to measure.</div>
            <button onClick={cancelMeasure}
              className="px-2 py-1 text-xs font-medium text-white/60 hover:text-white/90 bg-white/[0.08] hover:bg-white/[0.14] rounded">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Measure result toast */}
      {measureResult && !measuring && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1500] w-[min(92vw,22rem)]">
          <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-500/15 backdrop-blur-md border border-amber-400/40 rounded-lg shadow-xl">
            <svg className="w-4 h-4 text-amber-300 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M3 12h18M7 8v8M11 6v12M15 8v8M19 10v4" strokeLinecap="round"/>
            </svg>
            <div className="flex-1 text-sm font-semibold text-amber-100">{measureResult}</div>
            <button onClick={() => setMeasureResult(null)} className="text-amber-200/60 hover:text-amber-100 flex-shrink-0" aria-label="Dismiss">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Tools bottom sheet */}
      {toolsOpen && (
        <>
          <div className="fixed inset-0 z-[1900] bg-black/50 backdrop-blur-sm" onClick={() => setToolsOpen(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-[2000] bg-zinc-900/98 backdrop-blur-md border-t border-white/10 rounded-t-2xl shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="flex items-center justify-between px-5 pt-2 pb-4">
              <h2 className="text-lg font-semibold text-white">Tools</h2>
              <button onClick={() => setToolsOpen(false)}
                className="text-white/30 hover:text-white/60 transition-colors" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3 px-5 pb-6">
              <ToolTile label="Walk Paddock" onClick={startWalkMode} icon={
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg>
              } />
              <ToolTile label="Draw Area" onClick={startDrawArea} icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
                  <path d="M4 5l8-3 8 5-4 13-10-2z"/><circle cx="4" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="2" r="1.5" fill="currentColor" stroke="none"/><circle cx="20" cy="7" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="20" r="1.5" fill="currentColor" stroke="none"/><circle cx="6" cy="18" r="1.5" fill="currentColor" stroke="none"/>
                </svg>
              } />
              <ToolTile label="Drop Pin" onClick={dropPinAtGps} icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="currentColor" stroke="none"/>
                </svg>
              } />
              <ToolTile label="Measure" onClick={startMeasure} icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12h18M7 8v8M11 6v12M15 8v8M19 10v4"/>
                </svg>
              } />
            </div>
            {userPins.length > 0 && (
              <div className="px-5 pb-5 -mt-2">
                <button onClick={clearUserPins}
                  className="w-full px-3 py-2 text-xs font-medium bg-white/[0.06] hover:bg-white/[0.10] text-white/60 hover:text-white/80 border border-white/10 rounded-lg transition-all">
                  Clear {userPins.length} dropped pin{userPins.length === 1 ? '' : 's'}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Walk Mode control panel — bottom-center, visible while walking */}
      {walkVertices && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1500] w-[min(92vw,22rem)] bg-zinc-900/95 backdrop-blur-md border border-amber-400/30 rounded-xl shadow-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-amber-400/90 font-semibold">Walk Mode</div>
              <div className="text-xs text-white/50 mt-0.5">
                {walkVertices.length === 0 && 'Stand at a corner, then tap Drop Corner'}
                {walkVertices.length === 1 && '1 corner — walk to the next'}
                {walkVertices.length === 2 && '2 corners — need at least 3'}
                {walkVertices.length >= 3 && `${walkVertices.length} corners — tap Finish when done`}
              </div>
            </div>
            <button onClick={undoCorner} disabled={walkVertices.length === 0}
              title="Remove last corner"
              className="text-white/40 hover:text-white/80 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M3 7v6h6M3 13c0-5 4-9 9-9a9 9 0 019 9 9 9 0 01-9 9" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          {gpsError && (
            <div className="mb-2 px-2 py-1.5 text-xs text-red-300 bg-red-500/15 border border-red-500/30 rounded">
              {gpsError}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={dropCorner} disabled={dropping}
              className="flex-1 px-3 py-2.5 text-sm font-semibold bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-zinc-900 rounded-lg transition-colors duration-150">
              {dropping ? 'Getting GPS…' : 'Drop Corner'}
            </button>
            <button onClick={finishWalk} disabled={walkVertices.length < 3}
              className="px-3 py-2.5 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/[0.06] disabled:text-white/30 text-zinc-900 rounded-lg transition-colors duration-150">
              Finish
            </button>
            <button onClick={cancelWalk}
              className="px-3 py-2.5 text-sm font-medium bg-white/[0.08] hover:bg-white/[0.14] text-white/60 hover:text-white/80 border border-white/10 rounded-lg transition-all duration-150">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* New paddock form */}
      {showNewForm && (
        <div
          className="absolute top-4 z-[1000] w-72 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-5"
          style={{ left: 'calc(4rem + env(safe-area-inset-left))' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white/90 tracking-wide uppercase">New Paddock</h3>
            <button onClick={() => { setShowNewForm(false); setNewBoundary(null); }}
              className="text-white/30 hover:text-white/60 transition-colors" aria-label="Close">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="mb-3">
            <label className="block text-xs text-white/40 mb-1 font-medium">Name</label>
            <input type="text" placeholder="e.g. North Pasture" value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white/[0.08] border border-white/10 text-white placeholder-white/25 rounded-lg focus:outline-none focus:border-white/25 focus:bg-white/10 transition-all duration-150" />
          </div>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-white/40 font-medium">Acreage</label>
              {newAcreage && <span className="text-xs text-amber-400/80 font-medium">auto-calculated</span>}
            </div>
            <input type="number" placeholder="0.0" value={newAcreage}
              onChange={(e) => setNewAcreage(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white/[0.08] border border-white/10 text-white placeholder-white/25 rounded-lg focus:outline-none focus:border-white/25 focus:bg-white/10 transition-all duration-150" />
          </div>
          <div className="flex gap-2">
            <button onClick={saveNewPaddock}
              className="flex-1 px-3 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 text-zinc-900 rounded-lg transition-colors duration-150">
              Save Paddock
            </button>
            <button onClick={() => { setShowNewForm(false); setNewBoundary(null); }}
              className="px-3 py-2 text-sm font-medium bg-white/[0.08] hover:bg-white/[0.12] text-white/60 hover:text-white/80 border border-white/10 rounded-lg transition-all duration-150">
              Cancel
            </button>
          </div>
        </div>
      )}

      {selectedPaddock && (
        <PaddockPanel
          paddock={selectedPaddock}
          herd={herds.find((h) => h.current_paddock_id === selectedPaddock.id) || null}
          session={sessions.find((s) => s.paddock_id === selectedPaddock.id && s.status === 'active') || null}
          onClose={() => setSelectedPaddock(null)}
          onSplit={() => setSplitTarget(selectedPaddock)}
        />
      )}

      {splitTarget && !splitting && (
        <SplitPaddockModal paddock={splitTarget} onConfirm={handleSplitConfirm} onClose={() => setSplitTarget(null)} />
      )}

      {splitting && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-white/10 rounded-xl px-6 py-4 flex items-center gap-3 shadow-2xl">
            <svg className="w-5 h-5 text-emerald-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            <span className="text-sm text-white/80">Splitting paddock…</span>
          </div>
        </div>
      )}
    </div>
  );
}
