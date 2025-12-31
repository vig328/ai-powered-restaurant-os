import { User, Mail, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";

interface UserInfoProps {
  user: {
    name: string;
    email: string;
    orderHistory?: Array<{ id: string; date: string; total: number }>;
  } | null;
}

const UserInfo = ({ user }: UserInfoProps) => {
  if (!user) {
    return (
      <Card className="p-6 bg-card border-border shadow-card">
        <div className="text-center text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Login to view your profile</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-card border-border shadow-card">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">Your Profile</h3>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium text-foreground">{user.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium text-foreground text-sm">{user.email}</p>
              </div>
            </div>
          </div>
        </div>

        {user.orderHistory && user.orderHistory.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Order History
            </h4>
            <div className="space-y-2">
              {user.orderHistory.map((order) => (
                <div
                  key={order.id}
                  className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">Order #{order.id}</p>
                    <p className="text-xs text-muted-foreground">{order.date}</p>
                  </div>
                  <p className="font-semibold text-primary">₹{order.total}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default UserInfo;
