import { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMobileParkingService } from '../context/MobileServicesContext';

export function useMobileParkingMap() {
  const parkingService = useMobileParkingService();
  const [selectedSpotNumber, setSelectedSpotNumber] = useState<string>('P1-01');
  const [isReserved, setIsReserved] = useState(false);

  const { data: spots = [] } = useQuery({
    queryKey: ['mobile-parking-spots'],
    queryFn: () => parkingService.getGarageSpots(),
  });

  const reserveMutation = useMutation({
    mutationFn: (spotNumber: string) => parkingService.reserveSpot(spotNumber),
    onSuccess: () => {
      setIsReserved(true);
    },
  });

  const selectedSpot = useMemo(
    () => spots.find((s) => s.num === selectedSpotNumber) ?? spots[0],
    [spots, selectedSpotNumber]
  );

  const selectSpot = (spotNumber: string) => {
    setSelectedSpotNumber(spotNumber);
    setIsReserved(false);
  };

  const confirmReservation = () => {
    if (selectedSpotNumber) {
      reserveMutation.mutate(selectedSpotNumber);
    }
  };

  return {
    spots,
    selectedSpotNumber,
    selectedSpot,
    isReserved,
    isReserving: reserveMutation.isPending,
    selectSpot,
    confirmReservation,
  };
}

