// app/page.tsx
'use client'
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function HomeDashboard() {
  const router = useRouter();
  const [role, setRole] = useState('cashier');
  const [accountName, setAccountName] = useState('User');

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/auth');
      
      const { data } = await supabase.from('profiles').select('role, account_name, username').eq('id', session.user.id).single();
      if (data) {
        setRole(data.role);
        setAccountName(data.account_name || data.username || 'User');
      }
    };
    fetchUser();
  }, [router]);

  return (
    // CHANGED: Added 'bg-gray-100' to the container and 'min-h-screen' to ensure it covers the whole page
    <div className="min-h-screen flex flex-col items-center justify-center text-black bg-gray-100 p-6">
      
      <div className="text-center mb-12 mt-8">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-2 tracking-tight">
          Welcome back, <span className="text-green-700">{accountName}</span>!
        </h1>
        <p className="text-xl text-gray-600 font-medium">Select a module to continue</p>
      </div>

      {/* Grid container remains the same, but buttons now sit on a light gray background */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        
        <Link href="/pos" className="bg-white p-10 rounded-3xl shadow-sm border border-gray-200 flex flex-col items-center justify-center hover:scale-105 hover:shadow-xl hover:border-green-300 transition-all duration-300 group">
          <span className="text-7xl mb-4 group-hover:animate-bounce">🛒</span>
          <h2 className="text-2xl font-extrabold text-gray-800">Cashier POS</h2>
          <p className="text-gray-500 mt-2 font-medium">Process orders & payments</p>
        </Link>

        <Link href="/profile" className="bg-white p-10 rounded-3xl shadow-sm border border-gray-200 flex flex-col items-center justify-center hover:scale-105 hover:shadow-xl hover:border-green-300 transition-all duration-300 group">
          <span className="text-7xl mb-4 group-hover:animate-bounce">👤</span>
          <h2 className="text-2xl font-extrabold text-gray-800">Account / Logout</h2>
          <p className="text-gray-500 mt-2 font-medium">Manage profile settings</p>
        </Link>

        {role === 'super_admin' && (
          <>
            <Link href="/admin" className="bg-white p-10 rounded-3xl shadow-sm border border-gray-200 flex flex-col items-center justify-center hover:scale-105 hover:shadow-xl hover:border-green-300 transition-all duration-300 group">
              <span className="text-7xl mb-4 group-hover:animate-bounce">📦</span>
              <h2 className="text-2xl font-extrabold text-gray-800">Inventory & Admin</h2>
              <p className="text-gray-500 mt-2 font-medium">Manage stock & expenses</p>
            </Link>

            <Link href="/reports" className="bg-white p-10 rounded-3xl shadow-sm border border-gray-200 flex flex-col items-center justify-center hover:scale-105 hover:shadow-xl hover:border-green-300 transition-all duration-300 group">
              <span className="text-7xl mb-4 group-hover:animate-bounce">📊</span>
              <h2 className="text-2xl font-extrabold text-gray-800">Business Reports</h2>
              <p className="text-gray-500 mt-2 font-medium">View sales & analytics</p>
            </Link>
          </>
        )}

      </div>
    </div>
  );
}