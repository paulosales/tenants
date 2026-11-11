import React from 'react';
import { Briefcase, ShieldAlert, Sparkles, UserCheck, Wrench } from 'lucide-react';

interface StaffKpis {
  total: number;
  managers: number;
  maintainersCount: number;
  activeDispatchedCalls: number;
  security: number;
  cleaners: number;
}

export const StaffKpiCards: React.FC<{ kpis: StaffKpis }> = ({ kpis }) => (
  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
    <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
      <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
        <span>Total Personnel</span>
        <UserCheck className="w-4 h-4 text-slate-400" />
      </div>
      <div className="mt-2 flex items-baseline space-x-2">
        <span className="text-2xl font-black text-slate-800">{kpis.total}</span>
        <span className="text-xs text-slate-400">across portfolio</span>
      </div>
    </div>

    <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
      <div className="flex items-center justify-between text-purple-700 text-xs font-medium">
        <span>Property Managers</span>
        <Briefcase className="w-4 h-4 text-purple-500" />
      </div>
      <div className="mt-2 flex items-baseline space-x-2">
        <span className="text-2xl font-black text-purple-900">{kpis.managers}</span>
        <span className="text-xs text-purple-500">directors & leads</span>
      </div>
    </div>

    <div className="bg-white p-4 rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/30 to-white shadow-2xs">
      <div className="flex items-center justify-between text-amber-700 text-xs font-medium">
        <span>Technical Maintainers</span>
        <Wrench className="w-4 h-4 text-amber-500" />
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-2xl font-black text-amber-900">{kpis.maintainersCount}</span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
          {kpis.activeDispatchedCalls} active calls
        </span>
      </div>
    </div>

    <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
      <div className="flex items-center justify-between text-sky-700 text-xs font-medium">
        <span>Security Personnel</span>
        <ShieldAlert className="w-4 h-4 text-sky-500" />
      </div>
      <div className="mt-2 flex items-baseline space-x-2">
        <span className="text-2xl font-black text-sky-900">{kpis.security}</span>
        <span className="text-xs text-sky-500">perimeter & safety</span>
      </div>
    </div>

    <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs col-span-2 lg:col-span-1">
      <div className="flex items-center justify-between text-emerald-700 text-xs font-medium">
        <span>Housekeeping & Cleaners</span>
        <Sparkles className="w-4 h-4 text-emerald-500" />
      </div>
      <div className="mt-2 flex items-baseline space-x-2">
        <span className="text-2xl font-black text-emerald-900">{kpis.cleaners}</span>
        <span className="text-xs text-emerald-500">sanitation crew</span>
      </div>
    </div>
  </div>
);

