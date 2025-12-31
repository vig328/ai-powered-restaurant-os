import { useState } from "react";
import ChatBot from "@/components/ChatBot";
import UserInfo from "@/components/UserInfo";

interface HomeProps {
  user: { name: string; email: string } | null;
}

const Home = ({ user }: HomeProps) => {
  return (
    <div className="min-h-[calc(100vh-73px)] bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
            Fifty Shades Of Gravy
          </h1>
          <p className="text-lg text-muted-foreground italic">Every Gravy Has a Story</p>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-6 max-w-7xl mx-auto">
          <div className="order-2 lg:order-1">
            <UserInfo user={user} />
          </div>

          <div className="order-1 lg:order-2 h-[600px]">
            <ChatBot />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
