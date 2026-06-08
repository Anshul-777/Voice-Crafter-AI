# Voice-Crafter 🎙️

**Enterprise Voice AI Platform** — Clone · Generate · Detect · Stream

The most complete open-source voice AI platform. Real voice cloning, expressive TTS in 17 languages, 5-model deepfake detection, live streaming analysis, public voice hub, and enterprise SaaS features.

---

## Features

### Voice Cloning
- Zero-shot cloning from 3+ seconds of audio (XTTS-v2)
- Fine-tune mode for higher voice similarity
- Speaker embedding extraction and versioning
- Audio quality analysis before cloning
- Public/private voice profiles with metadata

### Voice Generation (TTS)
- 17 language support via XTTS-v2
- Emotion styles: neutral, happy, sad, excited, calm, professional, storytelling, news
- Speed, pitch, temperature controls
- SSML support (Pro plan)
- Streaming audio output via WebSocket
- WAV, MP3, FLAC, OGG output formats

### Deepfake Detection
- **5-model ensemble**: AASIST + RawNet2 + Prosodic + Spectral + Glottal
- Real-time streaming detection via WebSocket (microphone)
- Batch file analysis with confidence timeline
- Speaker diarization with per-speaker fraud scoring
- Chain-of-custody evidence logs
- JSON report export

### Platform
- Multi-tenant SaaS: Free / Starter / Pro / Enterprise plans
- Real-time notifications via WebSocket
- Full audit log with CSV export
- API key management
- Admin console
- Quality Lab — SNR, speech ratio, clipping analysis
- Benchmark Center — model accuracy, latency, hardware requirements
- AI Chatbot assistant (Claude-powered)
- Real-time social features: follows, likes, comments

---

## Tech Stack

| Layer               | Technology                                             |
|---------------------|--------------------------------------------------------|
| Frontend            | React 18, TypeScript, Vite, Framer Motion, Recharts    |
| Backend             | FastAPI, SQLAlchemy 2.0 async, PostgreSQL              |
| Cache/Queue         | Redis, Celery                                          |
| Storage             | MinIO (S3-compatible)                                  |
| Voice Cloning       | Coqui TTS / XTTS-v2                                    |
| Detection           | AASIST, RawNet2, + custom models                       |
| Diarization         | pyannote.audio 3.1                                     |
| Auth                | JWT + refresh tokens                                   |

---

## Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 16
- Redis 7
- (Optional) MinIO or use local storage mode

### 1. Clone and set up backend

```bash
cd voice-crafter/backend
cp .env.example .env
# Edit .env with your settings

pip install -r requirements.txt

# Initialize database
python -c "import asyncio; from app.database import init_db; asyncio.run(init_db())"

# Start API server
uvicorn app.main:app --reload --port 8000
```

### 2. Set up frontend

```bash
cd voice-crafter/frontend
cp .env.example .env
npm install
npm run dev
```

### 3. Start Celery workers (in separate terminals)

```bash
cd backend
celery -A app.workers.celery_app worker -Q detection,cloning -c 2 --loglevel=info
celery -A app.workers.celery_app worker -Q generation,default -c 4 --loglevel=info
```

### 4. Docker Compose (recommended)

```bash
cd voice-crafter
cp backend/.env.example backend/.env
docker compose up -d
```

Access the platform at **http://localhost:3000**

---

## Using Local Storage (no MinIO)

Set in `.env`:
```
STORAGE_BACKEND=local
LOCAL_STORAGE_PATH=/tmp/voice-crafter
```

---

## Downloading Detection Models

AASIST and RawNet2 checkpoints must be downloaded separately:

```bash
# AASIST (from original repository)
mkdir -p backend/models/aasist
# Download AASIST.pth from https://github.com/clovaai/aasist
# Place at: backend/models/aasist/AASIST.pth

# RawNet2 (from original repository)
mkdir -p backend/models/rawnet2
# Download RawNet2.pth from https://github.com/asvspoof-challenge/2021
# Place at: backend/models/rawnet2/RawNet2.pth
```

Without checkpoints, the system uses built-in heuristic detectors which are less accurate but fully functional.

---

## Chatbot Setup

The AI assistant works out of the box with built-in knowledge base responses.
For full Claude-powered AI responses:

1. Get an API key from https://console.anthropic.com
2. Add to `frontend/.env`:
   ```
   VITE_CHATBOT_API_KEY=sk-ant-...
   ```

---

## Environment Variables

See `backend/.env.example` for all backend configuration options.
See `frontend/.env.example` for frontend configuration.

Key variables:

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | JWT signing key (change in production!) |
| `DATABASE_URL` | PostgreSQL async connection URL |
| `REDIS_URL` | Redis connection URL |
| `STORAGE_BACKEND` | `minio`, `s3`, or `local` |
| `HF_TOKEN` | HuggingFace token for pyannote diarization |
| `STRIPE_SECRET_KEY` | Stripe key for payment processing |
| `VITE_CHATBOT_API_KEY` | Anthropic API key for AI chatbot |

---

## API Overview

```
POST /api/v1/auth/register      Register user
POST /api/v1/auth/login         Get JWT tokens
GET  /api/v1/voices             List voice profiles
POST /api/v1/cloning/start      Start clone job
POST /api/v1/generation         Generate TTS
POST /api/v1/detection/analyze  Analyze audio for deepfakes
GET  /api/v1/hub/voices         Browse public voice hub

WS   /ws/detect/stream          Live detection stream
WS   /ws/generate/stream        Streaming TTS output
WS   /ws/notifications          Real-time notifications
```

Full API docs available at **http://localhost:8000/api/docs**

---

## License

MIT License. See LICENSE for details.

Detection model weights (AASIST, RawNet2) are subject to their original authors' licenses.
XTTS-v2 is subject to Coqui CPML license — commercial use requires separate agreement.
