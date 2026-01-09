import { useState, useEffect } from "react";
import { X } from "lucide-react"; // for cross icon (you already use lucide-react elsewhere)

const NotificationBar = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!visible) return; // stop fetching when bar is hidden

    const fetchNotifications = async () => {
      try {
        const res = await fetch("https://ai-powered-restaurant-os-2.onrender.com/notifications");
        const data = await res.json();
        setNotifications(data.notifications.reverse());
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };

    fetchNotifications(); // initial fetch
    const interval = setInterval(fetchNotifications, 5000);

    return () => clearInterval(interval);
  }, [visible]); // rerun only if user reopens the bar

  // hide if closed or no notifications
  if (!visible || notifications.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 w-full bg-yellow-100 text-gray-900 shadow-md p-3 z-[1000] flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold">📢 Notifications</h4>
        <button
          onClick={() => setVisible(false)}
          className="text-gray-600 hover:text-gray-900"
          aria-label="Close notifications"
        >
          <X size={18} />
        </button>
      </div>

      <ul className="text-sm max-h-40 overflow-y-auto">
        {notifications.map((n, i) => (
          <li key={i} className="border-b border-gray-300 py-1">
            <strong>{n.email}:</strong> {n.message}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default NotificationBar;
