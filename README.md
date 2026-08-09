# 🛡️ NutriGuard - Personal Food Guard & Assistant

## ⚠️ The Problem Statement
Reading food product labels is a struggle. Ingredients lists are printed in microscopic fonts, filled with obscure chemical terms, and hide dangerous allergens behind unfamiliar names. For people managing chronic conditions (like diabetes or kidney disease), severe food allergies (like peanut or gluten), or specific lifestyle diets (like Vegetarian or Vegan), shopping for food is a high-risk guessing game. Standard Nutri-Scores only give a generic grade—they don't tell you if a product is safe for *your* specific body.

## 🛡️ Our Proposed Solution
**NutriGuard** is a personalized, real-time agentic food safety scanner and nutrition auditing platform. Instead of general food grades, it establishes a **personalized Health Shield** based on the user's allergies, diet baselines, and health goals. 

When a user scans a barcode or uploads a label photo:
1. **OCR ingredient parsing** transcribes packaging lists instantly.
2. The engine audits ingredients against the user's specific health profiles.
3. **If even a single check doesn't align** (an allergen is triggered, diet baseline mismatches, or a health goal fails), the product is flagged as **UNSAFE** with a clear explanation of what violated their profile and a list of safe, healthy alternatives.

---

## 🔌 Public Database Integration
NutriGuard integrates directly with the **Open Food Facts API**, a free, open-source, crowdsourced public database of food products from around the world. 
*   **Live Data Feeds:** By connecting to the public database, the app accesses ingredient lists, brand tags, calorie breakdowns, and nutrient percentages for millions of barcodes.
*   **Robust Fallback Layer:** Since public APIs can occasionally rate-limit developer requests, NutriGuard implements a smart local mock fallback database mapping major products (Quaker Oats, Lay's, Nutella, Coca-Cola, Oreo) so that local testing always works instantly.

---

## ⚙️ Architecture & Tech Stack

```mermaid
graph TD
    A[Vite + React Frontend] -->|API Requests| B[Node.js + Express Backend]
    B -->|Fetch Barcode/Search| C[Open Food Facts Public API]
    B -->|Resilient Query Interface| D[PostgreSQL DB / In-Memory Mock Store]
    A -->|OCR Ingredients Scanner| E[Tesseract.js]
    A -->|Static Barcode Scanner| F[html5-qrcode]
```

### 1. Frontend (React + Vite)
*   **Webcam Barcode Scanning:** Integrates `html5-qrcode` to read barcodes directly from a camera feed or photo uploads.
*   **OCR Ingredient Auditing:** Integrates `Tesseract.js` on the client side to convert ingredient label photos into raw text blocks for backend matching.
*   **Interactive AI Chatbot widget:** Built-in floating robot (`🤖`) nutrition helper that functions offline (using local safety logs) or online using Google's **Gemini AI API** if a key is provided.

### 2. Backend (Node.js + Express)
*   **Allergen Matcher Engine:** Uses word boundaries and spelling variations to check ingredient text for allergen triggers.
*   **Goal Evaluator:** Audits nutrient values per 100g against FDA Daily Value (% DV) standards.
*   **Resilient DB Layer:** Automatically defaults to a pre-populated in-memory JavaScript cache if PostgreSQL is offline, ensuring the app works 100% out-of-the-box.

---

## 🔄 User Workflow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant App as React Frontend
    participant Server as Express Backend
    participant OpenFoodFacts as Open Food Facts API

    User->>App: Set Health Profile (Allergies, Goals, Diets)
    App->>Server: Update profile preferences in DB
    User->>App: Input Barcode or Upload Label Photo
    Note over App: If photo is ingredients label, Tesseract OCR converts it to text
    App->>Server: Request Product Analysis (barcode or OCR text)
    alt is Barcode
        Server->>OpenFoodFacts: Fetch product details from public database
        OpenFoodFacts-->>Server: Return ingredients and nutrients
    end
    Server->>Server: Audit ingredients against User Profile allergies & goals
    Server->>Server: Save analysis result to Scan History
    Server-->>App: Return Safety Report & Compatible Alternatives
    App-->>User: Display Safe/Warning/Danger report
```

---

## 🚀 Setup & Execution Guide

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 1. Run the Backend API
1.  Navigate into the `backend` folder:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the Node server:
    ```bash
    node server.js
    ```
    *The server will initialize and listen on `http://localhost:4000`.*

### 2. Run the Frontend Dashboard
1.  Navigate into the `frontend` folder:
    ```bash
    cd ../frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the Vite dev server:
    ```bash
    npm run dev
    ```
    *The frontend will boot up instantly on `http://localhost:5173/`.*

---

## 🧪 Testing Mock Barcodes
You can copy and paste these barcodes into the search bar to test safety outputs immediately (no PostgreSQL setup required):

*   **030000010206** (Quaker Oats) ➔ **SAFE** 🟢 (High Fiber, High Protein)
*   **028400199148** (Lay's Chips) ➔ **WARNING** 🟡 (High Sodium)
*   **049000028904** (Coca-Cola Classic) ➔ **DANGER** 🔴 (High Sugar, triggers Diabetic-Safe warnings)
