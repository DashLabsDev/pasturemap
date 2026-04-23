import { cache } from 'react';
import { cookies } from 'next/headers';
import { createClient } from './server';
import type { RanchAccess } from '@/components/auth/RanchProvider';

export const ACTIVE_RANCH_COOKIE = 'active_ranch_id';

export type ActiveRanchState = {
  activeRanch: RanchAccess | null;
  cookieRanchId: string | null;
  shouldPersistCookie: boolean;
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

export const getActiveRanch = cache(async (): Promise<ActiveRanchState> => {
  const ranches = await getAccessibleRanches();
  const cookieStore = await cookies();
  const cookieRanchId = cookieStore.get(ACTIVE_RANCH_COOKIE)?.value ?? null;

  if (ranches.length === 0) {
    return {
      activeRanch: null,
      cookieRanchId,
      shouldPersistCookie: cookieRanchId !== null,
    };
  }

  const activeRanch = ranches.find((ranch) => ranch.ranchId === cookieRanchId) ?? ranches[0];

  return {
    activeRanch,
    cookieRanchId,
    shouldPersistCookie: cookieRanchId !== activeRanch.ranchId,
  };
});
