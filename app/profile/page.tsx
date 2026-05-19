'use client'
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [accountName, setAccountName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [toast, setToast] = useState<{show: boolean, msg: string, type: 'error'|'success'}>({show: false, msg: '', type: 'success'});

  const showToast = (msg: string, type: 'error'|'success' = 'success') => {
    setToast({show: true, msg, type});
    setTimeout(() => setToast({show: false, msg: '', type: 'success'}), 4000);
  };

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/auth');
      setUser(session.user);
      
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (data) {
        setUsername(data.username || '');
        setAccountName(data.account_name || '');
        setEmail(data.name || session.user.email); 
      }
    };
    fetchProfile();
  }, [router]);

  const handleUpdate = async () => {
    // Password Validation
    if (newPassword) {
      if (newPassword.length < 6) return showToast("Password must be at least 6 characters long.", "error");
      if (!/\d/.test(newPassword)) return showToast("Password must contain at least 1 number.", "error");
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) return showToast("Password must contain at least 1 special character (e.g. @, !, #).", "error");
    }

    const { error: dbError } = await supabase.from('profiles').update({
      username: username, account_name: accountName, name: email
    }).eq('id', user.id);

    if (dbError) return showToast("Error updating profile: " + dbError.message, "error");

    const updates: any = { email: email };
    if (newPassword) updates.password = newPassword;
    
    const { error: authError } = await supabase.auth.updateUser(updates);
    if (authError) return showToast("Auth Update Error: " + authError.message, "error");

    showToast("Profile and password updated successfully!");
    setNewPassword('');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  const inputClass = "w-full border border-gray-300 p-4 rounded-xl text-black bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner font-bold";

  return (
    <div className="pb-10 text-black max-w-2xl mx-auto mt-8 relative">
      
      {/* CUSTOM POPUP NOTIFICATION */}
      {toast.show && (
        <div className={`fixed top-10 left-1/2 transform -translate-x-1/2 z-[100] px-8 py-4 rounded-2xl shadow-2xl text-white font-extrabold text-lg transition-all animate-bounce ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.type === 'error' ? '❌ ' : '✅ '} {toast.msg}
        </div>
      )}

      <div className="bg-white p-8 shadow-sm rounded-3xl border border-gray-200">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-6 border-b pb-4">👤 Edit Profile Settings</h1>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Account Name</label>
              <input type="text" value={accountName} onChange={e=>setAccountName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Username</label>
              <input type="text" value={username} onChange={e=>setUsername(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email Address</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className={inputClass} />
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Change Password</label>
            <input type="password" placeholder="Leave blank to keep current..." value={newPassword} onChange={e=>setNewPassword(e.target.value)} className={inputClass} />
            <p className="text-xs text-gray-500 font-semibold mt-2 ml-1">Must be 6+ chars, 1 number, 1 special character.</p>
          </div>

          <button onClick={handleUpdate} className="w-full bg-blue-600 text-white font-extrabold py-4 rounded-xl hover:bg-blue-700 shadow-md transition-all active:scale-[0.98] text-lg">
            Save Profile Changes
          </button>
        </div>

        <div className="mt-8 border-t pt-8">
          <button onClick={handleLogout} className="w-full bg-red-50 text-red-600 border-2 border-red-200 font-extrabold py-4 rounded-xl hover:bg-red-600 hover:text-white transition-colors text-lg shadow-sm">
            🚪 Secure Logout
          </button>
        </div>
      </div>
    </div>
  );
}