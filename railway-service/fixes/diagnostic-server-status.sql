-- ==================================================
-- Diagnostic: Check Server and Device Assignment Status
-- ==================================================

-- 1. Check which server the device is assigned to
SELECT
  d.id,
  d.device_name,
  d.status,
  d.assigned_server_id,
  bs.server_name,
  bs.is_active,
  bs.is_healthy,
  bs.last_health_ping,
  EXTRACT(EPOCH FROM (NOW() - bs.last_health_ping)) / 60 as minutes_since_ping
FROM devices d
LEFT JOIN backend_servers bs ON d.assigned_server_id = bs.id
WHERE d.id = '338f1456-00b2-4d9f-8876-0464a63acd50';

-- 2. Check all active backend servers
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
    ELSE '❌ OFFLINE'
  END as server_status
FROM backend_servers
ORDER BY last_health_ping DESC;

-- 3. Count devices assigned to each server
SELECT
  bs.server_name,
  bs.is_active,
  bs.is_healthy,
  COUNT(d.id) as total_devices,
  COUNT(CASE WHEN d.status = 'connected' THEN 1 END) as connected_devices,
  COUNT(CASE WHEN d.status = 'connecting' THEN 1 END) as connecting_devices,
  EXTRACT(EPOCH FROM (NOW() - bs.last_health_ping)) / 60 as minutes_since_ping
FROM backend_servers bs
LEFT JOIN devices d ON d.assigned_server_id = bs.id
GROUP BY bs.id, bs.server_name, bs.is_active, bs.is_healthy, bs.last_health_ping
ORDER BY bs.last_health_ping DESC;

-- 4. Find all devices assigned to OFFLINE servers
SELECT
  d.id,
  d.device_name,
  d.status,
  bs.server_name as assigned_to_server,
  bs.is_active,
  bs.is_healthy,
  EXTRACT(EPOCH FROM (NOW() - bs.last_health_ping)) / 60 as server_offline_minutes
FROM devices d
JOIN backend_servers bs ON d.assigned_server_id = bs.id
WHERE
  d.status IN ('connecting', 'connected')
  AND (
    bs.is_active = false
    OR bs.is_healthy = false
    OR bs.last_health_ping < NOW() - INTERVAL '5 minutes'
  )
ORDER BY d.updated_at DESC;
