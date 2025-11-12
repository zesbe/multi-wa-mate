-- Add SET search_path to SECURITY DEFINER functions that are missing it
-- This prevents potential security issues from search_path manipulation

-- Fix log_audit function
CREATE OR REPLACE FUNCTION public.log_audit(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    admin_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values
  )
  VALUES (
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_values,
    p_new_values
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- Fix get_best_available_server function
CREATE OR REPLACE FUNCTION public.get_best_available_server()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_server_id UUID;
BEGIN
  -- Select server with lowest load, highest priority, and is healthy
  SELECT id INTO v_server_id
  FROM public.backend_servers
  WHERE is_active = true 
    AND is_healthy = true
    AND current_load < max_capacity
  ORDER BY 
    priority DESC,
    (current_load::float / NULLIF(max_capacity, 0)) ASC,
    response_time ASC
  LIMIT 1;
  
  RETURN v_server_id;
END;
$$;

-- Fix update_server_load function
CREATE OR REPLACE FUNCTION public.update_server_load()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Update current load when device is assigned
    IF NEW.assigned_server_id IS NOT NULL AND NEW.status = 'connected' THEN
      UPDATE public.backend_servers
      SET 
        current_load = (
          SELECT COUNT(*) 
          FROM public.devices 
          WHERE assigned_server_id = NEW.assigned_server_id 
            AND status = 'connected'
        ),
        updated_at = NOW()
      WHERE id = NEW.assigned_server_id;
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    -- Update current load when device is removed or status changed
    IF OLD.assigned_server_id IS NOT NULL THEN
      UPDATE public.backend_servers
      SET 
        current_load = (
          SELECT COUNT(*) 
          FROM public.devices 
          WHERE assigned_server_id = OLD.assigned_server_id 
            AND status = 'connected'
        ),
        updated_at = NOW()
      WHERE id = OLD.assigned_server_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fix reassign_devices_on_server_failure function
CREATE OR REPLACE FUNCTION public.reassign_devices_on_server_failure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_server_id UUID;
BEGIN
  -- If server becomes unhealthy or inactive
  IF (NEW.is_healthy = false OR NEW.is_active = false) 
     AND (OLD.is_healthy = true OR OLD.is_active = true) THEN
    
    -- Get best available server for each device
    FOR v_new_server_id IN 
      SELECT DISTINCT get_best_available_server()
      FROM public.devices 
      WHERE assigned_server_id = NEW.id
    LOOP
      -- Reassign devices to new server
      UPDATE public.devices
      SET 
        assigned_server_id = v_new_server_id,
        status = 'disconnected',
        updated_at = NOW()
      WHERE assigned_server_id = NEW.id;
      
      -- Log the reassignment
      INSERT INTO public.server_logs (server_id, log_type, message, details)
      VALUES (
        NEW.id,
        'warning',
        'Devices reassigned due to server failure',
        jsonb_build_object(
          'from_server', NEW.id,
          'to_server', v_new_server_id,
          'reason', CASE 
            WHEN NEW.is_healthy = false THEN 'unhealthy'
            WHEN NEW.is_active = false THEN 'inactive'
          END
        )
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix check_server_health function
CREATE OR REPLACE FUNCTION public.check_server_health(p_server_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_server RECORD;
BEGIN
  SELECT * INTO v_server
  FROM public.backend_servers
  WHERE id = p_server_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Server not found');
  END IF;
  
  -- This will be called from edge function to actually check health
  -- For now, just return server info
  v_result := jsonb_build_object(
    'server_id', v_server.id,
    'server_name', v_server.server_name,
    'server_url', v_server.server_url,
    'is_active', v_server.is_active,
    'is_healthy', v_server.is_healthy,
    'current_load', v_server.current_load,
    'max_capacity', v_server.max_capacity,
    'response_time', v_server.response_time
  );
  
  RETURN v_result;
END;
$$;