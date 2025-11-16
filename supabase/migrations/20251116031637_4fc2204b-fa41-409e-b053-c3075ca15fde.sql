-- Fix device deletion to preserve reusable data
-- Update delete_device_completely function to NOT delete:
-- 1. chatbot_rules (can be reused by other devices)
-- 2. webhooks (can be reused by other devices)
-- 3. broadcasts (important history)
-- 4. auto_post_schedules (deactivate instead of delete)
-- 5. message_history (keep as history)

CREATE OR REPLACE FUNCTION public.delete_device_completely(p_device_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_deleted_count INTEGER := 0;
BEGIN
  -- Verify device ownership
  SELECT user_id INTO v_user_id
  FROM devices
  WHERE id = p_device_id AND user_id = auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Device not found or unauthorized'
    );
  END IF;

  -- 1. Deactivate auto_post_schedules instead of deleting (preserve for reuse)
  UPDATE auto_post_schedules
  SET is_active = false,
      device_id = NULL,
      updated_at = now()
  WHERE device_id = p_device_id;

  -- 2. Delete message_queue (pending messages only)
  DELETE FROM message_queue WHERE device_id = p_device_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- 3. Delete WhatsApp conversations
  DELETE FROM whatsapp_conversations WHERE device_id = p_device_id;

  -- 4. Delete WhatsApp messages
  DELETE FROM whatsapp_messages WHERE device_id = p_device_id;

  -- 5. Delete device connection logs
  DELETE FROM device_connection_logs WHERE device_id = p_device_id;

  -- 6. Delete device health metrics
  DELETE FROM device_health_metrics WHERE device_id = p_device_id;

  -- 7. Delete device reconnect settings
  DELETE FROM device_reconnect_settings WHERE device_id = p_device_id;

  -- 8. Unlink contacts from this device (don't delete contacts)
  UPDATE contacts
  SET device_id = NULL,
      updated_at = now()
  WHERE device_id = p_device_id;

  -- 9. Clear sensitive device data
  UPDATE devices
  SET session_data = NULL,
      qr_code = NULL,
      pairing_code = NULL,
      api_key = NULL,
      status = 'deleted',
      updated_at = now()
  WHERE id = p_device_id;

  -- 10. Finally delete the device record
  DELETE FROM devices WHERE id = p_device_id;

  -- Log the cleanup
  INSERT INTO device_connection_logs (
    device_id,
    user_id,
    event_type,
    timestamp,
    details
  ) VALUES (
    p_device_id,
    v_user_id,
    'device_deleted',
    now(),
    jsonb_build_object(
      'deleted_by', 'user',
      'deleted_at', now()
    )
  ) ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Device deleted successfully',
    'preserved', jsonb_build_object(
      'chatbot_rules', 'preserved for reuse',
      'webhooks', 'preserved for reuse',
      'broadcasts', 'preserved as history',
      'auto_post_schedules', 'deactivated and preserved',
      'message_history', 'preserved as history',
      'contacts', 'unlinked but preserved'
    )
  );
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.delete_device_completely IS 'Safely deletes device while preserving reusable data (chatbot rules, webhooks, broadcasts history, auto post schedules, message history)';
