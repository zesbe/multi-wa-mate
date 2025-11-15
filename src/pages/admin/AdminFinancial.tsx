import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, DollarSign, TrendingUp, Users, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Payment {
  id: string;
  order_id: string;
  amount: number;
  total_payment: number;
  payment_method: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  user_id: string;
  user?: {
    id: string;
    full_name?: string;
  };
  plans?: {
    name: string;
  };
}

interface Stats {
  totalRevenue: number;
  monthlyRevenue: number;
  totalPayments: number;
  completedPayments: number;
}

export default function AdminFinancial() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    monthlyRevenue: 0,
    totalPayments: 0,
    completedPayments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    try {
      const { data: paymentsData, error } = await supabase
        .from("payments")
        .select(`*, plans (name)`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const userIds = [...new Set(paymentsData?.map(p => p.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const paymentsWithUsers = (paymentsData || []).map(payment => ({
        ...payment,
        user: profilesMap.get(payment.user_id)
      }));

      setPayments(paymentsWithUsers);

      const completed = paymentsWithUsers.filter(p => p.status === 'completed');
      const totalRevenue = completed.reduce((sum, p) => sum + Number(p.amount), 0);
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyPayments = completed.filter(p => 
        new Date(p.completed_at || p.created_at) >= startOfMonth
      );
      const monthlyRevenue = monthlyPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      setStats({
        totalRevenue,
        monthlyRevenue,
        totalPayments: paymentsWithUsers.length,
        completedPayments: completed.length,
      });

    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching financial data:", error);
      }
      toast.error("Gagal memuat data keuangan");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Selesai</Badge>;
      case "pending":
        return <Badge variant="secondary">Menunggu</Badge>;
      case "failed":
        return <Badge variant="destructive">Gagal</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Laporan Keuangan</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Pantau pendapatan dan transaksi pembayaran</p>
        </div>

        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-primary/10 rounded-lg shrink-0">
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground">Total Pendapatan</p>
                <p className="text-xl sm:text-2xl font-bold truncate">Rp {stats.totalRevenue.toLocaleString('id-ID')}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-green-500/10 rounded-lg shrink-0">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground">Pendapatan Bulan Ini</p>
                <p className="text-xl sm:text-2xl font-bold truncate">Rp {stats.monthlyRevenue.toLocaleString('id-ID')}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-blue-500/10 rounded-lg shrink-0">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground">Total Transaksi</p>
                <p className="text-xl sm:text-2xl font-bold">{stats.totalPayments}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-purple-500/10 rounded-lg shrink-0">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground">Transaksi Selesai</p>
                <p className="text-xl sm:text-2xl font-bold">{stats.completedPayments}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold mb-4">Riwayat Transaksi</h2>
          
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Paket</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Belum ada transaksi
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-sm">{payment.order_id}</TableCell>
                      <TableCell>{payment.user?.full_name || '-'}</TableCell>
                      <TableCell>{payment.plans?.name || '-'}</TableCell>
                      <TableCell className="uppercase text-sm">{payment.payment_method}</TableCell>
                      <TableCell className="font-semibold whitespace-nowrap">
                        Rp {Number(payment.total_payment).toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(payment.created_at).toLocaleDateString('id-ID')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-3">
            {payments.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Belum ada transaksi
              </div>
            ) : (
              payments.map((payment) => (
                <Card key={payment.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs text-muted-foreground mb-1">
                          {payment.order_id}
                        </p>
                        <p className="font-semibold truncate">
                          {payment.user?.full_name || 'Unknown'}
                        </p>
                      </div>
                      {getStatusBadge(payment.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Paket:</p>
                        <p className="font-medium">{payment.plans?.name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Metode:</p>
                        <p className="font-medium uppercase">{payment.payment_method}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-lg font-bold">
                          Rp {Number(payment.total_payment).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Tanggal</p>
                        <p className="text-sm">
                          {new Date(payment.created_at).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}