// components/Header.tsx
'use client'
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function Header() {
  const router = useRouter();
  
  return (
    <div className="sticky top-0 z-[100] flex items-center justify-between bg-green-800 px-4 py-2 shadow-lg print:hidden w-full border-b-4 border-green-900 h-16">
      {/* Left Buttons */}
      <div className="flex gap-3">
        <button onClick={() => router.back()} title="Back" className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all shadow-sm active:scale-95">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <button onClick={() => window.location.reload()} title="Refresh" className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all shadow-sm active:scale-95">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
      </div>

      {/* Centered Logo */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
        <img src="/logo.png" alt="Logo" className="w-14 h-14 object-cover rounded-full border-2 border-white shadow-md bg-white" onError={(e) => { e.currentTarget.style.display = 'none' }} />
      </div>

      {/* Right Buttons */}
      <div className="flex gap-3">
        <button onClick={() => router.push('/profile')} title="Profile" className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all shadow-sm active:scale-95">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
        </button>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/auth'); }} title="Logout" className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all shadow-md active:scale-95">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        </button>
      </div>
    </div>
  );
}