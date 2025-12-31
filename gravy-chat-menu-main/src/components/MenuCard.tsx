import { Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MenuCardProps {
  name: string;
  category: string;
  price: number;
  time: number;
  onAddToCart: () => void;
}

const MenuCard = ({ name, category, price, time, onAddToCart }: MenuCardProps) => {
  return (
    <Card className="group overflow-hidden hover:shadow-warm transition-all duration-300 border-border">
      <div className="p-6 space-y-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
              {name}
            </h3>
            <Badge variant="secondary" className="text-xs whitespace-nowrap">
              {category}
            </Badge>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{time} min</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-2xl font-bold text-primary">₹{price}</span>
          <Button
            onClick={onAddToCart}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            <Plus className="h-4 w-4" />
            Add to Cart
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default MenuCard;
