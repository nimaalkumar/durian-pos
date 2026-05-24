'use client'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Header from '../components/Header' // 👈 1. Import your new Header here!

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

  // If the user is on the Login page, DO NOT show the green header bar
  if (pathname === '/auth') {
    return <div className="bg-gray-100 min-h-screen font-sans">{children}</div>;
  }

  // 2. FOR EVERY OTHER PAGE, SHOW THE GREEN HEADER AT THE TOP!
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      <Header /> 
      
      {/* 3. Your specific page content (admin, cashier, home) loads inside this <main> tag */}
      <main className="w-full flex-1">
        {children} 
      </main>
    </div>
  )
}