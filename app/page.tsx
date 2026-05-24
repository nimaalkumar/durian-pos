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
    <div className="flex flex-col items-center justify-center p-4 mt-4 text-black">
      
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-1 tracking-tight">
          Welcome, <span className="text-green-700">{accountName}</span>
        </h1>
        <p className="text-lg text-gray-500 font-bold uppercase tracking-widest">AH WEI 33 DURIAN</p>
      </div>

      {/* CHANGED: grid-cols-1 for phones, md:grid-cols-3 for iPad/Laptop */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-5xl">
        
        <Link href="/pos" className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 flex flex-col items-center justify-center hover:scale-105 hover:shadow-xl hover:border-green-300 transition-all group">
          <span className="text-5xl mb-2 group-hover:animate-bounce">🛒</span>
          <h2 className="text-xl font-extrabold text-gray-800">Cashier POS</h2>
        </Link>

        {role === 'super_admin' && (
          <>
            <Link href="/admin" className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 flex flex-col items-center justify-center hover:scale-105 hover:shadow-xl hover:border-green-300 transition-all group">
              <span className="text-5xl mb-2 group-hover:animate-bounce">📦</span>
              <h2 className="text-xl font-extrabold text-gray-800">Admin</h2>
            </Link>

            <Link href="/reports" className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 flex flex-col items-center justify-center hover:scale-105 hover:shadow-xl hover:border-green-300 transition-all group">
              <span className="text-5xl mb-2 group-hover:animate-bounce">📊</span>
              <h2 className="text-xl font-extrabold text-gray-800">Reports</h2>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}