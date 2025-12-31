import { useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AnalyticsDashboard } from "@/components/dashboard/AnalyticsDashboard";
import { DataView } from "@/components/dashboard/DataView";
import { CampaignsView } from "@/components/dashboard/CampaignsView";

export type ViewType = "analytics" | "menu" | "orders" | "bookings" | "table" | "cancellations" | "complaints" | "manager" | "campaigns" | "users" | "advance_booking";

const Dashboard = () => {
  const [currentView, setCurrentView] = useState<ViewType>("analytics");

  const renderView = () => {
    switch (currentView) {
      case "analytics":
        return <AnalyticsDashboard />;
      case "campaigns":
        return <CampaignsView />;
      default:
        return <DataView viewType={currentView} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6 lg:p-8">
          {renderView()}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
