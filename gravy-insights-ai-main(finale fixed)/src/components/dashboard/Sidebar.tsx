import { ViewType } from "@/pages/Dashboard";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  BarChart3, 
  Menu as MenuIcon, 
  ShoppingCart, 
  Calendar, 
  Users, 
  TableProperties, 
  XCircle, 
  AlertCircle, 
  UserCog,
  Sparkles,
  CalendarClock,
  LogOut
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export const Sidebar = ({ currentView, onViewChange }: SidebarProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
    navigate("/auth");
  };

  const menuItems = [
    { id: "analytics" as ViewType, label: "Analytics", icon: BarChart3 },
    { id: "campaigns" as ViewType, label: "AI Campaigns", icon: Sparkles },
  ];

  const dataItems = [
    { id: "menu" as ViewType, label: "Menu", icon: MenuIcon },
    { id: "orders" as ViewType, label: "Orders", icon: ShoppingCart },
    { id: "bookings" as ViewType, label: "Bookings", icon: Calendar },
    { id: "advance_booking" as ViewType, label: "Advanced Bookings", icon: CalendarClock },
    { id: "table" as ViewType, label: "Tables", icon: TableProperties },
    { id: "cancellations" as ViewType, label: "Cancellations", icon: XCircle },
    { id: "complaints" as ViewType, label: "Complaints", icon: AlertCircle },
    { id: "manager" as ViewType, label: "Manager Requests", icon: UserCog },
    { id: "users" as ViewType, label: "Users", icon: Users },
  ];

  return (
    <div className="w-64 border-r border-border bg-sidebar">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary">Fifty Shades</h1>
        <p className="text-sm text-muted-foreground">of Gravy</p>
      </div>
      
      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="px-3 py-2">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant={currentView === item.id ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => onViewChange(item.id)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>

          <Separator className="my-4" />
          
          <h3 className="mb-2 px-2 text-sm font-semibold text-muted-foreground">Data Management</h3>
          <div className="space-y-1">
            {dataItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant={currentView === item.id ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => onViewChange(item.id)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      <div className="absolute bottom-0 w-64 border-t border-border bg-sidebar p-4">
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
};
