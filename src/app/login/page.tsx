import { redirect } from 'next/navigation';
import LoginForm from './LoginForm';
import { createClient } from '@/lib/supabase/server';

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0e0f0f] px-6 py-12 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/90 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-400/80">PastureMap</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Sign in</h1>
          <p className="mt-2 text-sm text-white/50">Use a magic link to access your ranch data securely.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
