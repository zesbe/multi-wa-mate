-- Create recurring_messages table for scheduled recurring WhatsApp messages
CREATE TABLE IF NOT EXISTS recurring_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  
  -- Message details
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  media_url TEXT,
  
  -- Recipients (array of phone numbers)
  target_contacts JSONB NOT NULL DEFAULT '[]',
  
  -- Schedule settings
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'custom')),
  interval_value INTEGER DEFAULT 1 CHECK (interval_value > 0), -- Every X days/weeks/months
  days_of_week INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6], -- For weekly (0=Sunday, 6=Saturday)
  day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31), -- For monthly
  time_of_day TIME NOT NULL,
  timezone TEXT DEFAULT 'Asia/Jakarta',
  
  -- Date range
  start_date DATE NOT NULL,
  end_date DATE,
  
  -- Execution tracking
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  next_send_at TIMESTAMPTZ,
  total_sent INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  
  -- Safety settings
  max_executions INTEGER, -- Stop after X sends (NULL = unlimited)
  delay_seconds INTEGER DEFAULT 5 CHECK (delay_seconds >= 1),
  randomize_delay BOOLEAN DEFAULT false,
  batch_size INTEGER DEFAULT 50 CHECK (batch_size > 0),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX idx_recurring_messages_user_id ON recurring_messages(user_id);
CREATE INDEX idx_recurring_messages_device_id ON recurring_messages(device_id);
CREATE INDEX idx_recurring_messages_next_send ON recurring_messages(next_send_at) WHERE is_active = true;
CREATE INDEX idx_recurring_messages_active ON recurring_messages(is_active, next_send_at);

-- Enable RLS
ALTER TABLE recurring_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own recurring messages"
  ON recurring_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own recurring messages"
  ON recurring_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring messages"
  ON recurring_messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring messages"
  ON recurring_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can manage all (for edge functions)
CREATE POLICY "Service can manage all recurring messages"
  ON recurring_messages FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to calculate next send time
CREATE OR REPLACE FUNCTION calculate_next_recurring_send(
  p_frequency TEXT,
  p_interval_value INTEGER,
  p_days_of_week INTEGER[],
  p_day_of_month INTEGER,
  p_time_of_day TIME,
  p_timezone TEXT,
  p_last_sent_at TIMESTAMPTZ,
  p_start_date DATE,
  p_end_date DATE
) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW() AT TIME ZONE p_timezone;
  v_today_scheduled TIMESTAMPTZ;
  v_next_send TIMESTAMPTZ;
  v_current_day INTEGER;
  v_days_ahead INTEGER;
BEGIN
  -- Combine today's date with scheduled time in user's timezone
  v_today_scheduled := (DATE_TRUNC('day', v_now) + p_time_of_day) AT TIME ZONE p_timezone;
  
  -- If we haven't sent yet or it's the first time
  IF p_last_sent_at IS NULL THEN
    -- Check if start date is in the future
    IF p_start_date > CURRENT_DATE THEN
      v_next_send := (p_start_date + p_time_of_day) AT TIME ZONE p_timezone;
    ELSIF v_today_scheduled > v_now THEN
      -- Today's time hasn't passed yet
      v_next_send := v_today_scheduled;
    ELSE
      -- Calculate based on frequency
      CASE p_frequency
        WHEN 'daily' THEN
          v_next_send := v_today_scheduled + (p_interval_value || ' days')::INTERVAL;
        WHEN 'weekly' THEN
          -- Find next valid day of week
          v_current_day := EXTRACT(DOW FROM v_now)::INTEGER;
          v_days_ahead := 1;
          WHILE v_days_ahead <= 7 LOOP
            IF ((v_current_day + v_days_ahead) % 7) = ANY(p_days_of_week) THEN
              v_next_send := v_today_scheduled + (v_days_ahead || ' days')::INTERVAL;
              EXIT;
            END IF;
            v_days_ahead := v_days_ahead + 1;
          END LOOP;
        WHEN 'monthly' THEN
          v_next_send := (DATE_TRUNC('month', v_now) + '1 month'::INTERVAL)::DATE + 
                        (p_day_of_month - 1 || ' days')::INTERVAL + p_time_of_day;
        WHEN 'custom' THEN
          v_next_send := v_today_scheduled + (p_interval_value || ' days')::INTERVAL;
      END CASE;
    END IF;
  ELSE
    -- Calculate next send based on last sent
    CASE p_frequency
      WHEN 'daily' THEN
        v_next_send := p_last_sent_at + (p_interval_value || ' days')::INTERVAL;
      WHEN 'weekly' THEN
        v_next_send := p_last_sent_at + (p_interval_value * 7 || ' days')::INTERVAL;
      WHEN 'monthly' THEN
        v_next_send := p_last_sent_at + (p_interval_value || ' months')::INTERVAL;
      WHEN 'custom' THEN
        v_next_send := p_last_sent_at + (p_interval_value || ' days')::INTERVAL;
    END CASE;
  END IF;
  
  -- Check if next send is beyond end date
  IF p_end_date IS NOT NULL AND v_next_send::DATE > p_end_date THEN
    RETURN NULL; -- No more sends
  END IF;
  
  RETURN v_next_send;
END;
$$;

-- Trigger to auto-calculate next_send_at
CREATE OR REPLACE FUNCTION update_recurring_message_next_send()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.next_send_at := calculate_next_recurring_send(
    NEW.frequency,
    NEW.interval_value,
    NEW.days_of_week,
    NEW.day_of_month,
    NEW.time_of_day,
    NEW.timezone,
    NEW.last_sent_at,
    NEW.start_date,
    NEW.end_date
  );
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_recurring_message_next_send
  BEFORE INSERT OR UPDATE ON recurring_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_message_next_send();

-- Create execution log table
CREATE TABLE IF NOT EXISTS recurring_message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_message_id UUID NOT NULL REFERENCES recurring_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  sent_to_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  
  execution_time TIMESTAMPTZ DEFAULT NOW(),
  details JSONB DEFAULT '{}',
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recurring_message_logs_recurring_id ON recurring_message_logs(recurring_message_id);
CREATE INDEX idx_recurring_message_logs_execution_time ON recurring_message_logs(execution_time DESC);

-- Enable RLS
ALTER TABLE recurring_message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recurring message logs"
  ON recurring_message_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can manage logs"
  ON recurring_message_logs FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE recurring_messages IS 'Stores recurring WhatsApp message schedules for automated sending';
COMMENT ON COLUMN recurring_messages.frequency IS 'daily, weekly, monthly, or custom interval';
COMMENT ON COLUMN recurring_messages.interval_value IS 'For custom frequency: send every X days';
COMMENT ON COLUMN recurring_messages.days_of_week IS 'For weekly: 0=Sunday, 6=Saturday';
COMMENT ON COLUMN recurring_messages.max_executions IS 'Stop after X sends (NULL = unlimited)';