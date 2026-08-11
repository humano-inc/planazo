import 'server-only';

import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export type AdminAccess =
  | { state: 'signed-out' }
  | { state: 'forbidden'; email: string | null }
  | {
      state: 'allowed';
      email: string | null;
      supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
    };

export async function getAdminAccess(): Promise<AdminAccess> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { state: 'signed-out' };
  }

  const admin = await supabase.rpc('is_app_admin');

  if (admin.error || !admin.data) {
    return { state: 'forbidden', email: data.user.email ?? null };
  }

  return {
    state: 'allowed',
    email: data.user.email ?? null,
    supabase,
  };
}

export async function requireAppAdmin() {
  const access = await getAdminAccess();

  if (access.state === 'signed-out') {
    redirect('/admin/login');
  }

  if (access.state === 'forbidden') {
    redirect('/admin/unauthorized');
  }

  return access;
}
