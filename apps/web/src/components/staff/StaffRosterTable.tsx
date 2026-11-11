import React from 'react';
import {
  AlertCircle,
  Building2,
  Clock,
  Edit2,
  Loader2,
  Mail,
  Phone,
  Trash2,
  UserCheck,
  Wrench,
} from 'lucide-react';
import type { PropertyStaff } from '@tenants/shared-types';
import { TablePagination } from '../TablePagination';
import { STAFF_ROLE_BADGES, STAFF_STATUS_BADGES } from './staffConstants';

interface StaffRosterTableProps {
  staff: PropertyStaff[];
  isLoading: boolean;
  error: unknown;
  currentPage: number;
  pageSize: number;
  totalRecords: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onEditStaff: (staff: PropertyStaff) => void;
  onDeleteStaff: (staff: PropertyStaff) => void;
  onAssignCall: (staff: PropertyStaff) => void;
}

export const StaffRosterTable: React.FC<StaffRosterTableProps> = ({
  staff,
  isLoading,
  error,
  currentPage,
  pageSize,
  totalRecords,
  onPageChange,
  onPageSizeChange,
  onEditStaff,
  onDeleteStaff,
  onAssignCall,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
          <p className="text-xs font-medium">Loading property personnel roster...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-600">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm font-semibold">Failed to load staff roster</p>
        </div>
      ) : staff.length === 0 ? (
        <div className="py-16 text-center text-slate-500">
          <UserCheck className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No staff members found</p>
          <p className="text-xs text-slate-400 mt-1">
            Try adjusting your role or property filters, or add a new personnel record.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Staff Member & Title</th>
                <th className="py-3 px-4">Role & Department</th>
                <th className="py-3 px-4">Assigned Property</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4">Shift & Schedule</th>
                <th className="py-3 px-4">Maintenance Workload</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((member) => {
                const roleBadge = STAFF_ROLE_BADGES[member.role] || STAFF_ROLE_BADGES.other;
                const RoleIcon = roleBadge.icon;
                const statusBadge = STAFF_STATUS_BADGES[member.status] || STAFF_STATUS_BADGES.active;
                const isMaintainer = member.role === 'maintainer';

                return (
                  <tr
                    key={member.id}
                    data-testid={`staff-row-${member.id}`}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">
                          {member.first_name[0]}
                          {member.last_name[0]}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">
                            {member.first_name} {member.last_name}
                          </div>
                          <div className="text-[11px] text-slate-500">{member.title}</div>
                          {member.specialization && (
                            <div className="text-[10px] text-indigo-600 font-medium">{member.specialization}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${roleBadge.bg}`}
                      >
                        <RoleIcon className="w-3 h-3" />
                        <span>{roleBadge.label}</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5 text-slate-700 font-medium">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[150px]">
                          {member.property_name || 'All Managed Properties'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 space-y-0.5">
                      <a
                        href={`tel:${member.phone}`}
                        className="flex items-center space-x-1.5 text-slate-700 hover:text-indigo-600 transition-colors"
                      >
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{member.phone}</span>
                      </a>
                      <a
                        href={`mailto:${member.email}`}
                        className="flex items-center space-x-1.5 text-slate-500 hover:text-indigo-600 transition-colors text-[11px]"
                      >
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span className="truncate max-w-[140px]">{member.email}</span>
                      </a>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex items-center space-x-1 text-[11px]">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{member.shift}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {isMaintainer ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                member.assigned_calls_count > 0
                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {member.assigned_calls_count}{' '}
                              {member.assigned_calls_count === 1 ? 'Active Ticket' : 'Active Tickets'}
                            </span>
                          </div>
                          <button
                            id={`assign-call-btn-${member.id}`}
                            onClick={() => onAssignCall(member)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-[11px] shadow-2xs transition-colors cursor-pointer"
                          >
                            <Wrench className="w-3 h-3" />
                            <span>Assign Call</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Not Applicable</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${statusBadge}`}
                      >
                        {member.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          id={`edit-staff-btn-${member.id}`}
                          onClick={() => onEditStaff(member)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit Staff Member"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`delete-staff-btn-${member.id}`}
                          onClick={() => onDeleteStaff(member)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Deactivate / Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <TablePagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalRecords={totalRecords}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
};

