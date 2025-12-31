import { ViewType } from "@/pages/Dashboard";
import { DataTable } from "./DataTable";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DataViewProps {
  viewType: Exclude<ViewType, "analytics" | "campaigns">;
}

const viewTitles: Record<Exclude<ViewType, "analytics" | "campaigns">, string> = {
  menu: "Menu Management",
  orders: "Orders",
  bookings: "Bookings",
  advance_booking: "Advanced Bookings",
  table: "Tables",
  cancellations: "Cancellations",
  complaints: "Complaints",
  manager: "Manager Requests",
  users: "Users",
};

export const DataView = ({ viewType }: DataViewProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await supabase.functions.invoke("sync-google-sheet", {
        body: { sheet: viewType }
      });
      toast({
        title: "Data refreshed",
        description: "Successfully synced with Google Sheets",
      });
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Could not sync with Google Sheets",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDownloadCSV = async () => {
    setIsDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-csv", {
        body: { sheet: viewType }
      });
      
      if (error) throw error;
      
      const blob = new Blob([data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${viewType}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export successful",
        description: `${viewType} data exported to CSV`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Could not export data",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const title = viewTitles[viewType as Exclude<ViewType, "analytics" | "campaigns">];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
          <p className="text-muted-foreground">Manage and view your {viewType} data</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Sync
          </Button>
          <Button
            onClick={handleDownloadCSV}
            disabled={isDownloading}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <DataTable viewType={viewType} />
    </div>
  );
};
