# Sequential Behavioral Training and Testing Platform

A React/TypeScript dashboard for managing ML instruction tuning pipelines. Provides real-time monitoring, dataset management, and model checkpoint management through a modern web interface.

## Features

### Core Dashboard
- **React/TypeScript frontend** with real-time status updates
- **FastAPI backend** to orchestrate the Python training pipeline
- **WebSocket** for live training progress/logs streaming
- **JWT Authentication** for secure access
- **Actual training execution** via subprocess (not simulated)

### Dataset Management Panel
- View available datasets (v1-3, v2-3, SLSEdefense_version7)
- Display JSON file counts per dataset
- Convert datasets to .text format with configurable options (pair count, format style)
- Batch conversion interface
- **Preview converted file contents** before training
- **View conversion format templates** with side-by-side JSON vs text comparison
- **Browse converted files** with pagination support

### Training Configuration Panel
- Set hyperparameters: epochs, learning rate, batch size, gradient accumulation
- Select datasets and training order
- Sequential vs single-file training mode toggle
- Visual batch size calculator (sample x multiplier x accumulation)

### Training Monitor
- Real-time training progress (current step, loss, epoch)
- Training logs viewer with auto-scroll (streams actual Python output)
- Model checkpoint status and file locations
- Cancel/pause training functionality
- Shows device being used (MPS/CUDA/CPU)

### Model Management
- List trained model checkpoints from **all locations** (trained-models/ and step_*/ directories)
- View training history/metadata per model
- Display model architecture info from config.json
- Download/export model files as zip archives

### Testing/Inference Panel
- **Model Loading**: Load/unload trained model checkpoints for inference
- **Single Prompt Mode**: Enter a prompt and generate a single response
- **Loop Mode**: Generate multiple responses from the same prompt
- **Batch Mode**: Generate responses for multiple different prompts
- **Export Results**: Export results as JSON Q&A pairs or text format for training data
- **Generation Parameters**: Configure temperature, top_k, top_p, max_length, no-repeat n-gram size

## How The App Works

### Architecture Overview

```
+------------------+          +------------------+          +----------------------+
|   React/Next.js  |  HTTP    |   FastAPI        |  Subprocess  |  instruction_tuning  |
|   Frontend       | <------> |   Backend        | <--------->  |  _pipeline.py        |
|   (port 3000)    |  WebSocket|   (port 8000)   |              |  (actual training)   |
+------------------+          +------------------+          +----------------------+
```

### Training Flow

1. **User configures training** in the dashboard (datasets, hyperparameters)
2. **Frontend sends config** to backend via POST `/api/training/start`
3. **Backend creates subprocess** that runs the actual Python training pipeline
4. **Training output is streamed** line-by-line via WebSocket to the dashboard
5. **Loss and step values are parsed** from transformer output and displayed in real-time
6. **Model checkpoints are saved** to configured output directory
7. **Training history is logged** for later review

### Data Conversion Flow

1. **JSON Q&A pairs** are stored in `/output/{dataset_name}/` directories
2. **Conversion API** reads JSON files and formats them as text
3. **Format templates** define how Q&A pairs are structured:
   - Chat: `{question}\n {answer}\n\n`
   - Simple: `Q: {question}\nA: {answer}\n\n`
   - Instruction: `### Instruction:\n{question}\n### Response:\n{answer}\n\n`
   - Plain: `{question}\n{answer}\n\n`
4. **Converted .text files** are saved to `/datasets-from-json/`
5. **File browser** allows verification of converted data before training

### Model Discovery

The dashboard scans multiple locations for trained models:
- `/trained-models/` - Primary output directory
- `/step_*/ directories` - Sequential training checkpoints
- Any directory containing `config.json` or `*.safetensors` files

## Project Structure

```
ml-dashboard/
├── src/
│   ├── app/
│   │   ├── globals.css      # Global styles
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Main dashboard page
│   ├── components/
│   │   ├── DatasetPanel.tsx        # Dataset management with file browser
│   │   ├── TrainingConfigPanel.tsx # Training configuration UI
│   │   ├── TrainingMonitor.tsx     # Real-time training monitor
│   │   ├── ModelManagement.tsx     # Model checkpoints UI
│   │   ├── TrainingHistory.tsx     # Training history viewer
│   │   ├── TestingPanel.tsx        # Inference/testing panel
│   │   ├── SettingsPanel.tsx       # Directory settings
│   │   └── LoginForm.tsx           # Authentication UI
│   ├── lib/
│   │   ├── api.ts           # API client functions
│   │   ├── websocket.ts     # WebSocket manager
│   │   └── storage.ts       # Local storage utilities
│   └── types/
│       └── index.ts         # TypeScript type definitions
├── backend/
│   ├── main.py              # FastAPI server
│   ├── config.json          # Directory configuration
│   └── requirements.txt     # Python dependencies
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
- npm or yarn
- PyTorch 2.0+ (for training and inference)
- CUDA or MPS support recommended (CPU fallback available)

### Quick Start (Run Both Frontend & Backend)

```bash
cd ml-dashboard

# Install frontend dependencies
npm install

# Install backend dependencies
pip install -r backend/requirements.txt

# Run both frontend and backend together
npm run dev:all
```

This starts:
- Frontend at `http://localhost:3000`
- Backend API at `http://localhost:8000`

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:all` | Run both frontend and backend together |
| `npm run dev:frontend` | Run only the Next.js frontend |
| `npm run dev:backend` | Run only the FastAPI backend |
| `npm run build` | Build frontend for production |
| `npm run lint` | Run ESLint |

### Manual Setup (Separate Terminals)

**Frontend:**
```bash
cd ml-dashboard
npm install
npm run dev
```

**Backend:**
```bash
cd ml-dashboard/backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### Default Login Credentials
- Username: `admin`
- Password: `admin`

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with username/password |
| POST | `/api/auth/logout` | Logout current user |
| GET | `/api/auth/verify` | Verify JWT token |

### Datasets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/datasets` | List all datasets |
| GET | `/api/datasets/{name}` | Get dataset details |
| GET | `/api/datasets/{name}/preview` | Preview converted file contents |
| GET | `/api/datasets/{name}/format` | Get conversion format info |
| POST | `/api/datasets/convert` | Convert dataset to text format |
| POST | `/api/datasets/batch-convert` | Batch convert multiple datasets |

### Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files/converted` | List all converted .text files |
| GET | `/api/files/content` | Get paginated file content |

### Training
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/training/status` | Get current training status |
| POST | `/api/training/start` | Start training with config |
| POST | `/api/training/stop` | Stop current training |
| GET | `/api/training/logs` | Get training logs |
| GET | `/api/training/history` | Get training history |
| GET | `/api/training/history/{job_id}` | Get detailed training log |
| DELETE | `/api/training/history/{job_id}` | Delete training history entry |

### Models
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/models` | List all model checkpoints (all locations) |
| GET | `/api/models/{name}` | Get model details |
| DELETE | `/api/models/{name}` | Delete a model |
| GET | `/api/models/{name}/download` | Download model as zip |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get current settings |
| POST | `/api/settings` | Update settings |
| POST | `/api/settings/browse` | Browse directory contents |

### Inference/Testing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inference/status` | Get current model load status |
| POST | `/api/inference/load` | Load a model for inference |
| POST | `/api/inference/unload` | Unload the current model |
| POST | `/api/inference/generate` | Generate a single response |
| POST | `/api/inference/generate-loop` | Generate multiple responses (same prompt) |
| POST | `/api/inference/generate-batch` | Generate responses for multiple prompts |
| POST | `/api/inference/export` | Export results as training data |

### WebSocket
| Endpoint | Description |
|----------|-------------|
| `ws://localhost:8000/ws/training` | Real-time training updates |

## Configuration

### Environment Variables

**Frontend (.env.local)**
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/training
```

**Backend**
```
SECRET_KEY=your-secret-key-change-in-production
```

### Training Configuration Options

| Parameter | Default | Description |
|-----------|---------|-------------|
| epochs | 1.0 | Number of training epochs |
| learningRate | 0.000042 | Learning rate (42e-6) |
| sampleSize | 75 | Q&A pairs per batch |
| batchMultiplier | 2 | Batch size multiplier |
| gradientAccumulation | 16 | Gradient accumulation steps |
| formatStyle | "chat" | Format: chat, simple, instruction, plain |
| trainingMode | "sequential" | Mode: sequential or single |

## Technology Stack

### Frontend
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- WebSocket (native API)

### Backend
- FastAPI
- Uvicorn
- WebSockets
- PyJWT (authentication)
- asyncio subprocess (for training execution)

### ML Dependencies (for Training and Inference)
- PyTorch 2.0+ (torch)
- Transformers 4.36+ (HuggingFace transformers library)
- Datasets 2.16+ (HuggingFace datasets library)

**Note:** For Apple Silicon Macs, PyTorch uses MPS (Metal Performance Shaders) for GPU acceleration. For NVIDIA GPUs, ensure CUDA is properly installed. CPU fallback is available but significantly slower.

## Development

### Running Linter
```bash
npm run lint
```

### Type Checking
```bash
npx tsc --noEmit
```

### Building for Production
```bash
npm run build
```

## License

MIT
