const PUBLIC_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
} as const;

function requirePublicEnv(name: keyof typeof PUBLIC_ENV) {
  const value = PUBLIC_ENV[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseEnv() {
  return {
    url: requirePublicEnv('NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, ''),
    anonKey: requirePublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  };
}
