export interface Ranch {
  id: string;
  name: string;
  owner_id: string | null;
  created_at: string;
}

export interface Paddock {
  id: string;
  ranch_id: string;
  name: string;
  acreage: number | null;
  boundary_geojson: GeoJSON.Geometry | null;
  parent_paddock_id: string | null;
  fence_type: 'permanent' | 'electric' | 'temporary' | 'none' | null;
  water_source: 'pond' | 'tank' | 'creek' | 'well' | 'trough' | 'none' | null;
  color: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Herd {
  id: string;
  ranch_id: string;
  name: string;
  head_count: number;
  avg_weight_lbs: number | null;
  herd_type: 'cow-calf' | 'stocker' | 'bull' | 'dry-cows' | 'heifers' | 'sheep' | 'goat' | 'other' | null;
  current_paddock_id: string | null;
  status: 'active' | 'suspended' | 'moved-out' | 'sold' | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  current_paddock?: Paddock;
}

export interface Animal {
  id: string;
  herd_id: string;
  tag_number: string | null;
  name: string | null;
  breed: string | null;
  sex: 'bull' | 'cow' | 'heifer' | 'steer' | 'calf' | null;
  birth_date: string | null;
  weight_lbs: number | null;
  dmi_percent: number | null;
  photo_url: string | null;
  notes: string | null;
  status: 'active' | 'culled' | 'sold' | 'deceased' | null;
  created_at: string;
  updated_at: string;
}

export interface GrazingSession {
  id: string;
  ranch_id: string;
  herd_id: string;
  paddock_id: string;
  move_in_date: string;
  planned_days: number | null;
  move_out_date: string | null;
  actual_days: number | null;
  status: 'active' | 'completed' | 'suspended' | null;
  suspended_date: string | null;
  notes: string | null;
  created_at: string;
  // joined
  herd?: Herd;
  paddock?: Paddock;
}

export interface MoveEvent {
  id: string;
  ranch_id: string;
  herd_id: string;
  from_paddock_id: string | null;
  to_paddock_id: string | null;
  head_count: number | null;
  event_type: 'move' | 'suspend' | 'resume' | 'graze-start' | 'graze-end' | null;
  event_date: string;
  notes: string | null;
  // joined
  herd?: Herd;
  from_paddock?: Paddock;
  to_paddock?: Paddock;
}

export interface WeightRecord {
  id: string;
  animal_id: string;
  weight_lbs: number;
  recorded_at: string;
  notes: string | null;
}
