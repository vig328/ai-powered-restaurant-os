import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "./MetricCard";
import { RevenueChart } from "./charts/RevenueChart";
import { PopularDishesChart } from "./charts/PopularDishesChart";
import { TableOccupancyChart } from "./charts/TableOccupancyChart";
import { AIInsightsPanel } from "./AIInsightsPanel";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Menu, 
  ShoppingCart, 
  DollarSign, 
  Calendar, 
  Users, 
  TrendingUp 
} from "lucide-react";

export const AnalyticsDashboard = () => {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-analytics");
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
        <p className="text-muted-foreground">Real-time insights for Fifty Shades of Gravy</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Menu Items"
          value={analytics?.menuItems || 0}
          icon={Menu}
          trend="+2 this week"
        />
        <MetricCard
          title="Orders Today"
          value={analytics?.ordersToday || 0}
          icon={ShoppingCart}
          trend="+12% from yesterday"
          trendUp
        />
        <MetricCard
          title="Revenue Today"
          value={`₹${analytics?.revenueToday?.toFixed(2) || '0.00'}`}
          icon={DollarSign}
          trend="+8% from yesterday"
          trendUp
        />
        <MetricCard
          title="Pending Bookings"
          value={analytics?.pendingBookings || 0}
          icon={Calendar}
          trend="3 today"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={analytics?.revenueTrend || []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Table Occupancy</CardTitle>
          </CardHeader>
          <CardContent>
            <TableOccupancyChart 
              occupied={analytics?.occupiedTables || 0}
              available={analytics?.availableTables || 0}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Most Ordered Dishes</CardTitle>
        </CardHeader>
        <CardContent>
          <PopularDishesChart data={analytics?.popularDishes || []} />
        </CardContent>
      </Card>

      <AIInsightsPanel />
    </div>
  );
};
