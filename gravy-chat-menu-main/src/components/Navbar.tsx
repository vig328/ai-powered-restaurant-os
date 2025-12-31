import { Link } from "react-router-dom";
import { ShoppingCart, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  onLoginClick: () => void;
  onCartClick: () => void;
  user: { name: string; email: string } | null;
  cartItemsCount: number;
}

const Navbar = ({ onLoginClick, onCartClick, user, cartItemsCount }: NavbarProps) => {
  return (
    <nav className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-xl shadow-warm">
            F
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
              Fifty Shades Of Gravy
            </h1>
            <p className="text-xs text-muted-foreground italic">Every Gravy Has a Story</p>
          </div>
        </Link>

        <div className="flex items-center gap-8">
          <Link to="/" className="text-foreground hover:text-primary transition-colors font-medium">
            Home
          </Link>
          <Link to="/menu" className="text-foreground hover:text-primary transition-colors font-medium">
            Menu
          </Link>
          <Link to="/about" className="text-foreground hover:text-primary transition-colors font-medium">
            About
          </Link>
          <Link to="/contact" className="text-foreground hover:text-primary transition-colors font-medium">
            Contact
          </Link>
            {/* ✅ New Bookings Tab */}
          <Link to="/booking" className="text-foreground hover:text-primary transition-colors font-medium">
           Bookings
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={onCartClick}
          >
            <ShoppingCart className="h-5 w-5" />
            {cartItemsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                {cartItemsCount}
              </span>
            )}
          </Button>

          {user ? (
            <Button variant="outline" className="gap-2">
              <User className="h-4 w-4" />
              {user.name}
            </Button>
          ) : (
            <Button onClick={onLoginClick} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Login / Register
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
