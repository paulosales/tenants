import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMobileAmenityService } from '../context/MobileServicesContext';

export function useMobileAmenityBooking() {
  const amenityService = useMobileAmenityService();
  const [selectedAmenity, setSelectedAmenity] = useState('Skyline Rooftop Lounge');
  const [selectedTime, setSelectedTime] = useState('16:00 - 18:00');
  const [isBooked, setIsBooked] = useState(false);

  const { data: amenities = [] } = useQuery({
    queryKey: ['mobile-amenities'],
    queryFn: () => amenityService.getAmenities(),
  });

  const { data: timeSlots = [] } = useQuery({
    queryKey: ['mobile-amenity-slots'],
    queryFn: () => amenityService.getAvailableTimeSlots(),
  });

  useEffect(() => {
    if (amenities.length > 0 && !amenities.some((a) => a.name === selectedAmenity)) {
      setSelectedAmenity(amenities[0].name);
    }
  }, [amenities, selectedAmenity]);

  useEffect(() => {
    if (timeSlots.length > 0 && !timeSlots.includes(selectedTime)) {
      setSelectedTime(timeSlots[0]);
    }
  }, [timeSlots, selectedTime]);

  const scheduleMutation = useMutation({
    mutationFn: () => amenityService.scheduleAmenitySession(selectedAmenity, selectedTime),
    onSuccess: () => {
      setIsBooked(true);
    },
  });

  const selectAmenity = (name: string) => {
    setSelectedAmenity(name);
    setIsBooked(false);
  };

  const selectTimeSlot = (slot: string) => {
    setSelectedTime(slot);
    setIsBooked(false);
  };

  const confirmBooking = () => {
    scheduleMutation.mutate();
  };

  return {
    amenities,
    timeSlots,
    selectedAmenity,
    selectedTime,
    isBooked,
    isBooking: scheduleMutation.isPending,
    selectAmenity,
    selectTimeSlot,
    confirmBooking,
  };
}

