'use client'
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [accountName, setAccountName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      // Find the email attached to this username for login
      const { data, error: profileErr } = await supabase.from('profiles').select('name').eq('username', username).single();
      
      if (profileErr || !data) {
        alert("❌ Username not found! Please check your spelling.");
        setLoading(false); return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email: data.name, password });
      if (error) alert("❌ " + error.message);
      else router.push('/');

    } else {
      // Strong Password Validation
      if (password.length < 8 || !/\d/.test(password) || !/[!@#$%^&*]/.test(password)) {
        alert("❌ Password must be at least 8 characters, contain 1 number, and 1 special character (!@#$%).");
        setLoading(false); return;
      }

      // Sign up process
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { username: username, account_name: accountName, phone: phone } } 
      });
      
      if (error) alert("❌ " + error.message);
      else {
        alert("✅ Account created successfully! Please log in with your new username and password.");
        setIsLogin(true);
      }
    }
    setLoading(false);
  };

  const inputClass = "w-full border border-gray-300 p-3.5 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-500 outline-none transition-all shadow-inner text-black font-semibold";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 text-black p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-200">
        <div className="text-center mb-8">
          <div className="w-28 h-28 bg-gray-50 rounded-full mx-auto mb-4 border-4 border-green-600 shadow-md flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
          </div>
          <h2 className="text-3xl font-black text-green-900">Ah Wei 33 Durian</h2>
          <p className="text-gray-500 font-bold mt-2 uppercase tracking-wide text-sm">{isLogin ? 'Secure System Login' : 'Register New Account'}</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Full Name</label>
                <input type="text" required value={accountName} onChange={(e) => setAccountName(e.target.value)} className={inputClass} placeholder="Ah Wei" />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Phone Number</label>
                <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="012-3456789" />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Email Address</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="ahwei@example.com" />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Username</label>
            <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} placeholder="ahwei_admin" />
          </div>
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
          </div>

          <button disabled={loading} type="submit" className="w-full bg-green-600 text-white font-extrabold py-4 rounded-xl hover:bg-green-700 shadow-md transition-all active:scale-[0.98] text-lg mt-4">
            {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Create Account')}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-gray-200 pt-4">
          <button onClick={() => setIsLogin(!isLogin)} className="text-sm font-bold text-gray-600 hover:text-green-700 transition-colors">
            {isLogin ? "Need an account? Sign Up Here" : "Already have an account? Log In"}
          </button>
        </div>
      </div>
    </div>
  );
}