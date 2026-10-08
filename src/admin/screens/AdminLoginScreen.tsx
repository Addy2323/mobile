import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck, Key } from 'lucide-react';
import { AdminUser } from '../types';

interface AdminLoginScreenProps {
  onLoginSuccess: (token: string, admin: AdminUser) => void;
}

export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@lumo.co.tz');
  const [password, setPassword] = useState('LumoSuperAdmin2026!');
  const [adminKey, setAdminKey] = useState('');
  const [useAdminKeyMode, setUseAdminKeyMode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (useAdminKeyMode) {
        if (!adminKey.trim()) {
          setError('Master Admin Key required');
          setLoading(false);
          return;
        }

        // Test key with dashboard stats query
        const res = await fetch('/api/admin/dashboard-stats', {
          headers: { 'x-admin-key': adminKey }
        });

        if (res.ok) {
          const masterAdmin: AdminUser = {
            id: '00000000-0000-0000-0000-000000000001',
            email: 'master@lumo.co.tz',
            fullName: 'Master System Admin',
            role: 'SUPER_ADMIN',
            permissions: ['*']
          };
          onLoginSuccess(adminKey, masterAdmin);
        } else {
          setError('Invalid Master Admin Key');
        }
      } else {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Authentication failed');
        }

        onLoginSuccess(data.token, data.admin);
      }
    } catch (err: any) {
      setError(err.message || 'Login error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-white text-2xl shadow-lg shadow-indigo-600/30 mb-3">
            L
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">LUMO Ops Centre</h2>
          <p className="text-xs text-slate-400 mt-1">Authorized LUMO Staff & Operations Access</p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!useAdminKeyMode ? (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Staff Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    placeholder="staff@lumo.co.tz"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    placeholder="••••••••••••"
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Master Admin Key</label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  placeholder="Enter X-ADMIN-KEY"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white text-xs tracking-wide shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{loading ? 'Authenticating...' : 'Sign In to Operations'}</span>
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <button
            onClick={() => {
              setUseAdminKeyMode(!useAdminKeyMode);
              setError('');
            }}
            className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-all"
          >
            {useAdminKeyMode ? 'Use Staff Email & Password' : 'Use Master Admin Key (Dev Mode)'}
          </button>
        </div>
      </div>
    </div>
  );
};
