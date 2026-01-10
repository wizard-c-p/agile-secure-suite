# 🚀 Agile Suite Enterprise v2.0

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Firebase](https://img.shields.io/badge/Firebase-Realtime-orange)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38bdf8)
![AI](https://img.shields.io/badge/AI-Groq%20Llama%203.3-purple)

> A modern, real-time, AI-powered Agile collaboration platform featuring Planning Poker and Retrospective Boards. Built with a "Security First" mindset and Enterprise-grade architecture.

**[🔗 Live Demo Link Here](https://imaginative-sunburst-c1975f.netlify.app/)**


---

## ✨ Key Features

### 🃏 Planning Poker 2.0
* **🤖 AI as a Player:** Uses **Groq (Llama 3.3)** to analyze tasks. The AI participates in the session as a bot, revealing its card and reasoning alongside the team.
* **Real-time Synchronization:** Powered by Firebase Firestore snapshots for instant state updates across all clients.
* **Smart Session Management:**
    * **Persistent Admin:** Admin rights persist via 365-day secure cookies AND server-side Firestore validation.
    * **Succession Planning:** If an admin leaves, the system automatically promotes the most senior member.
* **Task Management:** Create, edit, delete, and reorder tasks with URL support.
* **Voting Logic:** Fibonacci sequence, Auto-Reveal toggle, and Re-Vote capabilities.

### 🚀 Retrospective Board
* **Modern UI/UX:** Inspired by Parabol.co using Glassmorphism, vibrant gradients, and smooth transitions.
* **Atomic Voting:** Separate `Likes` and `Dislikes` counters (no simple net score) to capture controversial topics.
* **Interactive Columns:** Start, Stop, Continue zones with modal-based CRUD operations.
* **One-Click Sharing:** Instant invite link copying with Toast notifications.

---

## 🛠️ Tech Stack

* **Frontend:** Next.js 14 (App Router), React, Tailwind CSS (Zinc/Slate aesthetic).
* **Backend / DB:** Firebase Firestore (NoSQL).
* **AI Engine:** Groq API (Llama-3.3-70b-versatile).
* **Security:** Middleware for CSP (Content Security Policy), HSTS, and Input Sanitization.
* **State Management:** React Context API + Firestore Listeners.

---

## 🛡️ Red Team & Security Protocols

This project was built with a security-first approach:
1.  **Privilege Escalation Prevention:** Server-side validation of `adminUid` prevents client-side tampering.
2.  **Environment Isolation:** All API keys are strictly externalized to `.env.local`.
3.  **XSS Protection:** Input sanitization on all user-generated content (Tasks, Retro Notes).
4.  **Secure Headers:** Implementation of HSTS and `X-Frame-Options: DENY` via Next.js Middleware.

---

## 🚀 Getting Started

### Prerequisites
* Node.js 18+
* A Firebase Project
* A Groq API Key

### Installation

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/wizard-c-p/agile-suite.git](https://github.com/wizard-c-p/agile-suite.git)
    cd agile-suite
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**
    Create a `.env.local` file in the root directory:
    ```env
    # Firebase Config (Client Side)
    NEXT_PUBLIC_FIREBASE_API_KEY=your_key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

    # Groq AI (Server Side)
    GROQ_API_KEY=gsk_your_groq_key
    ```

4.  **Run the development server**
    ```bash
    npm run dev
    ```

Open [http://localhost:3000](http://localhost:3000) with your browser.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---
*Built with ❤️ by [Can]*
