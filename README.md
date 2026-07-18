# 🏥 Heal Sphere — AI-Powered Healthcare Triage Platform

**Heal Sphere** is an intelligent healthcare triage system that leverages **Google Gemini AI** to analyze patient symptoms in real-time and deliver instant, prioritized medical assessments. Built for speed and accuracy, it combines cutting-edge AI with a robust rule-based fallback engine — ensuring it works reliably even without an API key.

## ✨ What It Does

Patients enter their symptoms and vital signs, and Heal Sphere instantly:
- 🔍 **Identifies potential conditions** with confidence scores
- 🚨 **Assigns a triage priority** (HIGH / MEDIUM / LOW) based on severity
- 📊 **Calculates a risk score** (0–100) factoring in vitals and demographics
- 💊 **Provides actionable recommendations** and immediate actions
- 📈 **Logs all assessments** to a cloud dashboard for medical staff review

## 🤖 AI Integration

| Feature | Details |
|---------|---------|
| **Primary AI** | Google Gemini 2.0 Flash via `@google/generative-ai` SDK |
| **Fallback Engine** | Comprehensive rule-based triage with 50+ symptom patterns |
| **Symptom Analysis** | NLP-driven extraction and matching of patient descriptions |
| **Vital Signs AI** | Automated assessment of BP, temperature, heart rate, and SpO₂ |
| **Confidence Scoring** | AI returns ranked conditions with probability percentages |

The system gracefully degrades — if the Gemini API key is unavailable or the AI call fails, it automatically falls back to the built-in rule-based engine with zero downtime.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, Express.js |
| **AI Engine** | Google Gemini 2.0 Flash (Generative AI) |
| **Database** | Google Cloud Firestore (Firebase) |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Styling** | Custom CSS with glassmorphism, gradients & Inter font |
| **Authentication** | Firebase Auth (admin dashboard) |
| **Deployment** | Node.js server with static file serving |

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- A Firebase project (for data persistence)

### Installation

```bash
# Clone the repository
git clone https://github.com/tnex0734-ops/Heal-Sphere.git
cd Heal-Sphere

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your Gemini API key (optional)

# Start the server
npm start
```

The app runs at `http://localhost:3000` — the admin dashboard is at `http://localhost:3000/admin`.

### 🧪 Testing the AI Report Parser
A sample medical report is included in the repository to help you test the AI automated data extraction feature. 
1. Navigate to the Triage Tool at `http://localhost:3000`
2. In the "Upload Medical Reports" section, upload the included `test_Patient_Medical_Report_HealSphere.pdf` file.
3. The AI will instantly read the PDF and automatically fill out the patient's name, age, gender, and vital signs!

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | No | Google Gemini API key for AI-powered triage. Without it, the rule-based engine handles everything. |
| `PORT` | No | Server port (default: `3000`) |

## 📋 Features

- 🤖 **AI-Powered Symptom Triage** — Intelligent analysis using Google Gemini 2.0
- 🌍 **Multi-Language Support (7 Languages)** — Fully localized UI and AI translations (EN, ES, FR, DE, HI, ZH, AR)
- 🎙️ **Voice-to-Text Input** — Speak symptoms naturally in your native language using the Web Speech API
- 📄 **Automated Report Parsing** — Upload medical reports and have AI automatically extract and fill patient details
- ⚡ **Rule-Based Fallback** — 50+ symptom patterns work seamlessly offline without any API key
- ❤️ **Vital Signs Assessment** — Analyzes blood pressure, temperature, heart rate, SpO₂
- 📈 **Risk Scoring** — Dynamic 0–100 risk calculation with age/vitals adjustments
- 📊 **Unified Admin Dashboard** — Real-time monitoring with dynamic pill-based filtering (High Risk, Today, Follow-up, etc.)
- ☁️ **Cloud Persistence** — All triage data stored in Google Cloud Firestore
- ✨ **Responsive Design** — Premium glassmorphism UI with smooth animations

## 🔒 Security

- Server-side API keys are stored in `.env` (never committed to git)
- Firebase client config uses security rules for access control
- See [SECURITY.md](SECURITY.md) for the full security policy and recommended Firestore rules

## 📄 License

MIT

---

> ⚠️ **Disclaimer**: Heal Sphere is a demonstration/educational project. Always consult qualified healthcare professionals for medical advice. This tool is not a substitute for professional medical diagnosis.
