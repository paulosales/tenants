import React from 'react';
import { Building2, Edit2, Search, Trash2, UserCheck, UserX } from 'lucide-react';
import type { ManagedUser, Role, RoleDefinition, UserSummary } from '@tenants/shared-types';
import { ROLE_BY_KEY } from '../../constants/roles';

interface UsersTableProps {
  users: ManagedUser[];
  roles: RoleDefinition[];
  isLoading: boolean;
  isUpdating: boolean;
  currentUser?: UserSummary | null;
  searchTerm: string;
  roleFilter: Role | 'all';
  onSearchChange: (value: string) => void;
  onRoleFilterChange: (role: Role | 'all') => void;
  onQuickRoleChange: (userId: string, nextRole: Role) => void;
  onToggleActive: (user: ManagedUser) => void;
  onEditUser: (user: ManagedUser) => void;
  onRequestDelete: (user: ManagedUser) => void;
}

export const UsersTable: React.FC<UsersTableProps> = ({
  users,
  roles,
  isLoading,
  isUpdating,
  currentUser,
  searchTerm,
  roleFilter,
  onSearchChange,
  onRoleFilterChange,
  onQuickRoleChange,
  onToggleActive,
  onEditUser,
  onRequestDelete,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="search-users-input"
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search users by name or email..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          aria-label="Filter users by role"
          value={roleFilter}
          onChange={(e) => onRoleFilterChange(e.target.value as Role | 'all')}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
        >
          <option value="all">All Roles</option>
          {roles.map((r) => (
            <option key={r.role} value={r.role}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-sm text-slate-500">Loading user accounts...</div>
      ) : users.length === 0 ? (
        <div className="p-12 text-center text-sm text-slate-500">
          No user accounts matched your current search or filter.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-5">User Identity</th>
                <th className="py-3 px-5">Role Assignment</th>
                <th className="py-3 px-5">Property & Scope</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {users.map((u) => {
                const isSelf = currentUser?.id === u.id;
                const badgeStyle = ROLE_BY_KEY[u.role]?.badgeClass || 'bg-slate-100 text-slate-700';

                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">{u.full_name}</span>
                        {isSelf && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                      {u.phone && <div className="text-[11px] text-slate-400">{u.phone}</div>}
                    </td>

                    <td className="py-3.5 px-5">
                      <select
                        aria-label={`Assign role for ${u.full_name}`}
                        disabled={isSelf || isUpdating}
                        value={u.role}
                        onChange={(e) => onQuickRoleChange(u.id, e.target.value as Role)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer disabled:opacity-70 ${badgeStyle}`}
                      >
                        {roles.map((r) => (
                          <option key={r.role} value={r.role}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-3.5 px-5 text-xs text-slate-600">
                      <div className="flex items-center space-x-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{u.property_name || 'All Portfolio'}</span>
                      </div>
                      {u.unit_number && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Unit {u.unit_number}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-5">
                      <button
                        type="button"
                        disabled={isSelf || isUpdating}
                        onClick={() => onToggleActive(u)}
                        className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer disabled:opacity-60 ${
                          u.is_active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                        title={
                          isSelf ? 'Cannot deactivate your own account' : 'Toggle account status'
                        }
                      >
                        {u.is_active ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <UserX className="w-3.5 h-3.5" />
                            <span>Suspended</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center space-x-1.5">
                        <button
                          type="button"
                          aria-label={`Edit ${u.full_name}`}
                          onClick={() => onEditUser(u)}
                          className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {!isSelf && (
                          <button
                            type="button"
                            aria-label={`Delete ${u.full_name}`}
                            onClick={() => onRequestDelete(u)}
                            className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

