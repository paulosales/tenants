import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateReservationRequest, Reservation } from '@tenants/shared-types';

interface OptimisticBookingContext {
  previousReservations: Reservation[] | undefined;
}

export function useOptimisticBooking(
  amenityId: string,
  createReservationFn: (req: CreateReservationRequest) => Promise<Reservation>,
  onSuccessCallback?: (data: Reservation) => void,
  onErrorCallback?: (err: any) => void
) {
  const queryClient = useQueryClient();
  const queryKey = ['reservations', amenityId];

  return useMutation<Reservation, Error, CreateReservationRequest, OptimisticBookingContext>({
    mutationFn: createReservationFn,
    onMutate: async (newBooking) => {
      // 1. Cancel ongoing queries for this key so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey });

      // 2. Snapshot the previous state for rollback
      const previousReservations = queryClient.getQueryData<Reservation[]>(queryKey);

      // 3. Optimistically insert temporary reservation
      const optimisticReservation: Reservation = {
        id: `temp-${Date.now()}`,
        amenity_id: newBooking.amenity_id,
        user_id: 'current-user',
        start_time: newBooking.start_time,
        end_time: newBooking.end_time,
        total_price_cents: 0,
        status: 'confirmed',
        notes: newBooking.notes,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<Reservation[]>(queryKey, (old) => [
        ...(old || []),
        optimisticReservation,
      ]);

      return { previousReservations };
    },
    onError: (err, _newBooking, context) => {
      // 4. Rollback to previous state on server conflict / 409
      if (context?.previousReservations) {
        queryClient.setQueryData(queryKey, context.previousReservations);
      }
      onErrorCallback?.(err);
    },
    onSuccess: (data) => {
      onSuccessCallback?.(data);
    },
    onSettled: () => {
      // 5. Refetch ground truth from server
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
