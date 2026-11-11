import { useQuery } from '@tanstack/react-query';
import { useResidentDashboardService } from '../context/MobileServicesContext';

export function useResidentDashboard() {
  const dashboardService = useResidentDashboardService();

  return useQuery({
    queryKey: ['mobile-resident-dashboard'],
    queryFn: () => dashboardService.getDashboardSummary(),
  });
}

