/**
 * useBroadcasts Hook
 * Manages broadcast state and operations with automatic realtime updates
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { broadcastService } from '@/services';
import { supabase } from '@/integrations/supabase/client';
import type { Broadcast, CreateBroadcastDTO } from '@/types';
import { handleError } from '@/utils/errorHandler';
import { toast } from 'sonner';

export function useBroadcasts() {
  const queryClient = useQueryClient();

  // Fetch broadcasts
  const {
    data: broadcasts = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['broadcasts'],
    queryFn: () => broadcastService.getAll(),
    staleTime: 30000,
  });

  // Create broadcast
  const createMutation = useMutation({
    mutationFn: (broadcast: CreateBroadcastDTO) => broadcastService.create(broadcast),
    onSuccess: (newBroadcast) => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success(`Broadcast "${newBroadcast.name}" created successfully`);
    },
    onError: (error) => handleError(error, 'Create Broadcast'),
  });

  // Update broadcast
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Broadcast> }) =>
      broadcastService.update(id, updates),
    onSuccess: (updatedBroadcast) => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success(`Broadcast "${updatedBroadcast.name}" updated successfully`);
    },
    onError: (error) => handleError(error, 'Update Broadcast'),
  });

  // Delete broadcast
  const deleteMutation = useMutation({
    mutationFn: (broadcastId: string) => broadcastService.delete(broadcastId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Broadcast deleted successfully');
    },
    onError: (error) => handleError(error, 'Delete Broadcast'),
  });

  // Send broadcast
  const sendMutation = useMutation({
    mutationFn: (broadcastId: string) => broadcastService.send(broadcastId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Broadcast queued for sending');
    },
    onError: (error) => handleError(error, 'Send Broadcast'),
  });

  // Cancel broadcast
  const cancelMutation = useMutation({
    mutationFn: (broadcastId: string) => broadcastService.cancel(broadcastId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Broadcast cancelled');
    },
    onError: (error) => handleError(error, 'Cancel Broadcast'),
  });

  // Setup realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('broadcasts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'broadcasts',
        },
        (payload) => {
          console.log('Broadcast change detected:', payload);
          queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    broadcasts,
    isLoading,
    error,
    refetch,
    createBroadcast: createMutation.mutateAsync,
    updateBroadcast: (id: string, updates: Partial<Broadcast>) =>
      updateMutation.mutateAsync({ id, updates }),
    deleteBroadcast: deleteMutation.mutateAsync,
    sendBroadcast: sendMutation.mutateAsync,
    cancelBroadcast: cancelMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSending: sendMutation.isPending,
  };
}
