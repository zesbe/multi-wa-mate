-- ==================================================
-- FIX: get_best_available_server() to check last_health_ping
-- ==================================================
--
-- Problem: Function selects servers with is_active=true but doesn't
-- check if server is actually ONLINE (last_health_ping recent)
--
-- Solution: Add condition to check last_health_ping within 5 minutes
-- ==================================================

CREATE OR REPLACE FUNCTION public.get_best_available_server()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_server_id UUID;
BEGIN
  -- Select server with lowest load, highest priority, and is ACTUALLY ONLINE
  SELECT id INTO v_server_id
  FROM public.backend_servers
  WHERE is_active = true
    AND is_healthy = true
    AND current_load < max_capacity
    -- 🔥 FIX: Check if server sent health ping in last 5 minutes
    AND (
      last_health_ping IS NULL  -- Allow newly registered servers
      OR last_health_ping > NOW() - INTERVAL '5 minutes'
    )
  ORDER BY
    priority DESC,
    (current_load::float / NULLIF(max_capacity, 0)) ASC,
    response_time ASC
  LIMIT 1;

  RETURN v_server_id;
END;
$$;

-- Verify the fix by checking which server would be selected
SELECT
  id,
  server_name,
  is_active,
  is_healthy,
  current_load,
  max_capacity,
  last_health_ping,
  EXTRACT(EPOCH FROM (NOW() - last_health_ping)) / 60 as minutes_since_ping,
  CASE
    WHEN last_health_ping > NOW() - INTERVAL '5 minutes' THEN '✅ ONLINE'
    WHEN last_health_ping > NOW() - INTERVAL '30 minutes' THEN '⚠️ STALE'
    WHEN last_health_ping IS NULL THEN '🆕 NEW'
    ELSE '❌ OFFLINE'
  END as status
FROM backend_servers
WHERE is_active = true
ORDER BY last_health_ping DESC NULLS LAST;
