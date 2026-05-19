'use client'
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function LoginModule() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleAuth = async () => {
    if (isRegistering) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) alert(error.message);
      else alert("Registration successful! You can now log in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
      else window.location.href = '/pos'; // Send to cashier after login
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <img src="/logo.png" className="w-24 h-24 rounded-full border-4 border-green-600 shadow-sm" onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/100/166534/ffffff?text=AW33' }} />
        </div>
        <h1 className="text-3xl font-extrabold text-center text-gray-900 mb-6">{isRegistering ? 'Register System' : 'System Login'}</h1>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-gray-300 p-3 rounded-xl text-black bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-gray-300 p-3 rounded-xl text-black bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none" />
          </div>
        </div>

        <button onClick={handleAuth} className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl hover:bg-green-700 shadow-md transition-all active:scale-95 text-lg">
          {isRegistering ? 'Create Account' : 'Log In'}
        </button>

        <p className="text-center mt-6 text-sm text-gray-500 font-medium">
          {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => setIsRegistering(!isRegistering)} className="text-green-600 font-bold hover:underline">
            {isRegistering ? 'Log in here' : 'Register here'}
          </button>
        </p>
      </div>
    </div>
  );
}