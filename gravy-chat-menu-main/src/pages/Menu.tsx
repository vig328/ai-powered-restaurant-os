import { useState, useEffect } from "react";
import MenuCard from "@/components/MenuCard";
import { useToast } from "@/hooks/use-toast";
import { CartItem } from "@/components/Cart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  time: number;
  personalized?: boolean;
}

interface MenuProps {
  onAddToCart: (item: CartItem) => void;
}

const Menu = ({ onAddToCart }: MenuProps) => {
  const { toast } = useToast();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadMenu = async () => {
      try {
        // ✅ Use sessionStorage email from login
        const sessionId = sessionStorage.getItem("fsog_session_id");
        const customerEmail = sessionId
          ? sessionStorage.getItem(`user_email_${sessionId}`)
          : "";

        const res = await fetch(
          `http://localhost:8000/api/menu?customer_email=${encodeURIComponent(
            customerEmail ?? ""
          )}`
        );

        const data = await res.json();

        if (!Array.isArray(data)) {
          console.error("Menu data is not an array", data);
          setMenuItems([]);
        } else {
          const itemsWithId = data.map((item: any, index: number) => ({
            id: index.toString(),
            name: item.Dish,
            category: item.Category,
            price: item.Price, // ✅ This is updated price from backend
            time: item.Time,
            personalized: item.Personalized || false,
          }));
          setMenuItems(itemsWithId);
        }
      } catch (err) {
        console.error("Failed to fetch menu", err);
        toast({
          title: "Error",
          description: "Failed to load menu. Please try again later.",
          variant: "destructive",
        });
        setMenuItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadMenu();
  }, [toast]);

  // Filter items based on category
  const filteredItems =
    filter === "all"
      ? menuItems
      : menuItems.filter((item) => item.category === filter);

  const handleAddToCart = (item: MenuItem) => {
    onAddToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
    });

    toast({
      title: "Added to cart",
      description: `${item.name} has been added to your cart.`,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl">Loading menu...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Our Menu
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore our authentic Indian flavors crafted with love and tradition
          </p>
        </div>

        {/* Tabs for filtering */}
        <Tabs defaultValue="all" className="mb-8" onValueChange={setFilter}>
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="Main Course">Main Course</TabsTrigger>
            <TabsTrigger value="Starter">Starters</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Menu grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <MenuCard
                key={item.id}
                name={item.name}
                category={item.category}
                price={item.price}
                time={item.time}
                onAddToCart={() => handleAddToCart(item)}
              />
            ))
          ) : (
            <p className="text-center col-span-full text-lg text-muted-foreground">
              No menu items available.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Menu;
