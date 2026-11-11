import React from 'react';
import { PhoneCall, ShieldAlert } from 'lucide-react';
import type { PropertyWithStats, UserSummary } from '@tenants/shared-types';
import { useTenantPortal } from '../hooks/useTenantPortal';
import { AlertBanner } from './common/AlertBanner';
import { AmenitySchedulingPanel } from './tenant/AmenitySchedulingPanel';
import { BookedSessionsList } from './tenant/BookedSessionsList';
import { MaintenanceCallForm } from './tenant/MaintenanceCallForm';
import { MaintenanceTrackerList } from './tenant/MaintenanceTrackerList';
import { TenantPortalHeader } from './tenant/TenantPortalHeader';

export {
  formatLocalSessionDate,
  formatLocalSessionTimeWindow,
  formatUtcTimeWindow,
  getLocalTimeZoneLabel,
} from '../utils/dateTime';

interface TenantViewProps {
  properties?: PropertyWithStats[];
  selectedPropertyId?: string | null;
  initialTenantId?: string | null;
  currentUser?: UserSummary | null;
  onBackToAdmin?: () => void;
}

export const TenantView: React.FC<TenantViewProps> = ({
  properties = [],
  selectedPropertyId,
  initialTenantId,
  currentUser,
  onBackToAdmin,
}) => {
  const portal = useTenantPortal({ properties, selectedPropertyId, initialTenantId, currentUser });

  return (
    <div className="space-y-6">
      <TenantPortalHeader
        activeTenant={portal.activeTenant}
        tenantsList={portal.tenantsList}
        activeTenantId={portal.activeTenantId}
        onChangeActiveTenant={(val) => {
          portal.setActiveTenantId(val);
          portal.setSessionSuccessMsg(null);
          portal.setMaintenanceSuccessMsg(null);
        }}
        onBackToAdmin={onBackToAdmin}
        activeFeature={portal.activeFeature}
        onChangeFeature={portal.setActiveFeature}
        amenitySubTab={portal.amenitySubTab}
        onChangeAmenitySubTab={portal.setAmenitySubTab}
        maintenanceSubTab={portal.maintenanceSubTab}
        onChangeMaintenanceSubTab={portal.setMaintenanceSubTab}
        activeSessionsCount={portal.activeSessionsCount}
        totalSessionsCount={portal.amenitySessions.length}
        activeMaintenanceCount={portal.activeMaintenanceCount}
        totalMaintenanceCount={portal.maintenanceCalls.length}
      />

      {portal.sessionSuccessMsg && (
        <AlertBanner
          variant="success"
          message={portal.sessionSuccessMsg}
          onDismiss={() => portal.setSessionSuccessMsg(null)}
        />
      )}

      {portal.maintenanceSuccessMsg && (
        <AlertBanner
          variant="success"
          message={portal.maintenanceSuccessMsg}
          onDismiss={() => portal.setMaintenanceSuccessMsg(null)}
        />
      )}

      {portal.actionError && (
        <AlertBanner
          variant="error"
          message={portal.actionError}
          onDismiss={() => portal.setActionError(null)}
        />
      )}

      {portal.activeFeature === 'amenities' && (
        <div className="space-y-6">
          {portal.amenitySubTab === 'schedule' ? (
            <AmenitySchedulingPanel
              amenities={portal.amenities}
              selectedAmenityId={portal.selectedAmenityId}
              currentAmenity={portal.currentAmenity}
              activeTenant={portal.activeTenant}
              todayLocalStr={portal.todayLocalStr}
              tomorrowStr={portal.tomorrowStr}
              isSubmittingBooking={portal.scheduleAmenityMutation.isPending}
              onSelectAmenity={(id) => {
                portal.setSelectedAmenityId(id);
                portal.setSessionSuccessMsg(null);
                portal.setActionError(null);
              }}
              onSubmitBooking={(data, onReset) => {
                portal.scheduleAmenityMutation.mutate(portal.buildAmenitySessionDto(data), {
                  onSuccess: () => onReset(),
                });
              }}
            />
          ) : (
            <BookedSessionsList
              sessions={portal.amenitySessions}
              isCancelling={portal.cancelSessionMutation.isPending}
              onCancelSession={(id) => portal.cancelSessionMutation.mutate(id)}
              onBrowseAmenities={() => portal.setAmenitySubTab('schedule')}
            />
          )}
        </div>
      )}

      {portal.activeFeature === 'maintenance' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-rose-900 via-rose-950 to-slate-900 rounded-3xl p-6 text-white shadow-lg border border-rose-800/80">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-600/30 border border-rose-400/40 flex items-center justify-center text-rose-300 shrink-0">
                  <ShieldAlert className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500 text-white">
                      Priority Response
                    </span>
                    <span className="text-xs text-rose-200">Building Emergency Services</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-0.5">Need Immediate Emergency Assistance?</h3>
                  <p className="text-xs text-rose-100/90 mt-1 max-w-xl">
                    For active water leaks, gas odors, electrical hazards, or winter heat outage, call dispatch
                    immediately. Technicians are stationed on-site 24/7.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <a
                  href="tel:+18005552739"
                  className="px-5 py-3 rounded-xl bg-white text-rose-900 hover:bg-rose-50 font-extrabold text-sm shadow-md flex items-center space-x-2 transition-all transform active:scale-95"
                >
                  <PhoneCall className="w-4 h-4 text-rose-600" />
                  <span>Call Hotline: +1 (800) 555-APEX</span>
                </a>
              </div>
            </div>
          </div>

          {portal.maintenanceSubTab === 'new-call' ? (
            <MaintenanceCallForm
              activeTenant={portal.activeTenant}
              isSubmittingCall={portal.createMaintenanceMutation.isPending}
              onCancel={() => portal.setMaintenanceSubTab('tracker')}
              onSubmitCall={(data, onReset) => {
                portal.createMaintenanceMutation.mutate(portal.buildMaintenanceCallDto(data), {
                  onSuccess: () => onReset(),
                });
              }}
            />
          ) : (
            <MaintenanceTrackerList
              calls={portal.maintenanceCalls}
              unitNumber={portal.activeTenant.unit_number ?? undefined}
              onPlaceNewCall={() => portal.setMaintenanceSubTab('new-call')}
              onResolveCall={(id) =>
                portal.updateMaintenanceStatusMutation.mutate({ id, status: 'resolved' })
              }
              onCancelCall={(id) => portal.cancelMaintenanceMutation.mutate(id)}
            />
          )}
        </div>
      )}
    </div>
  );
};
