'use server';

import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export type LoginState = { error: string | null };

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Enter your email and password.' };
  }

  const supabase = await createSupabaseServerClient();
  const signIn = await supabase.auth.signInWithPassword({ email, password });

  if (signIn.error) {
    return { error: 'Email or password is incorrect.' };
  }

  const admin = await supabase.rpc('is_app_admin');

  if (admin.error || !admin.data) {
    await supabase.auth.signOut({ scope: 'local' });
    return { error: 'This Planazo account does not have admin access.' };
  }

  redirect('/admin/feedback');
}
