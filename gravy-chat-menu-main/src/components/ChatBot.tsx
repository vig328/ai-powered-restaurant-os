import { useState, useEffect, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { v4 as uuidv4 } from "uuid";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

const ChatBot = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Welcome to Fifty Shades Of Gravy! How can I help you today?",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ✅ use localStorage instead of sessionStorage
  useEffect(() => {
    let sid = sessionStorage.getItem("fsog_session_id");
    if (!sid) {
      sid = uuidv4();
      sessionStorage.setItem("fsog_session_id", sid);
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendToBackend = async (message: string) => {
    const sid = sessionStorage.getItem("fsog_session_id");
    const userName = sessionStorage.getItem(`user_name_${sid}`) || "Guest User";
    const userEmail = sessionStorage.getItem(`user_email_${sid}`) || "guest@example.com";

    try {
      const response = await fetch("https://ai-powered-restaurant-os-4.onrender.com/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          session_id: sid,
          name: userName,
          email: userEmail,
        }),
      });

      const data = await response.json();
      return data.response;
    } catch (err) {
      console.error(err);
      return "Sorry, I'm having trouble connecting right now.";
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageToSend = inputValue;
    setInputValue("");
    setIsTyping(true);

    const botText = await sendToBackend(messageToSend);

    const botMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: botText || "I'm sorry, I couldn't process that.",
      sender: "bot",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, botMessage]);
    setIsTyping(false);
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl shadow-card border border-border overflow-hidden">
      <div className="bg-gradient-to-r from-primary to-accent px-6 py-4">
        <h2 className="text-xl font-bold text-primary-foreground">Chat with us</h2>
        <p className="text-sm text-primary-foreground/80">We're here to help!</p>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.sender === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-secondary text-secondary-foreground rounded-bl-sm"
                }`}
              >
                <p className="text-sm leading-relaxed">{message.text}</p>
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-secondary text-secondary-foreground rounded-2xl px-4 py-3 rounded-bl-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border bg-background/50">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your message..."
            className="flex-1"
          />
          <Button onClick={handleSend} size="icon" className="bg-primary hover:bg-primary/90">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;
