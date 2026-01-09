**🍽️ Fifty Shades of Gravy – AI-Driven Restaurant Management System**

“Where design meets delight, and dining becomes a lifestyle.”
A full-stack, AI-powered restaurant platform combining personalization, smart pricing, and real-time operations.

**🚀 Project Overview**

Fifty Shades of Gravy is an AI-first restaurant management system that blends conversational AI, dynamic pricing, intelligent personalization, and real-time operational control into a single scalable platform.
It enables restaurants to optimize revenue, enhance customer experience, and automate decision-making without disrupting trust or usability.

**🤖 AI-Powered Restaurant Chatbot**

- Intent recognition for menu, orders, bookings, and general queries

- Context-aware conversational flow

- Smart fallback handling for ambiguous inputs

- Supports same-day and advance table bookings

- Auto table allocation for today’s bookings

**Advance booking flow:**

- Date confirmation

- Payment request

- Table assignment on arrival

**📋 Dynamic Menu System (Dashboard-Driven)**

- Live menu hydration from Admin Dashboard

- Menu attributes:

  - Dish

  - Category

  - Price

  - Preparation Time

- Automatic frontend refresh on menu changes

- Schema-tolerant handling for:

  - Added / removed items

  - Column reordering

  - Trailing spaces in headers (e.g., Dish )

**🛒 Intelligent Ordering System**

- Cart-based ordering flow

- Quantity updates & topping tracking

- Real-time price computation

- Order persistence with full metadata:

- Dish, Category, Quantity, Price

- Toppings, Order Time

- Customer ID & Name

- Table Number

- Payment Mode

- Cart-based ordering flow

- Quantity updates & topping tracking

- Real-time price computation

- Order persistence with full metadata:

- Dish, Category, Quantity, Price

- Toppings, Order Time

- Customer ID & Name

- Table Number

- Payment Mode

**🪑 Smart Table Booking Engine**

**Today’s Booking**

- Real-time availability checks

- Automatic table assignment

**Advance Booking**

- Stored in advance_booking datastore

- Professional confirmation message:

- Your advance reservation for DATE is recorded. Please complete the payment to hold your booking. Table number will be assigned on arrival.

**🔐 User Authentication & Identity Management**

- Secure signup with password hashing

- JWT-based authentication

- User datastore includes:

- Name

- Email

- Password Hash

- Created At timestamp

**💳 Payment Gateway Integration**

- Stripe Payment Intent creation

- Secure redirection to payment page

- Order confirmation post-payment

- Chat-based payment links

- Table booking payments via Navbar

- Final Pay Now modal at checkout completion

**🧠 Personalized Menu & Smart Pricing System**
**Customer Behavior-Based Personalization**

- Identifies returning users via normalized Customer ID (email)

- Analyzes last 2–3 completed orders

- Extracts dominant ingredient preferences

- Promotes preferred ingredient dishes

- Works even with inconsistent dashboard schemas

**Ingredient Intelligence Engine**

- Schema-agnostic dish extraction

- Noise filtering (e.g., butter, masala, extra)

- Ingredient frequency analysis

- Multi-cuisine support without hardcoding

**Personalized Pricing Logic**

- Real-time price recalculation

- Applied only to returning customers

- Subtle adjustments to preserve trust:

- Preferred dishes: +₹5 to ₹10

- Non-preferred dishes: –₹5

- Frequent visitors prioritized

**Table Demand-Based Surge Pricing**

- Monitors live table occupancy

- At ≥80% occupancy:

- Demand multiplier applied

- Surge pricing precedes personalization

- Transparent revenue optimization

**Unified Pricing Engine**

- Single pricing logic across:

- Chat interface

- REST APIs

- Order placement

- Eliminates billing inconsistencies

**New User Handling**

- Standard menu for first-time users

- No personalization or price manipulation

**UX Enhancements**

- Personalized dishes visually highlighted

- Clean, non-intrusive personalization

- Future-ready transparency support

**Data Reliability & Fault Tolerance**

- Handles:

  - Trailing spaces in column names

  - Missing or reordered fields

  - Safe key normalization ensures continuity

**Scalability & Business Impact**

- Designed for:

  - Loyalty tiers

  - AI taste profiling

  - Time-based menu optimization

  - Revenue analytics & A/B testing

  - Boosts engagement, retention, and average order value

**📊 Admin Dashboard (Google Sheets-Backed)**

- Menu management

- Order tracking

- User management

- Booking logs

- Customer information storage

**🧱 Full Tech Stack**
**Backend**

- FastAPI – High-performance API orchestration

- Gemini LLM – Conversational inference engine

- RAG Pipeline – Context-aware response grounding

- Google Sheets API – Lightweight operational datastore

- Stripe API – Secure payment orchestration

**Frontend**

- React – Component-driven UI architecture

- Dynamic Menu Engine – Real-time data hydration

- Cart & Ordering Module – State-synchronized commerce flow

**🎥 Demo & Documentation
📽️ Project Walkthrough & Demo Vide**o

- A complete end-to-end walkthrough of the Fifty Shades of Gravy – Restaurant Management System, covering chatbot interactions, dynamic menu behavior, personalized pricing, table booking flow, and payment integration.

**👉 Demo Video (Google Drive): **
[ https://drive.google.com/drive/u/0/folders/1sacZzzHxGg6Yb_9R7IKRz9xKXY46f5N6 ]

**📄 Project Documentation (PDF)**

- Detailed technical and product documentation explaining system architecture, feature breakdown, personalization logic, dynamic pricing strategy, and business impact.

**👉 Documentation PDF (Google Drive): **
[ https://drive.google.com/drive/u/0/folders/1sacZzzHxGg6Yb_9R7IKRz9xKXY46f5N6 ]
