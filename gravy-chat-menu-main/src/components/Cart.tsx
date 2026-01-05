import { X, Plus, Minus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}

const Cart = ({ open, onOpenChange, items, onUpdateQuantity, onRemove }: CartProps) => {
  const { toast } = useToast();
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const [paymentLink, setPaymentLink] = useState("");
  const handleConfirmOrder = async () => {
    try {
      const sid = sessionStorage.getItem("fsog_session_id");
      const userName = sessionStorage.getItem(`user_name_${sid}`) || "Guest User";
      const userEmail = sessionStorage.getItem(`user_email_${sid}`) || "guest@example.com";

      const response = await fetch("https://ai-powered-restaurant-os-4.onrender.com/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sid,
          name: userName,
          email: userEmail,
          items,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Order Failed",
          description: data?.response || "Unable to place the order.",
          variant: "destructive",
        });
        return;
      }

      // If no active booking
      if (data?.response?.includes("No active booking")) {
        toast({
          title: "No Active Booking",
          description: data.response,
          variant: "destructive",
        });
        return;
      }

      // Order placed successfully
      toast({
        title: "Order Placed! 🎉",
        description: data.response,
      });

      if (data.awaiting_payment_mode) {
        setShowPaymentOptions(true); // show payment buttons
      } else {
        onOpenChange(false);
      }

    } catch (error) {
      toast({
        title: "Error",
        description: "Unable to connect to the server",
        variant: "destructive",
      });
    }
  };

  const handlePaymentMode = async (mode: "Online" | "Cash") => {
  try {
    const sid = sessionStorage.getItem("fsog_session_id");

    const response = await fetch("https://ai-powered-restaurant-os-4.onrender.com/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sid,
        payment_mode: mode,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      toast({
        title: "Payment Error",
        description: data?.detail || "Failed to process payment mode.",
        variant: "destructive",
      });
      return;
    }

    // 🔥 If ONLINE payment → open payment gateway
    if (mode === "Online") {
      if (data.payment_url) {
        window.open(data.payment_url, "_blank");
        return;
      } else {
        toast({
          title: "Payment Link Error",
          description: "Payment link missing from backend.",
          variant: "destructive",
        });
        return;
      }
    }

    // 🔥 If Cash
    toast({
      title: "Payment Updated",
      description: data.response,
    });

    setShowPaymentOptions(false);
    onOpenChange(false);

  } catch (error) {
    toast({
      title: "Error",
      description: "Unable to update payment mode",
      variant: "destructive",
    });
  }
};


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-2xl">
            <ShoppingBag className="h-6 w-6 text-primary" />
            Your Cart
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <ShoppingBag className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-lg">Your cart is empty</p>
            <p className="text-sm">Add some delicious items from our menu!</p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <ScrollArea className="flex-1 pr-4 mt-6">
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{item.name}</h4>
                      <p className="text-sm text-primary font-semibold">₹{item.price}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1))}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>

                      <span className="w-8 text-center font-semibold">{item.quantity}</span>

                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => onRemove(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {!showPaymentOptions && (
              <div className="mt-6 border-t border-border pt-4 space-y-4">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-primary">₹{total}</span>
                </div>
                <Button
                  onClick={handleConfirmOrder}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  size="lg"
                >
                  Confirm Order
                </Button>
              </div>
            )}

            {showPaymentOptions && (
              <div className="mt-6 border-t border-border pt-4 space-y-4">
                <p className="text-lg font-semibold">Choose Payment Mode</p>
                <div className="flex gap-3">
                  <Button
                    className="w-1/2 bg-primary text-white"
                    onClick={() => handlePaymentMode("Online")}
                  >
                    Pay Online
                  </Button>

                  
                  <Button
                    variant="secondary"
                    className="w-1/2"
                    onClick={() => handlePaymentMode("Cash")}
                  >
                    Cash
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default Cart;
