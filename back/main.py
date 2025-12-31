# main_final.py
import os
import requests
import stripe
import bcrypt
import jwt
from google import genai
import json
import re 
import math
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Request , Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional
from dateutil import parser
from pydantic import BaseModel, EmailStr, Field
from google.oauth2 import service_account
from googleapiclient.discovery import build
from collections import Counter
# -------------------------------
# Load environment variables
# -------------------------------
load_dotenv()

# Secure configuration variables from environment
GOOGLE_SHEET_WEBHOOK = os.getenv("GOOGLE_SHEET_WEBHOOK")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
JWT_SECRET = os.getenv("JWT_SECRET", "fiftyshadesofgravysecret")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID")
GOOGLE_SERVICE_JSON = json.loads(os.getenv("GOOGLE_SERVICE_JSON"))
GOOGLE_SERVICE_EMAIL = os.getenv("GOOGLE_SERVICE_EMAIL")

# Input validation
if not (GOOGLE_SHEET_WEBHOOK and STRIPE_SECRET_KEY and GEMINI_API_KEY):
    raise Exception("❌ Missing environment variables. Please check your .env file.")

# Initialize external services
stripe.api_key = STRIPE_SECRET_KEY

# Initialize the GenAI client once (no network calls here beyond client init)
genai_client = genai.Client(api_key=GEMINI_API_KEY)

import asyncio
from google import genai

# Make sure this exists once globally
genai_client = genai.Client(api_key=GEMINI_API_KEY)

async def call_gemini(prompt: str) -> str:
    """Async-safe Gemini call using the new google-genai SDK"""

    def _sync_call(p: str) -> str:
        try:
            response = genai_client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=p
            )
            return response.text.strip() if response.text else ""
        except Exception as e:
            print("⚠️ Gemini SDK call error:", e)
            return ""

    return await asyncio.to_thread(_sync_call, prompt)


# -------------------------------
# FastAPI App Setup
# -------------------------------
app = FastAPI(title="Fifty Shades Of Gravy Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for simplicity (use specific domains in production)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------
# Utility Functions (Authentication & Data)
# -------------------------------

def normalize_email(email: str) -> str:
    """Standardize email formatting."""
    return (email or "").strip().lower()

def get_sheet_data(sheet_name: str) -> List[Dict[str, str]]:
    """Fetch all rows from a specified Google Sheet via webhook."""
    try:
        url = f"{GOOGLE_SHEET_WEBHOOK}?sheet={sheet_name}"
        res = requests.get(url, timeout=30)
        res.raise_for_status()
        return res.json().get("data", [])
    except Exception as e:
        print(f"Error fetching {sheet_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch {sheet_name} data.")

def append_to_sheet(sheet_name: str, data: Dict[str, Any]):
    """
    ✅ Append or update data to a specific Google Sheet via Google Apps Script Webhook.
    Automatically integrates with Table Booking Logic on the Apps Script side.
    """
    try:
        url = f"{GOOGLE_SHEET_WEBHOOK}?sheet={sheet_name}"
        headers = {"Content-Type": "application/json"}

        # Clean None values (Apps Script can't handle them)
        clean_data = {k: (v if v is not None else "") for k, v in data.items()}

        print("➡️ Sending data to Google Sheet...")
        print(f"📄 Sheet Name: {sheet_name}")
        print(f"🌐 URL: {url}")
        print(f"📦 Data: {clean_data}")

        res = requests.post(url, json=clean_data, headers=headers, timeout=10)
        print(f"📨 Raw Response: {res.text}")

        res.raise_for_status()

        # Parse response safely
        try:
            result = res.json()
        except Exception as parse_err:
            print("⚠️ Could not parse JSON:", parse_err)
            return {"status": "error", "message": res.text}

        if result.get("status") == "success":
            print(f"✅ Successfully appended data to '{sheet_name}'.")
        else:
            print(f"⚠️ Google Sheet responded with: {result}")

        return result

    except Exception as e:
        print(f"❌ Error appending to {sheet_name}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to append data to '{sheet_name}' sheet. {e}"
        )

def update_sheet_row(sheet_name: str, key_column: str, key_value: str, update_values: Dict[str, Any]):
    """
    ✅ Update an existing row in Google Sheet (using Apps Script webhook)
    where a specific key_column matches key_value.
    """
    try:
        url = f"{GOOGLE_SHEET_WEBHOOK}?sheet={sheet_name}&mode=update"
        headers = {"Content-Type": "application/json"}

        payload = {
            "keyColumn": key_column,
            "key": key_value,
            "updateValues": update_values
        }

        print("➡️ Updating Google Sheet Row...")
        print(f"📄 Sheet Name: {sheet_name}")
        print(f"🔑 Match Column: {key_column} = {key_value}")
        print(f"🆕 Update Values: {update_values}")

        res = requests.post(url, json={"data": json.dumps(payload)}, headers=headers, timeout=10)
        print(f"📨 Raw Response: {res.text}")

        res.raise_for_status()

        result = res.json()
        if result.get("status") == "success":
            print(f"✅ Successfully updated row in '{sheet_name}'.")
        else:
            print(f"⚠️ Google Sheet responded with: {result}")

        return result

    except Exception as e:
        print(f"❌ Error updating {sheet_name}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update row in '{sheet_name}' sheet. {e}"
        )

#-------------------------------
# Additional Helper Functions
#------------------------------

def get_table_demand_multiplier():
    table_data = get_sheet_data("table")
    if not table_data:
        return 1.0

    total = len(table_data)
    unavailable = sum(
        1 for t in table_data
        if str(t.get("Availability", "")).lower() == "no"
    )

    if total == 0:
        return 1.0

    demand_ratio = unavailable / total

    # Surge pricing
    if demand_ratio >= 0.80:
        return 1.20  # +20%

    return 1.0

def get_user_recent_orders(customer_id: str, limit: int = 3):
    orders = get_sheet_data("orders")
    user_orders = [
        o for o in orders
        if str(o.get("Customer_id", "")).lower() == customer_id.lower()
    ]

    # Sort by Ordered_At (latest first)
    user_orders.sort(
        key=lambda x: x.get("Ordered_At", ""),
        reverse=True
    )

    return user_orders[:limit]

def get_last_n_orders(customer_id, n=3):
    orders = get_user_recent_orders(customer_id)
    return orders[-n:] if orders else []

def safe_get(row: dict, target_key: str):
    """
    Fetch value from dict even if key has extra spaces.
    Example: 'Dish', 'Dish ', ' Dish  '
    """
    target_key = target_key.strip().lower()
    for k, v in row.items():
        if k.strip().lower() == target_key:
            return v
    return ""

def get_dish_from_order(order_row):
    return safe_get(order_row, "Dish").strip()


def detect_favorite_ingredient(orders):
    ignore_words = {"butter", "masala", "with", "extra", "and"}
    freq = {}

    for o in orders:
        dish = get_dish_from_order(o).lower()
        for word in dish.split():
            if word and word not in ignore_words:
                freq[word] = freq.get(word, 0) + 1

    if not freq:
        return None

    return max(freq, key=freq.get)


def build_personalized_chat_menu(menu_data, customer_email):
    if not customer_email:
        return menu_data

    customer_id = normalize_email(customer_email)
    orders = get_user_recent_orders(customer_id)

    # New user → normal menu (but still surge)
    table_multiplier = get_table_demand_multiplier()

    if not orders or len(orders) < 2:
        return [
            {
                **m,
                "Price": int(float(m["Price"]) * table_multiplier)
            }
            for m in menu_data
        ]

    recent_orders = orders[-3:]
    fav_ingredient = detect_favorite_ingredient(recent_orders)

    frequent = is_frequent_customer(customer_id)
    inc = 10 if frequent else 5
    dec = 5

    preferred = []
    others = []

    for m in menu_data:
        dish = m["Dish"].lower().strip()
        base_price = float(m["Price"])

        # 🔥 APPLY TABLE DEMAND SURGE FIRST
        surged_price = base_price * table_multiplier

        if fav_ingredient and fav_ingredient in dish:
            final_price = surged_price + inc
            preferred.append({
                **m,
                "Price": int(final_price),
                "Personalized": True
            })
        else:
            final_price = max(0, surged_price - dec)
            others.append({
                **m,
                "Price": int(final_price),
                "Personalized": False
            })

    return preferred + others

def is_frequent_customer(customer_id: str):
    orders = get_sheet_data("orders")
    count = sum(
        1 for o in orders
        if str(o.get("Customer_id", "")).lower() == customer_id.lower()
    )
    return count >= 3

def get_user_orders(customer_id):
    orders = get_sheet_data("orders")
    return [
        o for o in orders
        if o.get("Customer_ID") == customer_id
    ]


def extract_preferred_keywords(user_orders, limit=3):
    """
    Extract all keywords from last `limit` orders.
    Returns a set of keywords.
    """
    if not user_orders:
        return set()

    keywords = ["paneer", "dal", "rice", "chicken", "mutton"]
    last_orders = user_orders[-limit:]
    found_keywords = []

    for order in last_orders:
        # Use the correct column name with trailing spaces
        dish_name = order.get("Dish  ", "").lower().strip()
        for k in keywords:
            if k in dish_name:
                found_keywords.append(k)

    return set(found_keywords)


def is_frequent_customer(orders):
    from datetime import datetime, timedelta

    now = datetime.now()
    last_30_days = [
        o for o in orders
        if "Ordered_At" in o
        and (now - datetime.strptime(o["Ordered_At"], "%Y-%m-%d %H:%M")).days <= 30
    ]

    return len(last_30_days) >= 2



def hash_password(password: str) -> str:
    """Hashes a password using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, hashed: str) -> bool:
    """Verifies a plain password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_jwt(email: str) -> str:
    """Generates a JWT token for the user."""
    payload = {"email": email, "exp": datetime.utcnow() + timedelta(days=1)}
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    # Ensure the result is a string for return
    return token.decode("utf-8") if isinstance(token, bytes) else token

def find_user_by_email(email: str) -> Optional[Dict[str, str]]:
    """Finds a user in the 'users' sheet by their email."""
    email = normalize_email(email)
    users = get_sheet_data("users")
    for u in users:
        if normalize_email(u.get("Email") or "") == email:
            return u
    return None
def get_available_table() -> Optional[str]:
    """Returns the first available table ID (e.g., T6) and marks it as booked."""
    tables = get_sheet_data("table")
    for t in tables:
        table_no = t.get("Table")
        available = t.get("Availability", "").strip().lower()
        if available == "yes":
            # Mark this table as booked
            update_data = {"Table": table_no, "Availability": "No"}
            append_to_sheet("table", update_data)  # or send a webhook update if you support PUT
            return table_no
    return None

from datetime import datetime, timedelta, timezone
from dateutil import parser
from typing import Optional, Dict, Any

IST = timezone(timedelta(hours=5, minutes=30))

def get_active_booking(email: str) -> Optional[Dict[str, Any]]:
    """
    Return user's active booking if:
    - Email matches,
    - Booking date (in IST) is today,
    - Current time is within 30 mins before to 2 hrs after booking time.
    """
    try:
        sheet_data = get_sheet_data("bookings")
        if not sheet_data:
            print("⚠️ No data returned from bookings sheet.")
            return None

        print("\n📋 Raw sheet data (first 5 rows):")
        print(sheet_data[:5] if isinstance(sheet_data, list) else sheet_data)

        user_email = email.strip().lower()
        now = datetime.now(IST)
        print(f"\n🕒 Checking active booking for: {user_email}")
        print(f"📅 Current IST time: {now.strftime('%Y-%m-%d %H:%M:%S')}")

        # --- Convert to list of dicts
        records = []
        if isinstance(sheet_data, list) and len(sheet_data) > 0:
            if isinstance(sheet_data[0], dict):
                records = sheet_data
            else:
                headers = [h.strip() for h in sheet_data[0]]
                for row in sheet_data[1:]:
                    if not any(str(c).strip() for c in row):  # skip empty rows
                        continue
                    rec = {headers[i]: (row[i] if i < len(row) else "") for i in range(len(headers))}
                    records.append(rec)
        else:
            print("⚠️ Unrecognized bookings sheet shape.")
            return None

        # --- Filter by email
        user_bookings = []
        for rec in records:
            b_email = str(rec.get("Email", "")).strip().lower()
            if b_email != user_email:
                continue

            raw_date = str(rec.get("Date", "")).strip()
            raw_time = str(rec.get("Time", "")).strip()
            if not raw_date or not raw_time:
                continue

            try:
                # Parse both date and time, force IST
                parsed_date = parser.parse(raw_date)
                parsed_time = parser.parse(raw_time)

                # Convert both to IST
                if parsed_date.tzinfo is None:
                    parsed_date = parsed_date.replace(tzinfo=timezone.utc).astimezone(IST)
                else:
                    parsed_date = parsed_date.astimezone(IST)

                if parsed_time.tzinfo is None:
                    parsed_time = parsed_time.replace(tzinfo=timezone.utc).astimezone(IST)
                else:
                    parsed_time = parsed_time.astimezone(IST)

                # Combine into one IST datetime
                booking_dt = datetime.combine(parsed_date.date(), parsed_time.timetz())
                booking_dt = booking_dt.astimezone(IST)

                user_bookings.append((booking_dt, rec))
            except Exception as e:
                print(f"⚠️ Error parsing booking for {b_email}: {e}")

        if not user_bookings:
            print(f"⚠️ No bookings found for {user_email}")
            return None

        # --- Sort latest first
        user_bookings.sort(key=lambda x: x[0], reverse=True)

        # --- Filter for today
        today_bookings = [(dt, rec) for dt, rec in user_bookings if dt.date() == now.date()]
        if not today_bookings:
            print(f"❌ No booking found for today ({now.date()}).")
            return None

        latest_booking_dt, latest_rec = today_bookings[0]

        print(f"📖 Latest booking for {user_email}: {latest_booking_dt}")
        window_start = latest_booking_dt - timedelta(minutes=30)
        window_end = latest_booking_dt + timedelta(hours=2)
        print(f"   ➤ Window start: {window_start}")
        print(f"   ➤ Window end: {window_end}")

        if window_start <= now <= window_end:
            print(f"✅ Active booking found for {user_email} (within allowed time).")
            return latest_rec
        else:
            print(f"❌ Booking not active (outside allowed window).")
            return None

    except Exception as e:
        print(f"❌ Error in get_active_booking: {e}")
        return None


def create_stripe_checkout(amount: float, description: str) -> Optional[str]:
    """Creates a Stripe Checkout session and returns the URL."""
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "inr",
                    "product_data": {"name": description},
                    "unit_amount": int(amount * 100),
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{BASE_URL}/success",
            cancel_url=f"{BASE_URL}/cancel"
        )
        return session.url
    except Exception as e:
        print(f"Stripe Error: {e}")
        return None

def clean_name(user_msg: str) -> str:
    """
    Extract and clean user's name from message text.
    Removes phrases like 'my name is', 'this is', 'i am', etc.
    """
    # Try multiple name patterns
    patterns = [
        r"\bmy name is ([A-Za-z ]+)",
        r"\bi am ([A-Za-z ]+)",
        r"\bthis is ([A-Za-z ]+)",
    ]

    for pattern in patterns:
        match = re.search(pattern, user_msg, re.IGNORECASE)
        if match:
            name = match.group(1)
            # Remove anything after 'and my email' or 'email is'
            name = re.sub(r"(and my email|email is).*", "", name, flags=re.IGNORECASE)
            return name.strip().title()

    # fallback if no keyword match
    return None

def format_entry(dt_string):
    if not dt_string:
        return "N/A"
    try:
        # Try parsing ISO format (Google Sheet API)
        dt = datetime.fromisoformat(dt_string.replace("Z", ""))
        return dt.strftime("%d %b %Y")
    except:
        return dt_string


def format_time(time_string):
    if not time_string:
        return "N/A"
    try:
        dt = datetime.fromisoformat(time_string.replace("Z", ""))
        return dt.strftime("%I:%M %p")  # Example: 07:30 PM
    except:
        return time_string
    
#----------------------------------------------------------
# CANCELLATION NOTIFICATION HELPER FUNCTION
#----------------------------------------------------------
import threading, time

# 🧠 Cache of last known cancellation statuses
cancellation_status_cache = {}

# 🔔 Store chatbot sessions (session_id → {email, messages})
user_sessions = {}  # you already have this, we’ll reuse it

def send_chat_notification(email: str, message: str):
    """
    Send a chatbot-style notification to the user if their session is active.
    """
    try:
        # Find session by email
        for session_id, session_data in user_sessions.items():
            if session_data.get("email") == email:
                # Add to session messages
                if "notifications" not in session_data:
                    session_data["notifications"] = []
                session_data["notifications"].append(message)
                print(f"💬 Notified {email}: {message}")
                return True

        print(f"⚠️ No active chat session found for {email}. (Notification stored silently)")
        return False

    except Exception as e:
        print(f"❌ Error sending chat notification: {e}")
        return False

def check_cancellation_updates():
    """
    Periodically check 'cancellations' sheet for updates in Status.
    Notify the user via chatbot if the Status changes.
    """
    try:
        sheet_data = get_sheet_data("cancellations")
        if not sheet_data:
            print("⚠️ No data in cancellations sheet.")
            return

        # Convert first row to headers
        if isinstance(sheet_data, list) and len(sheet_data) > 1 and isinstance(sheet_data[0], list):
            headers = [h.strip() for h in sheet_data[0]]
            rows = sheet_data[1:]
        else:
            print("⚠️ Unexpected cancellations sheet format.")
            return

        for row in rows:
            record = {headers[i]: (row[i] if i < len(row) else "") for i in range(len(headers))}
            email = record.get("Email", "").strip()
            name = record.get("Customer_Name", "").strip()
            status = record.get("Status", "").strip()

            if not email or not status:
                continue

            # Only act if status changed since last check
            last_status = cancellation_status_cache.get(email)
            if last_status != status:
                cancellation_status_cache[email] = status

                # Ignore pending
                if status.lower() == "pending review":
                    continue

                # --- Send notification based on status ---
                if status.lower() == "cancelled":
                    message = f"✅ Hello {name}, your cancellation request has been **approved**. Your order is now cancelled."
                elif status.lower() in ["rejected", "refused", "declined"]:
                    message = f"❌ Hello {name}, sorry — your cancellation request was **not approved**. Your order will still be served."
                else:
                    continue

                # 🔔 Send chatbot message
                send_chat_notification(email, message)

    except Exception as e:
        print(f"❌ Error checking cancellations: {e}")


# -------------------------------
# Core Logic: Gemini JSON Handler
# -------------------------------

def process_gemini_json_response(
    json_text: str,
    menu_data: List[Dict[str, str]],
    customer_email: str = "guest@example.com",
    customer_name: str = "Guest User",
) -> Dict[str, Any]:
    """
    Parses Gemini's JSON response, performs the requested action (Order/Booking),
    updates Google Sheets, and returns a natural language confirmation.
    """

    try:
        data = json.loads(json_text)

        # --- Handle Table Booking Intent ---
        if "Booking" in data and isinstance(data["Booking"], dict):
            booking = data["Booking"]

            people = int(booking.get("People", 2))
            date = booking.get("Date") or datetime.now().strftime("%Y-%m-%d")
            time = booking.get("Time") or "8:00 PM"
            name = booking.get("Name", customer_name)
            email = booking.get("Email", customer_email)

            table_no = get_available_table()
            if not table_no:
                return {"response": "⚠️ Sorry, all tables are currently booked. Please try again later."}

            table_type = "4" if people <= 4 else "6"
            amount = 100 * int(table_type)
            payment_link = create_stripe_checkout(amount, f"Table {table_no} for {people}")

            booking_data = {
                "Name": name,
                "Email": normalize_email(email),
                "People": people,
                "Date": date,
                "Time": time,
                "Table_Type": table_type,
                "Table_No": table_no,
                "Payment_Link": payment_link or "N/A",
                "Created_At": datetime.now().strftime("%Y-%m-%d %H:%M"),
            }

            append_to_sheet("bookings", booking_data)

            return {
                "response": f"🪑 Your table for **{people} people** on **{date}** at **{time}** under the name **{name}** has been noted. Please use the payment link below to confirm your reservation.",
                "payment_link": payment_link,
            }

        # --- Handle Food Order Intent ---
        if isinstance(data, list) and all(isinstance(item, dict) for item in data):
            responses = []

            # ✅ Check if user has an active booking
            active_booking = get_active_booking(customer_email)
            if not active_booking:
                return {"response": "⚠️ You don’t have an active booking. Please book a table first before ordering."}

            table_no = active_booking.get("Table_No", "N/A")

            # ✅ Detect payment mode (cash / online)
            user_msg_lower = json_text.lower()
            payment_mode = None
            if "cash" in user_msg_lower:
                payment_mode = "Cash"
            elif "online" in user_msg_lower or "stripe" in user_msg_lower:
                payment_mode = "Online"

            order_total = 0
            order_items = []

            for item in data:
                dish_name = (item.get("Dish") or "").strip()
                qty = int(item.get("Quantity", 1))
                toppings = (item.get("Toppings") or "").strip()
                notes = (item.get("Notes") or "").strip()

                if not dish_name:
                    responses.append("⚠️ I couldn’t identify the dish name. Please mention it clearly.")
                    continue

                # ✅ Validate dish name against menu
                match = next(
                    (d for d in menu_data if d.get("Dish", "").strip().lower() == dish_name.lower()), None
                )
                if not match:
                    responses.append(f"❌ '{dish_name}' is not on our menu. Please choose a valid dish.")
                    continue

                # ✅ Price calculation
                try:
                    base_price = float(match.get("Price", 0))
                except (ValueError, TypeError):
                    base_price = 0.0

# 1️⃣ Demand-based pricing (tables)
                table_multiplier = get_table_demand_multiplier()

# 2️⃣ Customer behavior pricing
                customer_id = normalize_email(email)
                user_orders = get_user_orders(customer_id)
                frequent_user = is_frequent_customer(user_orders)

                user_multiplier = 1.05 if frequent_user else 1.0
# 3️⃣ Final unit price
                unit_price = base_price * table_multiplier * user_multiplier

# 4️⃣ Order total
                total_price = unit_price * qty
                order_total += total_price
                # ✅ Add row for Google Sheet
                order_data = {
                    "Dish": match.get("Dish", dish_name),
                    "Category": match.get("Category", "Main Course"),
                    "Quantity": qty,
                    "Price": f"₹{unit_price:.0f} × {qty} = ₹{total_price:.0f}",
                    "Time": match.get("Time", "15 min"),
                    "Toppings": toppings if toppings else "None",
                    "Ordered_At": datetime.now().strftime("%Y-%m-%d %H:%M"),
                    "Customer_ID": normalize_email(customer_email),
                    "Customer_Name": customer_name,
                    "Table_No": table_no,
                    "Payment_Mode": payment_mode if payment_mode else "Pending",
                }

                append_to_sheet("orders", order_data)
                order_items.append(order_data)

                t_text = f" with **{toppings}**" if toppings else ""
                n_text = f" (Note: {notes})" if notes else ""
                responses.append(f"✅ {qty} × **{dish_name}**{t_text}{n_text} added to your order! 🍛")

            # ✅ Ask for payment mode if not mentioned
            if not payment_mode:
                return {
                    "response": (
                        "\n".join(responses)
                        + "\n💬 Would you like to pay **online** or by **cash**?"
                    ),
                    "awaiting_payment_mode": True,
                    "order_total": order_total,
                }

            # ✅ If user chose Online payment
            if payment_mode == "Online":
                payment_link = create_stripe_checkout(
                    int(order_total),
                    f"Food Order for {customer_name} ({normalize_email(customer_email)})"
                )
                return {
                    "response": (
                        "\n".join(responses)
                        + f"\n💳 Your total is ₹{order_total:.0f}. Please pay online using this link:\n{payment_link}"
                    ),
                    "payment_link": payment_link,
                }

            # ✅ If user chose Cash payment
            if payment_mode == "Cash":
                return {
                    "response": (
                        "\n".join(responses)
                        + "\n💰 Payment mode set to **Cash**. Please pay at the restaurant."
                    ),
                }

        # --- Handle Fallback Case ---
        return {"response": "⚠️ Sorry, I couldn’t process your request properly. Could you please rephrase?"}

    except json.JSONDecodeError:
        return {"response": json_text}
    except HTTPException as e:
        return {"response": f"⚠️ System error while updating the sheet: {e.detail}"}
    except Exception as e:
        print(f"Error processing Gemini JSON: {e}")
        return {"response": "⚠️ Internal error while processing your request."}

def handle_booking_logic(req, user_msg, user_msg_lower, session_id):
    # ====================================================
    # 🪑 TABLE BOOKING LOGIC (updated for TODAY vs FUTURE)
    # ====================================================
    booking_keywords = ["book", "reserve", "reservation", "booking", "table"]
    booking_details_present = any(
        kw in user_msg_lower for kw in ["@", "people", "person", "guest", "-", "am", "pm"]
    )

    # Detect booking intent
    if any(word in user_msg_lower for word in booking_keywords) or booking_details_present:

        # Extract booking details
        name = clean_name(user_msg)
        email_match = re.search(r"[\w\.-]+@[\w\.-]+", user_msg_lower)
        people_match = re.search(r"(\d+)\s*(people|person|guests?)", user_msg_lower)
        date_match = re.search(r"(\d{4}-\d{2}-\d{2})", user_msg_lower)
        time_match = re.search(r"(\d{1,2}:\d{2}\s*(?:am|pm))", user_msg_lower)

        # Final booking object
        booking_data = {
            "Name": name,
            "Email": email_match.group(0) if email_match else None,
            "People": int(people_match.group(1)) if people_match else None,
            "Date": date_match.group(1) if date_match else None,
            "Time": time_match.group(1) if time_match else None,
        }

        # Require all data
        if not all(booking_data.values()):
            missing = [k for k, v in booking_data.items() if not v]
            missing_fields = (
                ", ".join(missing)
                .replace("Email", "email address")
                .replace("People", "number of people")
            )
            return {
                "response": f"Please share your {missing_fields} to complete your booking."
            }

        # =====================================================
        # 🔥 TODAY vs FUTURE DATE LOGIC STARTS HERE
        # =====================================================
        today = datetime.now().strftime("%Y-%m-%d")
        booking_date = booking_data["Date"]

        # -----------------------------------------------------
        # ✅ CASE 1: BOOKING IS FOR TODAY → ASSIGN TABLE(S)
        # -----------------------------------------------------
        if booking_date == today:
            try:
                table_data = get_sheet_data("table")
                available_tables = [
                    t for t in table_data if str(t.get("Availability", "")).lower() == "yes"
                ]

                if not available_tables:
                    return {"response": "😔 Sorry, all tables are booked right now."}

                # 4 people per table
                people = booking_data["People"]
                tables_needed = math.ceil(people / 4)

                if len(available_tables) < tables_needed:
                    return {
                        "response": (
                            f"😔 Sorry, we only have {len(available_tables)} tables available right now."
                        )
                    }

                # Assign tables
                assigned_tables = [t.get("Table") for t in available_tables[:tables_needed]]
                assigned_tables_str = ", ".join(assigned_tables)

                # Mark tables unavailable
                for t in assigned_tables:
                    update_sheet_row("table", "Table", t, {"Availability": "No"})

                # Payment calculation
                total_amount = tables_needed * 100
                payment_link = create_stripe_checkout(
                    amount=total_amount,
                    description=f"Booking for {people} people ({tables_needed} table(s): {assigned_tables_str})"
                )

                # Add booking entry to MAIN bookings sheet
                booking_data.update({
                    "Table_No": assigned_tables_str,
                    "Tables_Assigned": tables_needed,
                    "Total_Amount": f"₹{total_amount}",
                    "Payment_Link": payment_link,
                    "Status": "Pending Payment",
                    "Created_At": datetime.now().strftime("%Y-%m-%d %H:%M"),
                    "Assign_Table": "yes"
                })

                append_to_sheet("bookings", booking_data)

                # Save session
                user_sessions[session_id] = {
                    "email": booking_data["Email"],
                    "name": booking_data["Name"],
                    "tables": assigned_tables,
                    "payment_link": payment_link,
                }

                return {
                   "response": (
                       f"✅ Booking created for {booking_data['People']} people today at {booking_data['Time']}.\n"
                       f"🪑 Assigned table(s): {assigned_tables_str}\n"
                       f"💰 Total: ₹{total_amount}\n"
                       f"💳 Please complete your payment:\n{payment_link}"
                    ),
                   "payment_link": payment_link,
                }

            except Exception as err:
                print("❌ Booking Save Error:", err)
                return {"response": "⚠️ Booking saved, but issue occurred while updating the sheet."}

        # -----------------------------------------------------
# ✅ CASE 2: FUTURE DATE → NO TABLE ASSIGNMENT BUT PAYMENT LINK REQUIRED
# -----------------------------------------------------
        else:
            people = booking_data["People"]

    # 4 people per table rule still applies (for billing, not table assignment)
            tables_needed = math.ceil(people / 4)
            total_amount = tables_needed * 100

    # Generate payment link (same as today's)
            payment_link = create_stripe_checkout(
                amount=total_amount,
                description=f"Advance booking for {people} people on {booking_data['Date']}"
         )

            booking_data.update({
                "Assign_Table": "no",
                "Status": "Advance Booking - Pending Payment",
                "Created_At": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "Table_No": "",
                "Tables_Assigned": tables_needed,
                "Total_Amount": f"₹{total_amount}",
                "Payment_Link": payment_link
       })

    # Save to advance_booking sheet
            append_to_sheet("advance_booking", booking_data)

            return {
                "response": (
                    f"📅 Your advance reservation for {booking_data['Date']} at {booking_data['Time']} is recorded.\n"
                    f"💰 Total: ₹{total_amount}\n"
                    f"💳 Please complete payment to confirm your booking:\n{payment_link}\n"
                    f"🪑 Table number will be assigned on the arrival day."
                ),
                 "payment_link": payment_link
         }

class BookTableRequest(BaseModel):
    name: str = Field(..., min_length=2, description="Customer full name")
    email: EmailStr = Field(..., description="Customer email address")
    people: int = Field(..., gt=0, description="Number of people for the booking")
    date: str = Field(..., pattern=r"\d{4}-\d{2}-\d{2}", description="Booking date in YYYY-MM-DD")
    time: str = Field(..., pattern=r"\d{1,2}:\d{2}\s?(am|pm|AM|PM)?", description="Booking time")


def process_direct_booking(req: BookTableRequest):
    """
    Booking logic identical to handle_booking_logic(),
    but uses fields directly from frontend (no text parsing).
    """

    booking_data = {
        "Name": req.name,
        "Email": req.email,
        "People": req.people,
        "Date": req.date,
        "Time": req.time,
    }

    # Check missing fields
    if not all(booking_data.values()):
        missing = [k for k, v in booking_data.items() if not v]
        return {
            "response": f"Missing required fields: {', '.join(missing)}"
        }

    today = datetime.now().strftime("%Y-%m-%d")
    booking_date = booking_data["Date"]
    people = booking_data["People"]

    # ========== CASE 1 → BOOKING FOR TODAY ================
    if booking_date == today:

        table_data = get_sheet_data("table")
        available_tables = [
            t for t in table_data if str(t.get("Availability", "")).lower() == "yes"
        ]

        if not available_tables:
            return {"response": "😔 Sorry, all tables are booked right now."}

        tables_needed = math.ceil(people / 4)

        if len(available_tables) < tables_needed:
            return {
                "response": (
                    f"😔 Sorry, only {len(available_tables)} tables are available right now."
                )
            }

        # Assign tables
        assigned_tables = [t.get("Table") for t in available_tables[:tables_needed]]
        assigned_tables_str = ", ".join(assigned_tables)

        # Mark assigned tables unavailable
        for t in assigned_tables:
            update_sheet_row("table", "Table", t, {"Availability": "No"})

        # Payment
        total_amount = tables_needed * 100
        payment_link = create_stripe_checkout(
            amount=total_amount,
            description=f"Booking for {people} people ({tables_needed} table(s): {assigned_tables_str})"
        )

        # Save booking
        booking_data.update({
            "Assign_Table": "yes",
            "Table_No": assigned_tables_str,
            "Tables_Assigned": tables_needed,
            "Total_Amount": f"₹{total_amount}",
            "Payment_Link": payment_link,
            "Status": "Pending Payment",
            "Created_At": datetime.now().strftime("%Y-%m-%d %H:%M"),
        })

        append_to_sheet("bookings", booking_data)

        return {
            "response": (
                f"✅ Booking created for {people} people today.\n"
                f"🪑 Assigned tables: {assigned_tables_str}\n"
                f"💰 Total: ₹{total_amount}\n"
                f"💳 Complete payment:\n{payment_link}"
            ),
            "payment_link": payment_link,
        }

    # ========== CASE 2 → FUTURE DATE ================
    else:
        tables_needed = math.ceil(people / 4)
        total_amount = tables_needed * 100

        payment_link = create_stripe_checkout(
            amount=total_amount,
            description=f"Advance booking for {people} people on {booking_data['Date']}"
        )

        booking_data.update({
            "Assign_Table": "no",
            "Table_No": "",
            "Tables_Assigned": tables_needed,
            "Total_Amount": f"₹{total_amount}",
            "Payment_Link": payment_link,
            "Status": "Advance Booking - Pending Payment",
            "Created_At": datetime.now().strftime("%Y-%m-%d %H:%M"),
        })

        append_to_sheet("advance_booking", booking_data)

        return {
            "response": (
                f"📅 Advance reservation recorded for {booking_data['Date']} at {booking_data['Time']}.\n"
                f"💰 Total: ₹{total_amount}\n"
                f"💳 Complete your booking payment:\n{payment_link}\n"
                f"🪑 Table number will be assigned on arrival day."
            ),
            "payment_link": payment_link,
        }


def handle_cancel_logic(req, user_msg, user_msg_lower, session_id):
# ====================================================
# ❌ CANCEL ORDER LOGIC
# ====================================================
    cancel_keywords = ["cancel", "cancel my order", "remove my order", "delete order", "cancel booking"]

    if any(word in user_msg_lower for word in cancel_keywords):
        try:
            session_data = user_sessions.get(session_id, {})
            user_email = req.email if req.email != "guest@example.com" else session_data.get("email")
            user_name = req.name if req.name != "Guest User" else session_data.get("name", "Guest")

            if not user_email:
                return {"response": "⚠️ Please provide your email so I can process the cancellation request."}

            active_booking = get_active_booking(user_email)
            if not active_booking:
                return {"response": f"⚠️ No active booking or order found for {user_email} to cancel."}

            table_no = active_booking.get("Table_No") or active_booking.get("table_no", "N/A")


        # Log cancellation request for management review
            cancellation_entry = {
            "Customer_Name": user_name,
            "Email": user_email,
            "Table_No": table_no,
            "Request": user_msg,
            "Requested_At": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "Status": "Pending Review",
        }

            append_to_sheet("cancellations", cancellation_entry)

            return {
            "response": (
                f"🛑 Your cancellation request has been sent to our management team, {user_name}. "
                f"They’ll review your order linked to table #{table_no} and confirm shortly."
            )
        }

        except Exception as err:
            print("❌ Cancel Error:", err)
            return {"response": "⚠️ Something went wrong while sending your cancellation request."}

def handle_order_logic(req, user_msg, user_msg_lower, session_id, menu_data):
# ====================================================
# 🍽️ MENU / ORDER LOGIC
# ====================================================
    menu_keywords = ["menu", "show me menu", "see menu", "what do you have", "dishes","yes", "yeah", "yep", "ok", "okay","sure","of course"]
    order_keywords = ["order", "get me", "give me", "add", "take my order","i want", "i'd like", "i would like","i'll have","can i have"]

    # --- SHOW MENU ---
    if any(word in user_msg_lower for word in menu_keywords):
        if not menu_data:
            return {"response": "⚠️ Sorry, our menu is currently unavailable."}

        session_data = user_sessions.get(session_id, {})
        user_email = req.email if req.email != "guest@example.com" else session_data.get("email")

        personalized_menu = build_personalized_chat_menu(menu_data, user_email)

        menu_preview = "\n".join([
            f"• {m['Dish']} — ₹{m['Price']}{' ⭐' if m.get('Personalized') else ''}"
            for m in personalized_menu[:21]
        ])

        return {
            "response": (
                "🍽️ We serve **purely Indian vegetarian cuisine**, focusing on rich gravies and classic dishes.\n\n"
                "Here’s your menu (curated for you):\n"
                f"{menu_preview}\n\n"
                "Would you like to place an order?"
            )
        }

    # --- DETECT ORDER ---
    if any(word in user_msg_lower for word in order_keywords) or re.search(r"\d+\s+[a-zA-Z ]+", user_msg_lower):
        try:
            session_data = user_sessions.get(session_id, {})
            user_email = req.email if req.email != "guest@example.com" else session_data.get("email")
            user_name = req.name if req.name != "Guest User" else session_data.get("name")
            table_no = session_data.get("table")

            if not user_email:
                return {"response": "⚠️ You don’t have an active table booking yet. Please book a table first."}

            active_booking = get_active_booking(user_email)
            if not active_booking:
                print(f"⚠️ No active booking found for {user_email}")
                return {"response": f"⚠️ No active booking found for {user_email}"}

            table_no = active_booking.get("table_no", active_booking.get("Table_No", "N/A"))
            user_name = user_name or active_booking.get("name", active_booking.get("Name", "Guest"))

            # --- Just asking to order, no dish name ---
            if "order" in user_msg_lower and not re.search(r"\d+\s+[a-zA-Z ]+", user_msg_lower):
                return {"response": "🍽️ Sure! What would you like to order today? Try '2 Dal Tadka with extra butter'."}

            # --- Parse multi-dish orders ---
            items = [i.strip() for i in re.split(r",| and ", user_msg_lower) if i.strip()]
            responses = []
            order_list = []
            total_items = 0

            for item in items:
                match_order = re.search(r"(\d+)\s+([a-zA-Z\s]+?)(?: with (.*))?$", item)
                if not match_order:
                    continue

                quantity = int(match_order.group(1))
                dish_name = match_order.group(2).strip().title()
                toppings = match_order.group(3).strip().title() if match_order.group(3) else "None"

    # find the dish in menu
                match = next((m for m in menu_data if m.get("Dish", "").strip().lower() == dish_name.lower()), None)
                if not match:
                    responses.append(f"❌ Sorry, '{dish_name}' isn’t on our menu.")
                    continue

                base_price = float(match.get("Price", 0))
                table_multiplier = get_table_demand_multiplier()
                price = base_price * table_multiplier

                category = match.get("Category", "Main Course")
                total_price = price * quantity

                order_data = {
                   "Dish": dish_name,
                   "Category": category,
                   "Quantity": quantity,
                   "Price": f"₹{price:.0f} × {quantity} = ₹{total_price:.0f}",
                   "Toppings": toppings,
                   "Ordered_At": datetime.now().strftime("%Y-%m-%d %H:%M"),
                   "Customer_ID": normalize_email(user_email),
                   "Customer_Name": user_name,
                   "Table_No": table_no,
    }

                append_to_sheet("orders", order_data)
                order_list.append(order_data)
                responses.append(
                    f"✅ Got it! {quantity} × **{dish_name}** (with {toppings}) added to your order. 🍛"
    )
                total_items += 1

            if not responses:
                return {"response": "⚠️ Please mention the dish and quantity like '2 Dal Tadka, 3 Paneer Butter Masala'."}

# ✅ Calculate total amount
            total_amount = sum(float(m.get("Price").replace("₹", "").split("=")[-1].strip()) for m in order_list)

# ✅ Save the last order in session for payment step
            user_sessions[session_id] = user_sessions.get(session_id, {})
            user_sessions[session_id]["last_order"] = order_list
            user_sessions[session_id]["last_order_total"] = total_amount
            print("🧾 Last order stored in session:", user_sessions[session_id].get("last_order"))
            print("💰 Total order amount:", user_sessions[session_id].get("last_order_total"))

            return {
                "response": (
                    "\n".join(responses)
                    + f"\n\nServed soon at your table #{table_no}. 💬 Would you like to pay **Online** or **Cash**?"
           ),
           "awaiting_payment_mode": True,
           "order_data": order_list,
}

            
        except Exception as err:
            print("❌ Order Error:", err)
            return {"response": "⚠️ Something went wrong while placing your order."}

def handle_payment_logic(req, user_msg, user_msg_lower, session_id):
# ====================================================
# 💳 HANDLE PAYMENT MODE
# ====================================================
    if "online" in user_msg_lower or "cash" in user_msg_lower:
        try:
            session_data = user_sessions.get(session_id, {})
            user_email = req.email if req.email != "guest@example.com" else session_data.get("email")
            active_booking = get_active_booking(user_email)

            if not active_booking:
                return {"response": "⚠️ Please book a table first before selecting a payment mode."}

            table_no = active_booking.get("Table_No", "N/A")
            payment_mode = "Online" if "online" in user_msg_lower else "Cash"

        # ✅ Calculate total from last order stored in session
            last_order = session_data.get("last_order", [])
            order_total = 0

            for item in last_order:
                try:
                    # Extract numeric part from "₹250 × 2 = ₹500"
                    total_part = item["Price"].split("=")[-1].strip().replace("₹", "")
                    order_total += float(total_part)
                except Exception:
                    continue

        # Default to 500 if total not found (fallback)
            if order_total <= 0:
                order_total = 500

        # ✅ Create Stripe link for the real total
            payment_link = None
            if payment_mode == "Online":
                payment_link = create_stripe_checkout(
                    int(order_total),
                    f"Order Payment for {user_email} (Table {table_no})"
                )

            append_to_sheet("orders", {
                  "Customer_ID": normalize_email(user_email),
                  "Table_No": table_no,
                  "Payment_Mode": payment_mode,
             })

            if payment_mode == "Online":
                return {
                   "response": (
                    f"💳 Your total is ₹{order_total:.0f}. Please pay online using this link:\n{payment_link}"
                )
            }
            else:
                return {
                   "response": (
                        f"💰 Payment mode set to **Cash** for total ₹{order_total:.0f}. "
                        "Please pay at the counter after your meal."
                    )
                }

        except Exception as e:
            print("❌ Payment Mode Error:", e)
            return {"response": "⚠️ Something went wrong while updating payment mode."}

def handle_complaint_logic(req, user_msg, user_msg_lower, session_id):
    # ====================================================
    # ⚠️ CUSTOMER COMPLAINT DETECTION & LOGGING (Improved)
    # ====================================================
    complaint_keywords = [
        "insect", "hair", "bad", "cold", "late", "dirty", "wrong",
        "issue with order", "issue with food", "food issue", "food complaint",
        "complaint", "not good", "issue", "spoiled", "smell", "stale", "fly",
        "worm", "cockroach", "problem with my order", "food was terrible",
        "very disappointed", "unhygienic", "food poisoning", "found a bug",
        "rotten", "undercooked", "overcooked", "rude staff", "long wait time",
        "poor service", "unacceptable", "terrible experience", "never coming back",
        "extremely dissatisfied", "worst meal ever", "completely ruined my dining experience",
        "felt sick after eating", "food quality was subpar", "extremely disappointed with the service",
        "the dish was inedible", "found something disgusting in my food", "i saw a bug",
        "something unusual in my food", "found something unusual", "unusual thing in my food",
        "weird thing in my food"
    ]

    try:
        # ✅ Detect complaint intent — direct or indirect
        is_complaint = (
            any(word in user_msg_lower for word in complaint_keywords)
            or ("unusual" in user_msg_lower and "food" in user_msg_lower)
            or ("staff" in user_msg_lower and "food" in user_msg_lower)
            or ("send your staff" in user_msg_lower)
        )

        if not is_complaint:
            return None  # Not a complaint, skip this handler

        # --- Get session info ---
        session_data = user_sessions.get(session_id, {})
        user_email = req.email if req.email != "guest@example.com" else session_data.get("email")
        user_name = req.name if req.name != "Guest User" else session_data.get("name", "Guest")

        if not user_email:
            return {
                "response": "⚠️ Could not identify your booking. Please provide your email address so we can assist you quickly.",
                "complaint_logged": False
            }

        # --- Check active booking ---
        active_booking = get_active_booking(user_email)
        if not active_booking:
            return {
                "response": "⚠️ No active booking found for today or within the allowed time window.",
                "complaint_logged": False
            }

        # --- Extract table info ---
        table_no = "Unknown"
        table_field = str(active_booking.get("Table_No", "")).strip()
        if table_field:
            table_list = [t.strip() for t in table_field.replace(" ", "").split(",") if t.strip()]
            if table_list:
                table_no = ", ".join(table_list)
        elif session_data.get("tables"):
            table_no = ", ".join(session_data["tables"])

        # --- Prepare complaint text ---
        complaint_text = f"User from Table No. {table_no} complained: '{user_msg}'"

        # --- Log to Google Sheet ---
        append_to_sheet("Complaints", {
            "Customer_Name": user_name,
            "Email": user_email,
            "Table_No": table_no,
            "Complaint": user_msg,
            "Time": datetime.now(IST).strftime("%Y-%m-%d %I:%M %p"),
            "Status": "Pending Review"
        })

        return {
            "response": "😔 I'm really sorry to hear that! Your complaint has been raised and our staff will assist you shortly.",
            "complaint_logged": True,
            "details": complaint_text
        }

    except Exception as err:
        print("❌ Complaint Logging Error:", err)
        return {
            "response": "⚠️ Sorry, we couldn’t log your complaint due to a system issue. Please inform our staff directly.",
            "complaint_logged": False
        }


# -------------------------------
# Models (Pydantic)
# -------------------------------
class RegisterRequest(BaseModel):
    Name: str
    Email: str
    Password: str

class LoginRequest(BaseModel):
    Email: str
    Password: str

class ChatRequest(BaseModel):
    message: str
    email: Optional[str] = "guest@example.com"
    name: Optional[str] = "Guest User"

class OrderItem(BaseModel):
    id: str
    name: str
    price: float
    quantity: int

class OrderRequest(BaseModel):
    session_id: str
    name: str
    email: str
    items: list[OrderItem]

class PaymentRequest(BaseModel):
    session_id: str
    payment_mode: str  # "Online" or "Cash"


# -------------------------------
# API Routes
# -------------------------------

## Core Status/Health Check
@app.get("/")
def home():
    """Simple health check endpoint."""
    return {"message": "🍛 Fifty Shades Of Gravy Backend is running successfully!"}

## Authentication
@app.post("/register")
async def register_user(req: RegisterRequest):
    """Registers a new user and stores them in the 'users' Google Sheet."""
    Email = normalize_email(req.Email)
    existing = find_user_by_email(Email)
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    hashed_pw = hash_password(req.Password)
    user_data = {
        "Name": req.Name,
        "Email": Email,
        "Password_Hash": hashed_pw,
        "Created_At": datetime.now().strftime("%Y-%m-%d %H:%M")
    }

    append_to_sheet("users", user_data)
    return {"message": "✅ Registration successful", "user": {"Name": req.Name, "Email": Email}}

@app.post("/login")
def login_user(req: LoginRequest):
    """Authenticates a user and returns a JWT token."""
    email = normalize_email(req.Email)
    user = find_user_by_email(email)
    if not user or not verify_password(req.Password, user.get("Password_Hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_jwt(email)
    return {
        "message": "✅ Login successful",
        "token": token,
        "user": {"Name": user.get("Name"), "Email": email}
    }

# Load service account info from environment
SERVICE_ACCOUNT_INFO = json.loads(os.environ.get("GOOGLE_SERVICE_JSON"))
SPREADSHEET_ID = os.environ.get("GOOGLE_SHEET_ID")

@app.get("/api/menu")
async def get_menu(customer_email: str | None = None):
    try:
        credentials = service_account.Credentials.from_service_account_info(
            SERVICE_ACCOUNT_INFO,
            scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
        )

        service = build("sheets", "v4", credentials=credentials)
        sheet = service.spreadsheets()

        result = sheet.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range="menu!A2:D"
        ).execute()

        rows = result.get("values", [])

        # 🔥 Table-demand surge
        multiplier = get_table_demand_multiplier()

        # -----------------------------
        # 1️⃣ BUILD MENU FIRST
        # -----------------------------
        menu_items = []
        for r in rows:
            if len(r) < 4:
                continue

            try:
                base_price = float(r[2].replace("₹", "").strip())
                final_price = round(base_price * multiplier, 2)
                time = int(r[3])
            except:
                continue

            menu_items.append({
                "Dish": r[0],
                "Category": r[1],
                "BasePrice": base_price,
                "Price": final_price,
                "SurgeApplied": multiplier > 1,
                "Time": time
            })

        # -----------------------------
        # 2️⃣ PERSONALIZE MENU
        # -----------------------------
        if customer_email:
            customer_id = normalize_email(customer_email)

            recent_orders = get_user_recent_orders(customer_id)
            preferred_keywords = extract_preferred_keywords(recent_orders)
            frequent_user = is_frequent_customer(customer_id)

            if preferred_keywords:
                preferred_items = []
                other_items = []

                for item in menu_items:
                    dish_name = item["Dish"].lower().strip()

                    if any(k in dish_name for k in preferred_keywords):
                        # 🔺 Increase price for preferred items
                        item["Price"] += 10 if frequent_user else 5
                        item["Personalized"] = True
                        preferred_items.append(item)
                    else:
                        # 🔽 Slightly decrease price for others
                        item["Price"] = max(0, item["Price"] - 5)
                        item["Personalized"] = False
                        other_items.append(item)

                # 👑 Preferred dishes always on top
                menu_items = preferred_items + other_items

        return menu_items

    except Exception as e:
        return {"error": str(e)}


@app.post("/book-table")
def book_table(req: BookTableRequest):

    result = process_direct_booking(req)

    return result

@app.post("/order")
def place_order(req: OrderRequest):
    try:
        # --- Step 1: Check if user has active booking ---
        active_booking = get_active_booking(req.email)
        if not active_booking:
            return {"response": f"⚠️ No active booking found for {req.name} ({req.email}). Please book a table first."}

        table_no = active_booking.get("Table_No", "N/A")
        order_list = []
        responses = []

        # --- Step 2: Process each item ---
        for item in req.items:
            if item.quantity <= 0:
                continue

            order_data = {
                "Dish": item.name,
                "Category": "Main Course",  # You can customize category lookup if needed
                "Quantity": item.quantity,
                "Price": f"₹{item.price:.0f} × {item.quantity} = ₹{item.price * item.quantity:.0f}",
                "Toppings": "None",
                "Ordered_At": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "Customer_ID": normalize_email(req.email),
                "Customer_Name": req.name,
                "Table_No": table_no,
            }

            append_to_sheet("orders", order_data)
            order_list.append(order_data)
            responses.append(f"✅ Got it! {item.quantity} × **{item.name}** added to your order. 🍛")

        if not responses:
            return {"response": "⚠️ No valid items to order."}

        # --- Step 3: Save order in session for payment ---
        total_amount = sum(item.price * item.quantity for item in req.items)
        user_sessions[req.session_id] = {
            "last_order": order_list,
            "last_order_total": total_amount,
            "user_email": req.email,
            "user_name": req.name,
            "table_no": table_no,
        }

        # --- Step 4: Ask for payment ---
        return {
            "response": (
                "\n".join(responses)
                + f"\n\nServed soon at your table #{table_no}. 💬 Would you like to pay **Online** or **Cash**?"
            ),
            "awaiting_payment_mode": True,
        }

    except Exception as e:
        print("❌ Order Error:", e)
        raise HTTPException(status_code=500, detail="Something went wrong while placing your order.")


# -------------------------------
# /payment Endpoint
# -------------------------------
@app.post("/payment")
def handle_payment(req: PaymentRequest):
    try:
        session_data = user_sessions.get(req.session_id, {})
        if not session_data:
            raise HTTPException(status_code=400, detail="No active order found for this session.")

        last_order = session_data.get("last_order", [])
        order_total = session_data.get("last_order_total", 0)
        user_email = session_data.get("user_email")
        table_no = session_data.get("table_no")

        if req.payment_mode.lower() not in ["online", "cash"]:
            raise HTTPException(status_code=400, detail="Payment mode must be 'Online' or 'Cash'.")

        payment_mode = "Online" if req.payment_mode.lower() == "online" else "Cash"

        payment_link = None
        if payment_mode == "Online":
            payment_link = create_stripe_checkout(
                int(order_total),
                f"Order Payment for {user_email} (Table {table_no})"
            )

        # Update orders sheet
        append_to_sheet("orders", {
            "Customer_ID": normalize_email(user_email),
            "Table_No": table_no,
            "Payment_Mode": payment_mode,
        })

        # ---------------------------
        # RETURN PROPER PAYMENT URL
        # ---------------------------
        if payment_mode == "Online":
            return {
                "response": f"💳 Your total is ₹{order_total:.0f}. Redirecting to payment...",
                "payment_url": payment_link,
                "awaiting_payment": False,
                "status": "success"
            }

        # Cash
        return {
            "response": f"💰 Payment mode set to **Cash** for ₹{order_total:.0f}. Please pay at the counter.",
            "status": "success"
        }

    except Exception as e:
        print("❌ Payment Error:", e)
        raise HTTPException(status_code=500, detail="Something went wrong while updating payment mode.")

    

## The AI Chatbot
@app.post("/chatbot")
async def chatbot(req: ChatRequest):
    """
    🤖 Restaurant Chatbot for Fifty Shades of Gravy
    Uses Gemini for intent detection + manual logic for bookings, orders, etc.
    """

    user_msg = req.message.strip()
    user_msg_lower = user_msg.lower()
    session_id = req.email or "guest@example.com"
    
    # 📝 0️⃣ Fetch booking info for the user
    bookings = get_sheet_data("bookings")
    user_email = req.email or "guest@example.com"

    user_booking = next(
        (b for b in bookings if b.get("Email") == user_email),
        None
    )

    # Prepare a booking context string for Gemini
    if user_booking:
        booking_context = (
            f"User has a booking: Table {user_booking.get('Table_No')}, "
            f"Date: {user_booking.get('Date')}, "
            f"Time: {user_booking.get('Time')}."
        )
    else:
        booking_context = "User has no booking."

    # ====================================================
    # 🧠 1️⃣ INTENT DETECTION USING GEMINI (NATURAL LANGUAGE)
    # ====================================================
    try:
        import difflib

        intent_prompt = f"""
        You are an intent classifier for a restaurant chatbot called 'Fifty Shades of Gravy'.
        Possible intents:
        - order_food
        - book_table
        - cancel_booking
        - cancel_order
        - complaint
        - menu_info
        - payment_mode
        - location
        - guide_table
        - meet_manager
        - general_chat

        If the user's message clearly matches one of these, return that intent.
        Otherwise, classify it as **"general_chat"** and let the AI generate a natural, helpful response itself.
        Examples:
        - "I want to book a table for 2 at 8 PM" → book_table
        - "Cancel my booking for tomorrow" → cancel_booking
        - "I want butter naan and dal tadka" → order_food
        - "If the user asks for directions, address, or where " → location
        - If the user asks about *other outlets, branches, areas*, or *expansion plans* → general_chat
        - "I have an issue with my order" → complaint
        - "I want to meet the manager" → meet_manager
        - "Can I talk to staff?" → meet_manager
        - "Please send your manager" → meet_manager
        - "Hi" / "How are you?" → general_chat
        - "Cancel my food order" → cancel_order
        - "I want to cancel my food" → cancel_order
        - "Cancel the biryani I ordered" → cancel_order
        - "Cancel my meal" → cancel_order
        - "online" → payment_mode
        - "I want to pay online" → payment_mode
        - "cash" → payment_mode
        - "Pay by cash" → payment_mode
        - "I want to pay via UPI" → payment_mode
        - "where is my table?" or "please guide me to my booked table" → guide_table

        Guidelines:
        - If the user asks "Where is my table?" or "Please guide me to my booked table":
        - First, check the booking info provided below.
        - If a booking exists, respond with the Table Number, Date, and Time directly.
        - If no booking exists, politely ask for their name or email.
        - Always respond ONLY with one of the above intents.

        Booking context for this user:
        {booking_context}

        Respond ONLY with one of the above intent labels .
        User message: "{user_msg}"
        """

        intent_raw = (await call_gemini(intent_prompt)).strip().lower()
        print(f"🎯 Raw Intent from Gemini: {intent_raw}")

        valid_intents = [
            "order_food",
            "book_table",
            "cancel_booking",
            "cancel_order",
            "complaint",
            "menu_info",
            "payment_mode",
            "location",
            "meet_manager",
            "guide_table",
            "general_chat",
     ]


        # ✅ Step 1: Clean up intent (remove punctuation, spaces)
        intent = intent_raw.replace(".", "").replace("-", "_").strip()

        # ✅ Step 2: Smart correction for near-misses
        closest = difflib.get_close_matches(intent, valid_intents, n=1, cutoff=0.6)
        if closest:
            intent = closest[0]

        # ✅ Step 3: Fallback recheck with context if still invalid
        if intent not in valid_intents:
            print(f"⚠️ Unknown intent: {intent_raw}. Rechecking with Gemini...")
            recheck_prompt = f"""
            Classify this user message into one of these intents only:
            {', '.join(valid_intents)}.

            User message: "{user_msg}"
            Reply with only the intent name, nothing else.
            """
            try:
                recheck_raw = await call_gemini(recheck_prompt)
                intent = recheck_raw.strip().lower()
                if intent not in valid_intents:
                    intent = "general_chat"
            except Exception as e:
                print("⚠️ Intent recheck failed:", e)
                intent = "general_chat"

        print(f"✅ Final Intent Used: {intent}")

    except Exception as e:
        print("⚠️ Intent detection failed:", e)
        intent = "general_chat"



    # Save last intent for context
    user_sessions[session_id] = user_sessions.get(session_id, {})
    # 🧾 Store conversation history for context
    user_sessions[session_id].setdefault("messages", [])
    user_sessions[session_id]["messages"].append({"from": "user", "text": user_msg})

    user_sessions[session_id]["last_intent"] = intent

    # ====================================================
    # 📦 2️⃣ LOAD MENU DATA (SAFE FALLBACK)
    # ====================================================
    try:
        menu_data = get_sheet_data("menu")
    except Exception:
        menu_data = []

    # ====================================================
    # 🚦 3️⃣ INTENT ROUTING
    # ====================================================

    if intent == "book_table":
        return handle_booking_logic(req, user_msg, user_msg_lower, session_id)

    elif intent in ["cancel_booking","cancel_order" , ]:
        return handle_cancel_logic(req, user_msg, user_msg_lower, session_id)

    elif intent == "order_food":
        return handle_order_logic(req, user_msg, user_msg_lower, session_id, menu_data)

    elif intent == "complaint":
        return handle_complaint_logic(req, user_msg, user_msg_lower, session_id)

    elif intent == "menu_info":
        customer_email = req.email if req.email != "guest@example.com" else None

        if not menu_data:
            return {
                "response": (
                    "🍽️ We serve **purely Indian vegetarian cuisine**, focusing on rich gravies and classic dishes.\n\n"
                    "Would you like to see our full menu?"
                ),
                "intent": "menu_info"
            }

    # 🔥 USE SINGLE SOURCE OF TRUTH
        personalized_menu = build_personalized_chat_menu(menu_data, customer_email)

        menu_preview = "\n".join(
            [
                f"• {m['Dish']} — ₹{m['Price']}{' ⭐' if m.get('Personalized') else ''}"
                for m in personalized_menu[:21]
            ]
        )

        return {
            "response": (
                "🍽️ We serve **purely Indian vegetarian cuisine**, focusing on rich gravies and classic dishes.\n\n"
                "Here’s your menu (curated for you):\n"
                f"{menu_preview}\n\n"
                "Would you like to place an order?"
            ),
            "intent": "menu_info"
    }
    
    elif intent == "payment_mode":
        return handle_payment_logic(req, user_msg, user_msg_lower, session_id)

    elif intent == "location":
        return {
            "response": (
                "📍 We’re located at **Fifty Shades of Gravy**, Koramangala, Bengaluru, near Forum Mall.\n\n"
                "🕒 Open Hours: 11:00 AM – 11:00 PM\n"
                "📞 Contact: +91 98765 43210\n"
                "📬 Google Maps: [View on Maps](https://goo.gl/maps/abc123)"
            ),
            "intent": "location"
        }

    elif intent == "meet_manager":
        # Get user's booking details from Google Sheet if available
        bookings = get_sheet_data("bookings")
        user_booking = next(
             (b for b in bookings if b.get("Email") == (req.email or "guest@example.com")),
             None
        )

        # Fallbacks if no booking found
        table_no = user_booking["Table_No"] if user_booking else "N/A"
        booking_date = user_booking["Date"] if user_booking else "N/A"
        booking_time = user_booking["Time"] if user_booking else "N/A"

        # Create manager request entry
        from datetime import datetime
        manager_request = {
            "Name": req.name or "Guest",
            "Email": req.email or "guest@example.com",
            "Table_No": table_no,
            "Booking_Date": booking_date,
            "Booking_Time": booking_time,
            "Request": "Meet Manager",
            "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "Status": "Pending",
        }

        append_to_sheet("manager", manager_request)

        return {
            "response": (
                "👨‍🍳 I've raised a request for you to meet the manager. "
                "Someone from our staff will come to your table shortly. 😊"
            ),
            "intent": "meet_manager",
        }
    elif intent == "guide_table":
        if user_booking:
            booking_date = format_entry(user_booking.get("Date"))
            
            return {
                "response": (
                    f"📌 Your booking is confirmed!\n"
                    f"Date: {booking_date}\n"
                    f"Table Number: {user_booking.get('Table_No')}\n\n"
                    "Please head to this table when you arrive. Enjoy your meal! 🍽️"
                ),
                "intent": "guide_table"
         }
        else:
            return {
                "response": (
                    "I couldn't find a booking linked to your account/email. "
                    "Can you please provide your name or email used for the booking?"
                ),
                "intent": "guide_table"
            }

# ====================================================
# 💬 4️⃣ FALLBACK TO GEMINI GENERAL CHAT OR UNKNOWN INTENT
# ====================================================
    allowed_intents = [
        "order_food", "book_table", "cancel_booking","cancel_order",
        "complaint", "menu_info", "location",
        "meet_manager", "general_chat","guide_table"
    ]

    if intent not in allowed_intents:
        print(f"⚠️ Unknown intent '{intent}', using Gemini general response instead.")
        intent = "general_chat"

    try:
    # Fetch last 3 exchanges for conversational context
        history = user_sessions[session_id].get("messages", [])[-3:]
        context_text = "\n".join([f"{m['from']}: {m['text']}" for m in history])

        prompt = f"""
        You are a friendly restaurant assistant for 'Fifty Shades of Gravy' in Koramangala, Bengaluru.

        The customer may ask about:
        - Catering, delivery, lost items, or special events
        - Menu recommendations, prices, or availability
        - Any general questions not covered by other intents

        🧭 Guidelines:
        - Always respond naturally and conversationally (2–4 sentences)
        - If it's about a lost item, show empathy and suggest contacting the restaurant
        - If it's about catering or delivery, explain politely what the restaurant does
        - Never say "I'm having trouble responding" or "I don't know"
        - Mention the restaurant name where relevant

        Context from last few messages:
        {context_text}
    
        User: "{user_msg}"
        """

        response_text = await call_gemini(prompt)

        return {
            "response": response_text.strip(),
            "intent": "general_chat"
        }

    except Exception as e:
        print("⚠️ Gemini general_chat fallback error:", e)
        return {
            "response": (
                "🙏 Sorry, I'm having a bit of trouble replying right now. "
                "Please contact our staff directly at +91 98765 43210 for quick help."
            ),
            "intent": "general_chat"
        }




# ====================================================
# 💳 STRIPE WEBHOOK HANDLER
# ====================================================
@app.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    """Handles Stripe webhook events to mark payments as completed."""
    try:
        payload = await request.body()
        sig_header = request.headers.get("stripe-signature")

        # ✅ Verify webhook signature (secure)
        try:
            event = stripe.Webhook.construct_event(
                payload,
                sig_header,
                STRIPE_SECRET_KEY  # ideally use STRIPE_WEBHOOK_SECRET if you set it
            )
        except stripe.error.SignatureVerificationError as e:
            print("⚠️ Stripe Signature verification failed:", e)
            return {"status": "invalid signature"}

        # ✅ Handle successful payment event
        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            customer_email = session.get("customer_details", {}).get("email", "")
            amount_total = session.get("amount_total", 0) / 100

            # Create a record to mark payment complete
            update_entry = {
                "Email": customer_email,
                "Payment_Status": "Completed",
                "Amount_Paid": f"₹{amount_total:.0f}",
                "Updated_At": datetime.now().strftime("%Y-%m-%d %H:%M"),
            }

            # Append this info to both sheets
            append_to_sheet("bookings", update_entry)
            append_to_sheet("orders", update_entry)

            print(f"✅ Payment completed for {customer_email}: ₹{amount_total:.0f}")
            return {"status": "success"}

        # ✅ Ignore other event types
        print(f"ℹ️ Ignored event type: {event['type']}")
        return {"status": "ignored"}

    except Exception as e:
        print("❌ Stripe Webhook Error:", e)
        return {"status": "error", "message": str(e)}


# ====================================================
# 🛠️ CANCELLATION STATUS CHECKER
# ====================================================

# ✅ Global notifications list
notifications = []

@app.get("/notifications")
async def get_notifications():
    """Frontend polls this endpoint to show the latest system messages."""
    return {"notifications": notifications[-20:]}  # send only last 20

@app.post("/cancellation_update")
async def cancellation_update(data: Dict[str, Any]):
    """
    ✅ Triggered instantly when management updates 'Status' in Google Sheets.
    Sends real-time notification to user based on approval/rejection
    and stores the message for frontend notification bar.
    """
    try:
        customer_name = data.get("Customer_Name", "Guest")
        email = data.get("Email")
        table_no = data.get("Table_No", "N/A")
        status = data.get("Status", "").strip().lower()

        if not email or not status:
            return {"status": "error", "message": "Missing email or status field"}

        # Define response messages based on status
        if status == "cancelled":
            message = f"✅ Hi {customer_name}, your order linked to table {table_no} has been successfully cancelled."
        elif status == "rejected":
            message = f"❌ Sorry {customer_name}, your cancellation request for table {table_no} was not approved."
        else:
            message = f"ℹ️ Your request for table {table_no} is still under review."

        # Send live chatbot message if user is active
        if email in user_sessions:
            session = user_sessions[email]
            session.setdefault("chat", [])
            session["chat"].append({
                "from": "system",
                "text": message,
                "timestamp": datetime.now().isoformat()
            })
            print(f"📨 Notified {email}: {message}")
        else:
            print(f"⚠️ No active chatbot session found for {email}. Message: {message}")

        # ✅ Store notification for frontend NotificationBar
        notifications.append({
            "email": email,
            "message": message
        })
        if len(notifications) > 50:  # keep only latest 50 messages
            notifications.pop(0)

        return {"status": "success", "message": f"Notification sent and stored for {email}"}

    except Exception as e:
        print(f"❌ Error in /cancellation_update: {e}")
        return {"status": "error", "message": str(e)}


# ====================================================
# 🐞 DEBUG ROUTE FOR BOOKINGS
# ====================================================

@app.get("/debug/bookings")
async def debug_bookings(email: str = Query(..., description="User email to check booking")):
    """
    Debug route:
    - Fetches raw bookings data from Google Sheets
    - Checks if an active booking exists for the given email
    """
    try:
        print(f"🔍 Checking active booking for: {email}")

        # 1️⃣ Raw sheet data
        raw_data = get_sheet_data("bookings")

        # 2️⃣ Active booking for the given email
        active_booking = get_active_booking(email)

        # Print for console log debugging
        print("\n--- RAW BOOKINGS DATA ---")
        print(raw_data)
        print("\n--- ACTIVE BOOKING FOUND ---")
        print(active_booking)

        return {
            "email_checked": email,
            "raw_data_type": type(raw_data).__name__,
            "total_rows": len(raw_data) if isinstance(raw_data, list) else "unknown",
            "sample_first_row": raw_data[0] if isinstance(raw_data, list) and raw_data else None,
            "active_booking": active_booking or "⚠️ No active booking found",
        }

    except Exception as e:
        print(f"❌ Error in /debug/bookings: {e}")
        return {"error": str(e)}


# ====================================================
# 💬 DEFAULT CHAT RESPONSE
# ====================================================
    return {"response": "👋 Hi there! I can help you book a table or place an order. What would you like to do?"}