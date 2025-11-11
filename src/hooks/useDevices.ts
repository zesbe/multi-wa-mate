/**
 * useDevices Hook
 * Manages device state and operations with automatic realtime updates
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deviceService } from '@/services';
import { supabase } from '@/integrations/supabase/client';
import type { Device, CreateDeviceDTO, UpdateDeviceDTO } from '@/types';
import { handleError } from '@/utils/errorHandler';
import { toast } from 'sonner';

export function useDevices() {
  const queryClient = useQueryClient();

  // Fetch devices
  const {
    data: devices = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['devices'],
    queryFn: () => deviceService.getAll(),
    staleTime: 30000, // 30 seconds
  });

  // Create device
  const createMutation = useMutation({
    mutationFn: (device: CreateDeviceDTO) => deviceService.create(device),
    onSuccess: (newDevice) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success(`Device "${newDevice.device_name}" created successfully`);
    },
    onError: (error) => handleError(error, 'Create Device'),
  });

  // Update device
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateDeviceDTO }) =>
      deviceService.update(id, updates),
    onSuccess: (updatedDevice) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success(`Device "${updatedDevice.device_name}" updated successfully`);
    },
    onError: (error) => handleError(error, 'Update Device'),
  });

  // Delete device
  const deleteMutation = useMutation({
    mutationFn: (deviceId: string) => deviceService.delete(deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Device deleted successfully');
    },
    onError: (error) => handleError(error, 'Delete Device'),
  });

  // Connect device
  const connectMutation = useMutation({
    mutationFn: (deviceId: string) => deviceService.connect(deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Connecting device...');
    },
    onError: (error) => handleError(error, 'Connect Device'),
  });

  // Disconnect device
  const disconnectMutation = useMutation({
    mutationFn: (deviceId: string) => deviceService.disconnect(deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Disconnecting device...');
    },
    onError: (error) => handleError(error, 'Disconnect Device'),
  });

  // Setup realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('devices-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
        },
        (payload) => {
          console.log('Device change detected:', payload);
          queryClient.invalidateQueries({ queryKey: ['devices'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    devices,
    isLoading,
    error,
    refetch,
    createDevice: createMutation.mutateAsync,
    updateDevice: (id: string, updates: UpdateDeviceDTO) =>
      updateMutation.mutateAsync({ id, updates }),
    deleteDevice: deleteMutation.mutateAsync,
    connectDevice: connectMutation.mutateAsync,
    disconnectDevice: disconnectMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
