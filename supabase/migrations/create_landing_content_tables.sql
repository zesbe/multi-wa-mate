-- Create landing_sections table for About section
CREATE TABLE IF NOT EXISTS landing_sections (
  id BIGSERIAL PRIMARY KEY,
  section_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create landing_features table
CREATE TABLE IF NOT EXISTS landing_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Star',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create landing_contact table
CREATE TABLE IF NOT EXISTS landing_contact (
  id INTEGER PRIMARY KEY DEFAULT 1,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Enable RLS
ALTER TABLE landing_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_contact ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can view landing page content)
CREATE POLICY "Public read access for landing_sections" ON landing_sections
  FOR SELECT USING (true);

CREATE POLICY "Public read access for landing_features" ON landing_features
  FOR SELECT USING (true);

CREATE POLICY "Public read access for landing_contact" ON landing_contact
  FOR SELECT USING (true);

-- Admin write access (only admins can edit)
CREATE POLICY "Admin full access for landing_sections" ON landing_sections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admin full access for landing_features" ON landing_features
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admin full access for landing_contact" ON landing_contact
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Insert default About section
INSERT INTO landing_sections (section_key, title, content)
VALUES (
  'about',
  'Tentang HalloWa',
  'HalloWa adalah platform WhatsApp Marketing terdepan di Indonesia yang membantu ribuan bisnis meningkatkan penjualan mereka melalui automasi WhatsApp. Dengan teknologi terkini dan interface yang mudah digunakan, kami memberdayakan bisnis dari berbagai ukuran untuk berkomunikasi lebih efektif dengan pelanggan mereka.

Sejak diluncurkan, HalloWa telah dipercaya oleh lebih dari 10,000+ pengguna aktif dan telah mengirimkan lebih dari 50 juta pesan. Kami berkomitmen untuk terus berinovasi dan memberikan solusi terbaik untuk kebutuhan WhatsApp Marketing Anda.'
)
ON CONFLICT (section_key) DO NOTHING;

-- Insert default contact information
INSERT INTO landing_contact (id, email, phone, address)
VALUES (
  1,
  'support@hallowa.id',
  '+62 812-3456-7890',
  'Jl. Sudirman No. 123, Jakarta Selatan, Indonesia 12190'
)
ON CONFLICT (id) DO NOTHING;

-- Insert default features (same as hardcoded ones in Landing.tsx)
INSERT INTO landing_features (title, description, icon, order_index)
VALUES
  ('Multi-Device Management', 'Kelola multiple WhatsApp devices dalam satu platform terpadu', 'MessageSquare', 0),
  ('Broadcast Messages', 'Kirim pesan broadcast ke ribuan kontak secara otomatis', 'Users', 1),
  ('Chatbot Automation', 'Automasi percakapan dengan chatbot AI yang cerdas', 'Bot', 2),
  ('Quick Setup', 'Aktivasi device hanya dalam 5 menit dengan QR Code', 'Zap', 3),
  ('Secure & Reliable', 'Platform aman dengan enkripsi end-to-end', 'Shield', 4),
  ('Analytics Dashboard', 'Monitor performa campaign dengan real-time analytics', 'BarChart3', 5)
ON CONFLICT DO NOTHING;

-- Add updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_landing_sections_updated_at ON landing_sections;
CREATE TRIGGER update_landing_sections_updated_at
  BEFORE UPDATE ON landing_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_landing_features_updated_at ON landing_features;
CREATE TRIGGER update_landing_features_updated_at
  BEFORE UPDATE ON landing_features
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_landing_contact_updated_at ON landing_contact;
CREATE TRIGGER update_landing_contact_updated_at
  BEFORE UPDATE ON landing_contact
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
