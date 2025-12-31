import { Heart, Award, Users } from "lucide-react";

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">About Us</h1>
            <p className="text-xl text-primary italic">Every Gravy Has a Story</p>
          </div>

          <div className="prose prose-lg max-w-none">
            <div className="bg-card rounded-2xl shadow-card border border-border p-8 mb-8">
              <p className="text-foreground leading-relaxed mb-6">
                Welcome to <span className="font-semibold text-primary">Fifty Shades Of Gravy</span>, where
                tradition meets innovation in every dish we serve. Our journey began with a simple belief: that
                every gravy tells a unique story, and every meal should be an experience to remember.
              </p>
              <p className="text-foreground leading-relaxed">
                We bring together authentic Indian flavors with a modern twist, creating dishes that honor our
                rich culinary heritage while embracing contemporary tastes. Each recipe is crafted with care,
                using the finest ingredients and time-honored cooking techniques.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-card rounded-xl shadow-card border border-border p-6 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Made with Love</h3>
                <p className="text-sm text-muted-foreground">
                  Every dish is prepared with passion and attention to detail
                </p>
              </div>

              <div className="bg-card rounded-xl shadow-card border border-border p-6 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Award className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Quality First</h3>
                <p className="text-sm text-muted-foreground">
                  Premium ingredients sourced from trusted suppliers
                </p>
              </div>

              <div className="bg-card rounded-xl shadow-card border border-border p-6 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Community Focus</h3>
                <p className="text-sm text-muted-foreground">
                  Building connections through shared culinary experiences
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-primary to-accent rounded-2xl p-8 text-center text-primary-foreground">
              <h2 className="text-2xl font-bold mb-4">Our Promise</h2>
              <p className="text-lg opacity-95">
                To deliver an unforgettable dining experience with every order, ensuring that each meal brings
                joy, comfort, and a taste of authentic Indian cuisine to your table.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
