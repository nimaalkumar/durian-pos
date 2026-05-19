'use client'
import Link from 'next/link'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter, usePathname } from 'next/navigation'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && pathname !== '/auth') router.push('/auth');
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') router.push('/auth');
      else if (session) checkUser();
    });

    return () => { authListener.subscription.unsubscribe(); };
  }, [pathname, router]);

  if (pathname === '/auth') {
    return <div className="bg-gray-100 min-h-screen font-sans">{children}</div>;
  }

  return (
    <>
      <nav className="bg-green-800 text-white shadow-xl sticky top-0 z-40 h-24 print:hidden flex items-center justify-center">
          <Link href="/" className="absolute left-1/2 -translate-x-1/2 top-4 z-50">
            <div className="w-24 h-24 bg-white rounded-full p-1.5 shadow-2xl border-4 border-green-500 overflow-hidden flex items-center justify-center hover:scale-105 transition-transform duration-300">
              <img src="/logo.png" alt="Ah Wei 33 Durian" className="w-full h-full object-cover rounded-full" onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/150/e2e8f0/166534?text=Logo' }} />
            </div>
          </Link>
      </nav>

      <main className="max-w-[1400px] mx-auto p-4 md:p-8 mt-4">{children}</main>
    </>
  )
}