import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { 
  MessageSquare, 
  Users, 
  Zap, 
  Shield, 
  BarChart3, 
  Bot,
  CheckCircle2,
  ArrowRight
} from "lucide-react";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: "Multi-Device Management",
      description: "Kelola multiple WhatsApp devices dalam satu platform terpadu"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Broadcast Messages",
      description: "Kirim pesan broadcast ke ribuan kontak secara otomatis"
    },
    {
      icon: <Bot className="w-6 h-6" />,
      title: "Chatbot Automation",
      description: "Automasi percakapan dengan chatbot AI yang cerdas"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Quick Setup",
      description: "Aktivasi device hanya dalam 5 menit dengan QR Code"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Secure & Reliable",
      description: "Platform aman dengan enkripsi end-to-end"
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Analytics Dashboard",
      description: "Monitor performa campaign dengan real-time analytics"
    }
  ];

  const benefits = [
    "API Integration untuk developer",
    "Scheduled Messages & Auto Post",
    "Contact Management System",
    "Template Message Library",
    "Webhook Integration",
    "24/7 Customer Support"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <header className="container mx-auto px-4 py-8">
        <nav className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-8 h-8 text-green-600" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">HalloWa</span>
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Login
            </Button>
            <Button onClick={() => navigate("/auth")} className="bg-green-600 hover:bg-green-700">
              Get Started
            </Button>
          </div>
        </nav>

        <div className="text-center max-w-4xl mx-auto mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            WhatsApp Bot Marketing Platform
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Platform WhatsApp Bot Marketing profesional untuk kelola multiple devices, 
            broadcast messages, chatbot automation dalam satu platform terpadu
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")}
              className="bg-green-600 hover:bg-green-700 text-lg px-8"
            >
              Mulai Sekarang <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate("/pricing")}
              className="text-lg px-8"
            >
              Lihat Harga
            </Button>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Fitur Lengkap untuk Marketing Anda
          </h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Semua tools yang Anda butuhkan untuk WhatsApp Marketing yang efektif
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow"
            >
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4 text-green-600 dark:text-green-400">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-green-600 dark:bg-green-700 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">
              Kenapa Pilih HalloWa?
            </h2>
            <div className="grid md:grid-cols-2 gap-4 text-left">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-3 text-white">
                  <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                  <span className="text-lg">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Siap Untuk Meningkatkan Marketing Anda?
        </h2>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
          Bergabung dengan ribuan bisnis yang sudah menggunakan HalloWa untuk WhatsApp Marketing
        </p>
        <Button 
          size="lg"
          onClick={() => navigate("/auth")}
          className="bg-green-600 hover:bg-green-700 text-lg px-8"
        >
          Mulai Gratis Sekarang <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400">
            © 2024 HalloWa. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
