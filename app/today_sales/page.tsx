'use client'
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function TodaySalesPage() {
  const router = useRouter();
  const [sales, setSales] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>('cashier'); 
  
  const [editSale, setEditSale] = useState<any>(null);
  const [editTotal, setEditTotal] = useState('');
  const [editPayment, setEditPayment] = useState('');

  const [toast, setToast] = useState<{show: boolean, msg: string, type: 'error'|'success'}>({show: false, msg: '', type: 'success'});
  const showToast = (msg: string, type: 'error'|'success' = 'success') => {
    setToast({show: true, msg, type});
    setTimeout(() => setToast({show: false, msg: '', type: 'success'}), 4000);
  };

  const fetchTodaySales = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/auth');
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    if (profile?.role) setUserRole(profile.role);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('sales')
      .select('*')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });

    if (data) setSales(data);
  };

  useEffect(() => {
    fetchTodaySales();
  }, [router]);

  const handleDelete = async (id: string) => {
    if (userRole !== 'super_admin') return showToast("Unauthorized", "error");
    if (window.confirm("⚠️ WARNING: Are you sure you want to completely delete this sale? This cannot be undone.")) {
      const { error } = await supabase.from('sales').delete().eq('id', id);
      if (error) showToast(error.message, "error");
      else { showToast("✅ Sale deleted successfully!"); fetchTodaySales(); }
    }
  };

  const handleSaveEdit = async () => {
    if (userRole !== 'super_admin') return showToast("Unauthorized", "error");
    const { error } = await supabase.from('sales').update({ total_price: parseFloat(editTotal), payment_method: editPayment }).eq('id', editSale.id);
    if (error) showToast(error.message, "error");
    else { showToast("✅ Sale updated successfully!"); setEditSale(null); fetchTodaySales(); }
  };

  const totalToday = sales.reduce((sum, s) => sum + Number(s.total_price), 0);

  return (
    <div className="pb-10 bg-gray-100 min-h-screen text-black relative">
      
      {/* 🟢 STICKY GREEN NAVIGATION BAR (SVG ICONS ONLY) */}
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

      {toast.show && (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] px-8 py-4 rounded-2xl shadow-2xl font-extrabold text-lg transition-all animate-bounce ${toast.type === 'error' ? 'bg-yellow-400 text-black' : 'bg-green-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-200 m-4 mt-8">
        <div>
          <h1 className="text-4xl font-black text-green-900 tracking-tight">Today's Sales Dashboard</h1>
          <p className="text-gray-500 font-bold mt-1">Live tracking of today's revenue</p>
        </div>
        <div className="bg-green-50 px-8 py-4 rounded-2xl border-2 border-green-200 shadow-sm text-center">
           <span className="block text-sm font-bold text-green-800 uppercase">Today's Total Revenue</span>
           <span className="text-4xl font-black text-green-700">RM {totalToday.toFixed(2)}</span>
        </div>
      </div>

      {/* MOBILE SCROLL WRAPPER */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-x-auto mx-4">
        <table className="w-full text-left min-w-[800px]">
          <thead>
            <tr className="bg-gray-100 border-b-4 border-gray-300">
              <th className="p-4 text-gray-700">Order No & Time</th>
              <th className="p-4 text-gray-700">Items Ordered</th>
              <th className="p-4 text-gray-700">Payment & Type</th>
              <th className="p-4 text-right text-gray-700">Total (RM)</th>
              {userRole === 'super_admin' && <th className="p-4 text-center text-gray-700 border-l-2 border-gray-200">Admin Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id} className="border-b border-gray-200 hover:bg-yellow-50 transition-colors">
                <td className="p-4">
                  <div className="font-black text-green-800">{sale.order_number || 'N/A'}</div>
                  <div className="text-sm font-bold text-gray-500">{new Date(sale.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="text-xs uppercase text-gray-400 mt-1">Cashier: {sale.cashier_name || 'System'}</div>
                </td>
                <td className="p-4 font-bold text-gray-800">
                  {sale.cart_items ? sale.cart_items.map((i:any, idx:number) => <div key={idx}>• {i.type} <span className="text-sm text-gray-500 font-medium ml-1">({Number(i.weight).toFixed(3)}kg)</span></div>) : `${sale.durian_type} (${Number(sale.weight_kg).toFixed(3)}kg)`}
                </td>
                <td className="p-4 font-bold text-gray-600 uppercase text-xs">
                  <div className="mb-1 text-green-800">{sale.order_type === 'eat_here' ? `Eat (Table ${sale.table_number})` : sale.order_type === 'pack' ? 'Pack' : 'Delivery'}</div>
                  <div>{sale.payment_method === 'cash' ? '💵 Cash' : '📱 QR'}</div>
                </td>
                <td className="p-4 text-right font-black text-xl text-green-700">
                  RM {sale.total_price.toFixed(2)}
                </td>
                
                {userRole === 'super_admin' && (
                  <td className="p-4 text-center border-l-2 border-gray-100 bg-gray-50/50">
                    <button onClick={() => { setEditSale(sale); setEditTotal(sale.total_price); setEditPayment(sale.payment_method); }} className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-bold hover:bg-yellow-400 mr-2 shadow-sm transition-colors">Edit</button>
                    <button onClick={() => handleDelete(sale.id)} className="bg-gray-200 text-gray-500 px-4 py-2 rounded-lg font-bold hover:bg-red-600 hover:text-white shadow-sm transition-colors">Delete</button>
                  </td>
                )}
              </tr>
            ))}
            {sales.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-500 font-bold text-lg bg-gray-50">No sales recorded today yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* EDIT MODAL (ADMIN ONLY) */}
      {editSale && userRole === 'super_admin' && (
        <div className="fixed inset-0 bg-gray-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 border-2 border-yellow-400">
            <h2 className="text-2xl font-black text-green-900 mb-6 border-b-2 border-gray-200 pb-2">✏️ Edit Sale: {editSale.order_number}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total Price (RM)</label>
                <input type="number" step="0.1" value={editTotal} onChange={(e) => setEditTotal(e.target.value)} className="w-full border-2 border-gray-300 p-3 rounded-xl font-black text-xl bg-gray-50 focus:ring-2 focus:ring-green-400 outline-none text-black" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Payment Method</label>
                <select value={editPayment} onChange={(e) => setEditPayment(e.target.value)} className="w-full border-2 border-gray-300 p-3 rounded-xl font-bold bg-gray-50 focus:ring-2 focus:ring-green-400 outline-none text-black">
                  <option value="cash">💵 Cash</option>
                  <option value="qr">📱 QR DuitNow</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button onClick={() => setEditSale(null)} className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl hover:bg-gray-300 transition-colors">Cancel</button>
              <button onClick={handleSaveEdit} className="flex-1 bg-green-600 text-white font-extrabold py-3 rounded-xl hover:bg-green-700 shadow-md transition-colors active:scale-95">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}