import { useState } from "react";
import axios from "axios";

const BookingPage = () => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    people: "",
    date: "",
    time: "",
  });

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [paymentLink, setPaymentLink] = useState("");


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await axios.post("https://ai-powered-restaurant-os-4.onrender.com/book-table", form);
      setResponse(res.data.response);
      setPaymentLink(res.data.payment_link);
    } catch (err: any) {
      setResponse("Something went wrong");
    }

    setLoading(false);
  };

  return (
    <div className="container mx-auto max-w-lg mt-10 p-6 border rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-4">Book a Table</h1>

      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <input
          type="text"
          name="name"
          placeholder="Your Name"
          className="border p-2 rounded"
          onChange={handleChange}
        />
        <input
          type="email"
          name="email"
          placeholder="Your Email"
          className="border p-2 rounded"
          onChange={handleChange}
        />
        <input
          type="number"
          name="people"
          placeholder="Number of People"
          className="border p-2 rounded"
          onChange={handleChange}
        />
        <input
          type="date"
          name="date"
          className="border p-2 rounded"
          onChange={handleChange}
        />
        <input
          type="time"
          name="time"
          className="border p-2 rounded"
          onChange={handleChange}
        />

        <button
          type="submit"
          className="bg-primary text-white p-2 rounded mt-3"
          disabled={loading}
        >
          {loading ? "Processing..." : "Book Table"}
        </button>
      </form>

      {response && (
        <div className="mt-4 p-3 bg-accent text-white rounded whitespace-pre-line">
          {response}
        </div>
      )}
      {paymentLink && (
  <a 
    href={paymentLink}
    target="_blank"
    className="mt-4 block bg-green-600 text-white p-2 rounded text-center"
  >
    Pay Now
  </a>
)}

    </div>
  );
};

export default BookingPage;
