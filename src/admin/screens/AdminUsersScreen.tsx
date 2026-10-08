import React, { useEffect, useState } from 'react';
import { Search, UserX, UserCheck, Eye, ShieldAlert, X } from 'lucide-react';
import { UserRecord } from '../types';

interface AdminUsersScreenProps {
  token: string;
}

export const AdminUsersScreen: React.FC<AdminUsersScreenProps> = ({ token }) => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [suspensionModalUser, setSuspensionModalUser] = useState<UserRecord | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [suspending, setSuspending] = useState(false);

  const getHeaders = () => ({
    Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
    'x-admin-key': token
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const url = search ? `/api/admin/users?query=${encodeURIComponent(search)}` : '/api/admin/users';
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Failed fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const fetchUserDetail = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSelectedUser(data);
      }
    } catch (err) {
      console.error('Failed user detail:', err);
    }
  };

  const handleStatusChange = async (newStatus: 'ACTIVE' | 'SUSPENDED') => {
    if (!suspensionModalUser || !suspensionReason) return;
    try {
      setSuspending(true);
      const res = await fetch(`/api/admin/users/${suspensionModalUser.id}/status`, {
        method: 'PATCH',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus, reason: suspensionReason })
      });

      if (res.ok) {
        setSuspensionModalUser(null);
        setSuspensionReason('');
        fetchUsers();
        if (selectedUser?.profile.id === suspensionModalUser.id) {
          fetchUserDetail(suspensionModalUser.id);
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Status update failed');
      }
    } catch (err) {
      alert('Failed updating user status');
    } finally {
      setSuspending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by name, phone, email or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Total Found: <span className="text-white font-bold">{users.length}</span>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Phone</th>
                <th className="p-4">Email</th>
                <th className="p-4">Status</th>
                <th className="p-4">Joined</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No users found matching query
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-900/40">
                    <td className="p-4 font-bold text-white">{u.name}</td>
                    <td className="p-4 font-mono text-slate-300">{u.phone}</td>
                    <td className="p-4 text-slate-400">{u.email || 'N/A'}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-slate-500 text-[11px]">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => fetchUserDetail(u.id)}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-600 text-slate-300 hover:text-white"
                        title="Investigate User Profile"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {u.status === 'ACTIVE' ? (
                        <button
                          onClick={() => setSuspensionModalUser(u)}
                          className="p-1.5 rounded-lg bg-rose-950/60 border border-rose-900 text-rose-400 hover:bg-rose-900"
                          title="Suspend User"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setSuspensionModalUser(u)}
                          className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-900 text-emerald-400 hover:bg-emerald-900"
                          title="Restore User"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Investigation Drawer / Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-end z-50">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full p-6 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div>
                <h3 className="text-base font-extrabold text-white">{selectedUser.profile.name}</h3>
                <p className="text-xs text-slate-400 font-mono">ID: {selectedUser.profile.id}</p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 text-xs">
              {/* Profile Details */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-500 font-semibold">Phone:</span>
                  <div className="text-white font-mono mt-0.5">{selectedUser.profile.phone}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Email:</span>
                  <div className="text-white mt-0.5">{selectedUser.profile.email || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Status:</span>
                  <div className="text-emerald-400 font-bold mt-0.5">{selectedUser.profile.status}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Joined:</span>
                  <div className="text-slate-300 font-mono mt-0.5">
                    {new Date(selectedUser.profile.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Related Splits */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  User Splits ({selectedUser.splits.length})
                </h4>
                <div className="bg-slate-950 rounded-xl border border-slate-800 divide-y divide-slate-800 max-h-40 overflow-y-auto">
                  {selectedUser.splits.map((s: any) => (
                    <div key={s.id} className="p-3 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-white">{s.title}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{s.ref_code}</div>
                      </div>
                      <div className="text-right font-mono font-bold text-indigo-400">
                        TZS {Number(s.total_amount).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Destinations */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Payment Destinations ({selectedUser.destinations.length})
                </h4>
                <div className="bg-slate-950 rounded-xl border border-slate-800 divide-y divide-slate-800 max-h-40 overflow-y-auto">
                  {selectedUser.destinations.map((d: any) => (
                    <div key={d.id} className="p-3 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-white">{d.beneficiary_name}</div>
                        <div className="text-[10px] text-slate-400">
                          {d.type} - {d.account_number} ({d.bank_code})
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase text-emerald-400">
                        {d.is_verified ? 'VERIFIED' : 'UNVERIFIED'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suspension Confirmation Modal */}
      {suspensionModalUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center space-x-3 text-amber-400">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-sm font-extrabold text-white">
                {suspensionModalUser.status === 'ACTIVE' ? 'Suspend Account' : 'Restore Account'}
              </h3>
            </div>

            <p className="text-xs text-slate-300">
              User: <span className="font-bold text-white">{suspensionModalUser.name}</span> ({suspensionModalUser.phone})
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">
                Reason for Status Change (Mandatory Audit Note)
              </label>
              <textarea
                required
                rows={3}
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                placeholder="State specific operational or security reason..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setSuspensionModalUser(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                disabled={suspending || !suspensionReason.trim()}
                onClick={() =>
                  handleStatusChange(suspensionModalUser.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')
                }
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white disabled:opacity-50"
              >
                {suspending ? 'Processing...' : 'Confirm Status Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
