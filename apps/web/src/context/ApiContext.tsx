import React, { createContext, useContext } from 'react';
import { createSegregatedGateways } from '../api/client';
import type {
  IAmenityGateway,
  IApiGateways,
  IApplicationGateway,
  IAuthGateway,
  IMaintenanceGateway,
  IMessageGateway,
  IParkingGateway,
  IPropertyGateway,
  IPublicPortalGateway,
  IReservationGateway,
  IStaffGateway,
  ITenantGateway,
  ITenantSessionGateway,
  IUnitGateway,
  IUserAdminGateway,
} from '../api/interfaces';

const defaultGateways = createSegregatedGateways();

const ApiContext = createContext<IApiGateways>(defaultGateways);

export const ApiProvider: React.FC<{
  gateways?: IApiGateways;
  children: React.ReactNode;
}> = ({ gateways = defaultGateways, children }) => (
  <ApiContext.Provider value={gateways}>{children}</ApiContext.Provider>
);

export function useAuthGateway(): IAuthGateway {
  return useContext(ApiContext).auth;
}

export function usePropertiesGateway(): IPropertyGateway {
  return useContext(ApiContext).properties;
}

export function useUnitsGateway(): IUnitGateway {
  return useContext(ApiContext).units;
}

export function useTenantsGateway(): ITenantGateway {
  return useContext(ApiContext).tenants;
}

export function useAmenitiesGateway(): IAmenityGateway {
  return useContext(ApiContext).amenities;
}

export function useParkingGateway(): IParkingGateway {
  return useContext(ApiContext).parking;
}

export function useReservationsGateway(): IReservationGateway {
  return useContext(ApiContext).reservations;
}

export function useMaintenanceGateway(): IMaintenanceGateway {
  return useContext(ApiContext).maintenance;
}

export function useStaffGateway(): IStaffGateway {
  return useContext(ApiContext).staff;
}

export function useTenantSessionsGateway(): ITenantSessionGateway {
  return useContext(ApiContext).tenantSessions;
}

export function usePublicPortalGateway(): IPublicPortalGateway {
  return useContext(ApiContext).publicPortal;
}

export function useApplicationsGateway(): IApplicationGateway {
  return useContext(ApiContext).applications;
}

export function useMessagesGateway(): IMessageGateway {
  return useContext(ApiContext).messages;
}

export function useUsersAdminGateway(): IUserAdminGateway {
  return useContext(ApiContext).users;
}

