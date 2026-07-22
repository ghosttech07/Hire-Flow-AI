# HireFlow AI 🚀

> **Autonomous AI-Powered Recruitment & Automated Screening Engine**

HireFlow AI is a production-grade, full-stack recruitment SaaS platform designed to eliminate top-of-funnel hiring manual effort. By pairing multi-agent AI execution (Gemini LLM) with an asynchronous processing pipeline (Celery + Redis), HireFlow AI ingests job descriptions, screens candidate resumes, generates tailored interview questions, conducts speech/text candidate interviews, and outputs candidate evaluation scorecards in seconds.

---

## 📽️ Demo & Screenshots

> 🎬 **Live Demo Video**: [Watch HireFlow AI Demo Walkthrough](https://github.com/ghosttech07/Hire-Flow-AI) *(Video link placeholder)*

| Recruiter Analytics Portal | AI Candidate Evaluation Report |
| :---: | :---: |
| ![Recruiter Dashboard](https://raw.githubusercontent.com/ghosttech07/Hire-Flow-AI/main/frontend/src/assets/hero.png) | ![Candidate Assessment](https://raw.githubusercontent.com/ghosttech07/Hire-Flow-AI/main/frontend/src/assets/hero.png) |

| Candidate Voice Interview | Application Portal |
| :---: | :---: |
| ![Voice Interview Portal](https://raw.githubusercontent.com/ghosttech07/Hire-Flow-AI/main/frontend/src/assets/hero.png) | ![Public Application Form](https://raw.githubusercontent.com/ghosttech07/Hire-Flow-AI/main/frontend/src/assets/hero.png) |

---

## ✨ Features

### Recruiter Experience
- **🎯 Autonomous JD Structuring**: Ingests unstructured Job Descriptions into structured JSON requirements.
- **📄 Resume PDF & Photo Extraction**: Extracts plain text and headshots directly from candidate resumes.
- **📊 Executive Analytics Dashboard**: Real-time conversion funnel charts, quality match doughnut breakdowns, and job management powered by Chart.js.
- **🛡️ JWT & Google OAuth**: Enterprise authentication with rate limiting and secure session management.

### Candidate Experience
- **⚡ Token-Based Candidate Portal**: Zero-friction secure access (`/apply/:jobId`, `/interview/:token`, `/result/:token`).
- **🎙️ Voice & Text Interview Portal**: Speech Recognition (`window.SpeechRecognition`) with seamless typing fallback.
- **📈 Instant Result Transparency**: Real-time score summaries and question breakdowns.

### Asynchronous AI Pipeline & Agents
- **🤖 7+ Multi-Agent Engine**:
  - `JDParser`: Extracts key skills, requirements, and responsibilities.
  - `ResumeScreener`: Evaluates resume match confidence against target job specifications.
  - `QuestionGenerator`: Tailors technical and behavioral interview questions.
  - `AnswerEvaluator`: Scores candidate responses on technical accuracy, communication, and depth.
  - `DecisionEngine`: Aggregates candidate match scores into final hiring recommendations.
  - `EmailSender`: Dispatches transactional notifications via Resend API.
- **🔄 Non-Blocking Queue Execution**: Asynchronous task processing using Celery worker pools over Redis queues.

---

## 🔄 How It Works

```
Recruiter Workflow                 Candidate Workflow                AI Pipeline Processing
──────────────────                 ──────────────────                ───────────────────────
1. Log in / OAuth                  1. Access /apply/:jobId           1. Extract PDF text & photo
2. Post Job Description             2. Upload PDF resume              2. Queue Celery background task
3. AI parses & structures JD        3. Access /interview/:token       3. Agent 2: Resume Match Screen
4. Get public shareable link ─────► 4. Voice or Text interview  ──► 4. Agent 3: Generate Questions
5. View Analytics & Reports        5. View /result/:token            5. Agent 4 & 6: Score & Verdict
                                                                     6. Agent 5: Email Notification
```

---

## 🏗️ System Architecture

```
[ React + Vite Frontend ]
       │ HTTP / REST API (JWT Header Auth)
       ▼
[ Flask API Backend Server ]
       │ Rate Limiter (Redis db/2)
       ├─────────────────────────────────┐
       ▼                                 ▼
[ MongoDB Database ]             [ Redis Task Broker (db/0) ]
(State, Jobs, Candidates)                │
                                         ▼
                                [ Celery Async Worker ]
                                         │
                        ┌────────────────┴────────────────┐
                        ▼                                 ▼
               [ Multi-Agent System ]            [ Resend Email API ]
               (Gemini LLM Engine)
```

---

## 🛠️ Tech Stack

| Category | Technology |
| :--- | :--- |
| **Frontend** | React 19, Vite, React Router v7, Chart.js, GSAP, Lucide Icons, Vanilla CSS Design System |
| **Backend API** | Python 3.12, Flask, Flask-CORS, Flask-Limiter, PyMuPDF, Pillow |
| **Async Tasks** | Celery, Redis Broker, Flower |
| **Database** | MongoDB Atlas / Local MongoDB |
| **AI Engine** | Google Gemini API (Multi-Agent System) |
| **Email API** | Resend API |
| **Auth** | JWT Tokens + Google OAuth 2.0 |

---

## ⚡ Installation & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- Redis Server (or Docker)
- MongoDB instance

### 1. Clone Repository
```bash
git clone https://github.com/ghosttech07/Hire-Flow-AI.git
cd Hire-Flow-AI
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv

# Windows activate
.\venv\Scripts\activate
# Linux/macOS activate
# source venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env` file:
```env
GEMINI_API_KEY=your_gemini_api_key
MONGO_URI=mongodb://localhost:27017/hireflow
JWT_SECRET=your_super_secret_jwt_key
JWT_REFRESH_SECRET=your_jwt_refresh_secret
RESEND_API_KEY=re_your_resend_key
FROM_EMAIL=onboarding@resend.dev
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your_google_client_id
REDIS_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1
ALLOWED_ORIGINS=http://localhost:5173
```

Run Backend Server:
```bash
python app.py
```

### 3. Celery & Redis Setup

Start Redis using Docker Compose:
```bash
cd backend
docker-compose up -d redis
```

Start Celery Worker:
```bash
# Windows (Solo Pool)
celery -A tasks.celery_app worker --pool=solo --loglevel=info

# Linux / macOS
# celery -A tasks.celery_app worker --loglevel=info
```

### 4. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🔑 Environment Variables Reference

| Variable | Required | Description |
| :--- | :---: | :--- |
| `GEMINI_API_KEY` | Yes | Google Gemini API key for agent reasoning |
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret key for signing access tokens |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth Client ID |
| `RESEND_API_KEY` | Yes | Resend API key for sending email invites |
| `FRONTEND_URL` | Yes | Frontend application URL for email links |
| `REDIS_URL` | Yes | Redis connection URI for Celery broker |

---

## 📡 API Endpoints Summary

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register company account
- `POST /api/auth/login` — Login & receive JWT access/refresh tokens
- `POST /api/auth/google` — Google OAuth authentication
- `GET  /api/auth/me` — Fetch current user profile

### Jobs (`/api/jobs`)
- `GET  /api/jobs/` — List company job postings
- `POST /api/jobs/` — Create new job posting & parse JD
- `GET  /api/jobs/:id` — Get single job details
- `GET  /api/jobs/:id/candidates` — List candidates for a specific job

### Candidate Screening & Public Application (`/api/apply` & `/api/interview`)
- `GET  /api/apply/:jobId` — Get public job application preview
- `POST /api/apply/:jobId/submit` — Submit application (PDF resume upload)
- `GET  /api/interview/:token` — Fetch interactive candidate interview session
- `POST /api/interview/:token/answer` — Submit answer to question
- `GET  /api/result/:token` — Get interview score report

---

## 📂 Project Structure

```
Hire-Flow-AI/
├── backend/
│   ├── agents/            # Multi-agent system (screener, parser, evaluator, etc.)
│   ├── config/            # App settings, DB connections & logger
│   ├── db/                # MongoDB initialization & index safety
│   ├── middleware/        # JWT Auth middleware
│   ├── pipeline/          # Candidate pipeline orchestrator
│   ├── routes/            # Flask API blueprint routes (auth, jobs, apply, interview)
│   ├── services/          # Business logic & JWT utilities
│   ├── tasks/             # Celery async task application
│   ├── utils/             # Resume PDF/text/photo extraction helpers
│   ├── app.py             # Flask application entry point
│   ├── docker-compose.yml # Docker config for Redis
│   └── requirements.txt   # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/    # Reusable UI components (Sidebar, Protection, Settings)
│   │   ├── context/       # Auth and Theme context providers
│   │   ├── layouts/       # Dashboard layout wrappers
│   │   ├── pages/         # Page views (Dashboard, Jobs, Reports, Apply, Interview)
│   │   ├── services/      # Axios API client & endpoint definitions
│   │   └── styles/        # Token-based CSS design system
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

---

## 🔮 Future Improvements

- [ ] **WebSockets / Server-Sent Events (SSE)**: Real-time candidate interview progress streaming.
- [ ] **OpenAI Whisper Integration**: Server-side audio speech-to-text conversion for 99%+ accuracy across all browsers.
- [ ] **Stripe Subscription Billing**: Tiered pricing models for paid SaaS deployments.
- [ ] **Enterprise Team Roles**: Multi-recruiter organization permissions and ATS integrations.

---

## 🤝 Contributing

Contributions are welcome!
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p center>Crafted with ❤️ for modern hiring teams.</p>
