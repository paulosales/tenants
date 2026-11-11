import React, { createContext, useContext } from 'react';
import type {
  IMobileAmenityService,
  IMobileParkingService,
  IMobileServices,
  IResidentDashboardService,
} from '../domain/services';
import { defaultMobileServices } from '../infrastructure/defaultMobileServices';

const MobileServicesContext = createContext<IMobileServices>(defaultMobileServices);

export const MobileServicesProvider: React.FC<{
  services?: IMobileServices;
  children: React.ReactNode;
}> = ({ services = defaultMobileServices, children }) => (
  <MobileServicesContext.Provider value={services}>{children}</MobileServicesContext.Provider>
);

export function useResidentDashboardService(): IResidentDashboardService {
  return useContext(MobileServicesContext).dashboard;
}

export function useMobileParkingService(): IMobileParkingService {
  return useContext(MobileServicesContext).parking;
}

export function useMobileAmenityService(): IMobileAmenityService {
  return useContext(MobileServicesContext).amenities;
}

