/**
 * useContacts Hook
 * Manages contact state and operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactService } from '@/services';
import type { Contact, CreateContactDTO, ContactType } from '@/types';
import { handleError } from '@/utils/errorHandler';
import { toast } from 'sonner';

export function useContacts() {
  const queryClient = useQueryClient();

  // Fetch all contacts
  const {
    data: contacts = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactService.getAll(),
    staleTime: 60000, // 1 minute
  });

  // Create contact
  const createMutation = useMutation({
    mutationFn: (contact: CreateContactDTO) => contactService.create(contact),
    onSuccess: (newContact) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(`Contact "${newContact.name}" added successfully`);
    },
    onError: (error) => handleError(error, 'Create Contact'),
  });

  // Update contact
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Contact> }) =>
      contactService.update(id, updates),
    onSuccess: (updatedContact) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(`Contact "${updatedContact.name}" updated successfully`);
    },
    onError: (error) => handleError(error, 'Update Contact'),
  });

  // Delete contact
  const deleteMutation = useMutation({
    mutationFn: (contactId: string) => contactService.delete(contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact deleted successfully');
    },
    onError: (error) => handleError(error, 'Delete Contact'),
  });

  // Bulk create contacts
  const bulkCreateMutation = useMutation({
    mutationFn: (contacts: CreateContactDTO[]) => contactService.bulkCreate(contacts),
    onSuccess: (newContacts) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(`${newContacts.length} contacts imported successfully`);
    },
    onError: (error) => handleError(error, 'Import Contacts'),
  });

  // Bulk delete contacts
  const bulkDeleteMutation = useMutation({
    mutationFn: (contactIds: string[]) => contactService.bulkDelete(contactIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Selected contacts deleted successfully');
    },
    onError: (error) => handleError(error, 'Delete Contacts'),
  });

  return {
    contacts,
    isLoading,
    error,
    refetch,
    createContact: createMutation.mutateAsync,
    updateContact: (id: string, updates: Partial<Contact>) =>
      updateMutation.mutateAsync({ id, updates }),
    deleteContact: deleteMutation.mutateAsync,
    bulkCreateContacts: bulkCreateMutation.mutateAsync,
    bulkDeleteContacts: bulkDeleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isBulkCreating: bulkCreateMutation.isPending,
    isBulkDeleting: bulkDeleteMutation.isPending,
  };
}
