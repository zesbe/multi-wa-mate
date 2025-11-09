import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Plus, Trash2 } from "lucide-react";

export const AdminLandingContent = () => {
  const [sections, setSections] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [contact, setContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [sectionsRes, featuresRes, contactRes] = await Promise.all([
        supabase.from("landing_sections").select("*").order("display_order"),
        supabase.from("landing_features").select("*").order("display_order"),
        supabase.from("landing_contact").select("*").maybeSingle(),
      ]);

      if (sectionsRes.data) setSections(sectionsRes.data);
      if (featuresRes.data) setFeatures(featuresRes.data);
      if (contactRes.data) setContact(contactRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  const saveSection = async (section: any) => {
    try {
      const { error } = await supabase
        .from("landing_sections")
        .upsert(section);

      if (error) throw error;
      toast.success("Section berhasil disimpan");
      fetchData();
    } catch (error) {
      console.error("Error saving section:", error);
      toast.error("Gagal menyimpan section");
    }
  };

  const addFeature = async () => {
    try {
      const { error } = await supabase.from("landing_features").insert({
        title: "New Feature",
        description: "Feature description",
        is_active: true,
        display_order: features.length,
      });

      if (error) throw error;
      toast.success("Feature ditambahkan");
      fetchData();
    } catch (error) {
      console.error("Error adding feature:", error);
      toast.error("Gagal menambah feature");
    }
  };

  const saveFeature = async (feature: any) => {
    try {
      const { error } = await supabase
        .from("landing_features")
        .upsert(feature);

      if (error) throw error;
      toast.success("Feature berhasil disimpan");
      fetchData();
    } catch (error) {
      console.error("Error saving feature:", error);
      toast.error("Gagal menyimpan feature");
    }
  };

  const deleteFeature = async (id: string) => {
    if (!confirm("Hapus feature ini?")) return;

    try {
      const { error } = await supabase
        .from("landing_features")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Feature dihapus");
      fetchData();
    } catch (error) {
      console.error("Error deleting feature:", error);
      toast.error("Gagal menghapus feature");
    }
  };

  const saveContact = async () => {
    if (!contact) return;

    try {
      const { error } = await supabase
        .from("landing_contact")
        .upsert(contact);

      if (error) throw error;
      toast.success("Kontak berhasil disimpan");
    } catch (error) {
      console.error("Error saving contact:", error);
      toast.error("Gagal menyimpan kontak");
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6">Loading...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Landing Page Content</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Kelola konten landing page
          </p>
        </div>

        {/* Sections */}
        <Card>
          <CardHeader>
            <CardTitle>Sections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sections.map((section) => (
              <div key={section.id} className="border p-4 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">{section.section_key}</h3>
                  <Button
                    size="sm"
                    onClick={() => saveSection(section)}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={section.title || ""}
                    onChange={(e) =>
                      setSections(sections.map((s) =>
                        s.id === section.id ? { ...s, title: e.target.value } : s
                      ))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subtitle</Label>
                  <Input
                    value={section.subtitle || ""}
                    onChange={(e) =>
                      setSections(sections.map((s) =>
                        s.id === section.id ? { ...s, subtitle: e.target.value } : s
                      ))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea
                    value={section.content || ""}
                    onChange={(e) =>
                      setSections(sections.map((s) =>
                        s.id === section.id ? { ...s, content: e.target.value } : s
                      ))
                    }
                    rows={4}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Features</CardTitle>
              <Button onClick={addFeature} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Feature
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {features.map((feature) => (
              <div key={feature.id} className="border p-4 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-sm">Feature #{features.indexOf(feature) + 1}</h3>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => saveFeature(feature)}
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteFeature(feature.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={feature.title || ""}
                    onChange={(e) =>
                      setFeatures(features.map((f) =>
                        f.id === feature.id ? { ...f, title: e.target.value } : f
                      ))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={feature.description || ""}
                    onChange={(e) =>
                      setFeatures(features.map((f) =>
                        f.id === feature.id ? { ...f, description: e.target.value } : f
                      ))
                    }
                    rows={3}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Contact */}
        {contact && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Contact Information</CardTitle>
                <Button onClick={saveContact} size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={contact.email || ""}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })}
                  placeholder="contact@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={contact.phone || ""}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                  placeholder="+62 xxx xxx xxx"
                />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input
                  value={contact.whatsapp || ""}
                  onChange={(e) => setContact({ ...contact, whatsapp: e.target.value })}
                  placeholder="+62 xxx xxx xxx"
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea
                  value={contact.address || ""}
                  onChange={(e) => setContact({ ...contact, address: e.target.value })}
                  rows={3}
                  placeholder="Alamat lengkap"
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminLandingContent;
