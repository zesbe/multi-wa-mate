/**
 * Shared type definitions for the application
 * Replaces all 'any' types with proper TypeScript interfaces
 */

// ==================== ENUMS ====================

export type DeviceStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export type BroadcastStatus = 'draft' | 'processing' | 'completed' | 'failed';

export type ConnectionMethod = 'qr' | 'pairing';

export type DelayType = 'auto' | 'adaptive' | 'manual';

export type ContactType = 'individual' | 'group';

export type MessageType = 'text' | 'image' | 'video' | 'document' | 'audio';

export type ScheduleFrequency = 'once' | 'daily' | 'weekly' | 'monthly';

// ==================== CORE MODELS ====================

export interface Device {
  id: string;
  user_id: string;
  device_name: string;
  status: DeviceStatus;
  phone_number: string | null;
  qr_code: string | null;
  pairing_code: string | null;
  connection_method: ConnectionMethod;
  phone_for_pairing: string | null;
  api_key: string | null;
  session_data: unknown | null; // jsonb in database
  last_connected_at: string | null;
  created_at: string;
  updated_at: string;
  server_id: string | null;
  webhook_url: string | null;
  assigned_server_id: string | null;
  is_multidevice: boolean;
}

export interface SessionData {
  creds: {
    registered: boolean;
    [key: string]: unknown;
  };
  keys: {
    [key: string]: unknown;
  };
  saved_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  phone_number: string;
  name: string | null;
  device_id: string | null;
  is_group: boolean;
  group_members: unknown | null;
  var1: string | null;
  var2: string | null;
  var3: string | null;
  tags: string[] | null;
  notes: string | null;
  birthday: string | null;
  contact_count: number;
  last_contacted_at: string | null;
  reminders: unknown | null;
  created_at: string;
  updated_at: string;
}

export interface Broadcast {
  id: string;
  user_id: string;
  device_id: string;
  name: string;
  message: string;
  media_url: string | null;
  target_contacts: unknown; // jsonb in database
  status: BroadcastStatus;
  sent_count: number;
  failed_count: number;
  scheduled_at: string | null;
  delay_type: DelayType;
  delay_seconds: number;
  randomize_delay: boolean;
  batch_size: number;
  pause_between_batches: number;
  created_at: string;
  updated_at: string;
}

export interface ScheduledBroadcast extends Broadcast {
  schedule_frequency: ScheduleFrequency;
  schedule_end_date: string | null;
}

export interface AutoPost {
  id: string;
  user_id: string;
  device_id: string;
  name: string;
  message: string;
  media_url: string | null;
  target_contacts: unknown; // jsonb in database
  schedule_time: string;
  schedule_frequency: ScheduleFrequency;
  schedule_days: number[];
  is_active: boolean;
  last_sent_at: string | null;
  next_send_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CRMMessage {
  id: string;
  user_id: string;
  device_id: string;
  from_number: string;
  to_number: string;
  message_type: MessageType;
  message_content: string;
  media_url: string | null;
  is_from_me: boolean;
  timestamp: string;
  created_at: string;
}

export interface CRMConversation {
  contact_number: string;
  contact_name: string | null;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  is_from_me: boolean;
}

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface WhatsAppGroup {
  id: string;
  name: string;
  participants: number;
  desc: string;
  owner: string | null;
  creation: number | null;
}

// ==================== FORM TYPES ====================

export interface CreateDeviceDTO {
  device_name: string;
  connection_method: ConnectionMethod;
  phone_for_pairing?: string;
}

export interface UpdateDeviceDTO {
  device_name?: string;
  connection_method?: ConnectionMethod;
  phone_for_pairing?: string;
  status?: DeviceStatus;
}

export interface CreateBroadcastDTO {
  device_id: string;
  name: string;
  message: string;
  media_url?: string;
  target_contacts: string[];
  scheduled_at?: string;
  delay_type?: DelayType;
  delay_seconds?: number;
  randomize_delay?: boolean;
  batch_size?: number;
  pause_between_batches?: number;
}

export interface CreateContactDTO {
  phone_number: string;
  name: string;
  device_id?: string;
  is_group?: boolean;
  var1?: string;
  var2?: string;
  var3?: string;
  tags?: string[];
  notes?: string;
}

export interface CreateAutoPostDTO {
  device_id: string;
  name: string;
  message: string;
  media_url?: string;
  target_contacts: string[];
  schedule_time: string;
  schedule_frequency: ScheduleFrequency;
  schedule_days?: number[];
}

// ==================== COMPONENT PROPS ====================

export interface DeviceCardProps {
  device: Device;
  onEdit: (device: Device) => void;
  onDelete: (deviceId: string) => void;
  onToggleStatus: (device: Device) => void;
}

export interface BroadcastCardProps {
  broadcast: Broadcast;
  onEdit: (broadcast: Broadcast) => void;
  onDelete: (broadcastId: string) => void;
  onSend: (broadcastId: string) => void;
}

export interface ContactListProps {
  contacts: Contact[];
  selectedContacts: string[];
  onSelectContact: (phoneNumber: string) => void;
  onSelectAll: () => void;
  searchTerm?: string;
  filterType?: ContactType | 'all';
}

// ==================== API RESPONSE TYPES ====================

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GroupsApiResponse {
  success: boolean;
  groups: WhatsAppGroup[];
  total: number;
}

// ==================== UI STATE TYPES ====================

export interface DialogState {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'view';
  data?: unknown;
}

export interface FormState {
  isSubmitting: boolean;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
}

export interface NotificationState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

// ==================== UTILITY TYPES ====================

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

export type Nullable<T> = T | null;

export type AsyncResult<T> = Promise<ApiResponse<T>>;
