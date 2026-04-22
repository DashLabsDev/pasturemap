import { cache } from 'react';
import { createClient } from './server';

export type RanchAccess = {
  ranchId: string;
  ranchName: string;
  role: 'owner' | 'member';
};

export const getAccessibleRanches = cache(async (): Promise<RanchAccess[]> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  const [{ data: owned }, { data: memberships }] = await Promise.all([
    supabase.from('ranches').select('id, name').eq('owner_id', user.id).order('name'),
    supabase.from('ranch_members').select('role, ranch:ranches!inner(id, name)').eq('user_id', user.id),
  ]);

  const byId = new Map<string, RanchAccess>();

  for (const ranch of owned ?? []) {
    byId.set(ranch.id, { ranchId: ranch.id, ranchName: ranch.name, role: 'owner' });
  }

  for (const membership of memberships ?? []) {
    const ranch = Array.isArray(membership.ranch) ? membership.ranch[0] : membership.ranch;
    if (!ranch) continue;
    if (!byId.has(ranch.id)) {
      byId.set(ranch.id, {
        ranchId: ranch.id,
        ranchName: ranch.name,
        role: membership.role === 'owner' ? 'owner' : 'member',
      });
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.ranchName.localeCompare(b.ranchName));
});

export const getActiveRanch = cache(async (): Promise<RanchAccess | null> => {
  const ranches = await getAccessibleRanches();
  return ranches[0] ?? null;
});
