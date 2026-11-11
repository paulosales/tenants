import React from 'react';
import { Check, Shield } from 'lucide-react';
import type { Role, RoleDefinition } from '@tenants/shared-types';

export const ROLE_BADGE_STYLES: Record<Role, string> = {
  super_admin: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  property_manager: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  maintenance_staff: 'bg-amber-100 text-amber-800 border-amber-200',
  staff: 'bg-sky-100 text-sky-800 border-sky-200',
  tenant: 'bg-purple-100 text-purple-800 border-purple-200',
};

interface RoleMatrixSectionProps {
  roles: RoleDefinition[];
  activeRoleFilter: Role | 'all';
  onSelectRoleFilter: (role: Role | 'all') => void;
}

export const RoleMatrixSection: React.FC<RoleMatrixSectionProps> = ({
  roles,
  activeRoleFilter,
  onSelectRoleFilter,
}) => {
  return (
    <section aria-label="Roles and Permissions Directory" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">System Roles & Permissions</h3>
          <p className="text-xs text-slate-500">
            Click a role card to filter user accounts assigned to that role.
          </p>
        </div>
        {activeRoleFilter !== 'all' && (
          <button
            type="button"
            onClick={() => onSelectRoleFilter('all')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
          >
            Show All Roles
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {roles.map((r) => {
          const isSelected = activeRoleFilter === r.role;
          return (
            <button
              key={r.role}
              type="button"
              onClick={() => onSelectRoleFilter(isSelected ? 'all' : r.role)}
              className={`text-left p-4 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer ${
                isSelected
                  ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                      ROLE_BADGE_STYLES[r.role] || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Shield className="w-3 h-3" />
                    <span>{r.label}</span>
                  </span>
                  <span className="text-sm font-extrabold text-slate-900">{r.user_count}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">{r.description}</p>
              </div>

              <ul className="space-y-1 pt-2 border-t border-slate-100">
                {r.permissions.slice(0, 3).map((perm) => (
                  <li key={perm} className="flex items-start space-x-1.5 text-[11px] text-slate-600">
                    <Check className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{perm}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </section>
  );
};

