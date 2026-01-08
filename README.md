# SocraTask - The Sovereign Productivity & Education Ecosystem with Qwen Integration

## Overview
SocraTask represents a paradigm shift in personal productivity and education software—a completely sovereign, privacy-first ecosystem where every computational process occurs locally on your device. At its heart lies a revolutionary, hardware-agnostic AI architecture built around the Qwen family of models, giving users unprecedented control over their digital intelligence.

## 🚀 Key Features

### 1. Qwen AI Nexus - Local Intelligence Core
- **Hardware-Aware AI Orchestration**: Automatic system profiling and model selection
- **Complete Privacy**: 100% local processing with no data leaving your device
- **Model Management**: Support for Qwen2.5 series models (base, coder, math, VL, audio)
- **Smart Recommendations**: Automatic model suggestions based on hardware capabilities

### 2. Productivity Engine
- **Universal Task Management**: Natural language processing, voice-to-task, email extraction
- **Sovereign Calendar System**: Local, offline-first with cloud integration options
- **Advanced Time Management**: Adaptive Pomodoro, multiple timers, intelligent alarms
- **Habit Formation Engine**: Multiple habit types with intelligent scaffolding
- **Universal Pairing Matrix**: Visual automation engine with AI suggestions

### 3. LearnSpace Education Platform
- **Multi-Modal Quiz Creation**: Visual importer (Qwen2.5-VL), voice forge (Qwen2.5-Audio), code arena (Qwen2.5-Coder)
- **Adaptive Learning System**: Personalized learning paths and intelligent tutoring
- **Community Learning Ecosystem**: Quiz forums, social features, version control

### 4. Social Arena & Gamified Economy
- **Dual-Currency System**: Clarity Points (productivity) and Knowledge Points (education)
- **Tournament System**: Various competition types with fair play systems
- **Club System**: Subject-based, productivity, interest, and project clubs
- **Achievement System**: Comprehensive badges and milestones

### 5. Privacy & Sovereignty
- **Local Processing**: All AI computations happen on-device
- **Data Ownership**: Complete control over your personal information
- **No Subscriptions**: One-time setup with perpetual access
- **Open Source**: Transparent and auditable codebase

## 🏗️ Architecture

### Core Components
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Qwen AI       │    │  Productivity    │    │   LearnSpace    │
│   Nexus         │    │  Engine         │    │   Platform      │
│                 │    │                  │    │                 │
│ • Hardware      │    │ • Task Mgmt      │    │ • Quiz Builder  │
│   Detection     │    │ • Calendar       │    │ • Adaptive      │
│ • Model         │    │ • Time Mgmt      │    │   Learning      │
│   Management    │    │ • Habits         │    │ • Community     │
│ • Privacy       │    │ • Automation     │    │   Learning      │
│   Architecture  │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
           │                      │                       │
           └──────────────────────┼───────────────────────┘
                                  │
              ┌─────────────────────────────────┐
              │     Points & Economy System     │
              │                                 │
              │ • Dual Currency (Clarity/Knowl) │
              │ • Spending & Rewards            │
              │ • Leaderboards & Achievements   │
              └─────────────────────────────────┘
                                  │
              ┌─────────────────────────────────┐
              │        Social Arena             │
              │                                 │
              │ • Friends & Networking        │
              │ • Clubs & Communities         │
              │ • Tournaments & Competitions  │
              └─────────────────────────────────┘
```

### Technology Stack
- **Backend**: Node.js with Express
- **Database**: SQLite for local storage
- **AI Framework**: Integration-ready for transformers.js, llama.cpp, ONNX Runtime
- **Frontend**: Responsive web interface with WebSocket support
- **Security**: End-to-end encryption, local authentication

## 📁 Project Structure
```
/workspace/
├── index.js                  # Main application entry point
├── package.json              # Dependencies and scripts
├── public/                   # Static assets and frontend
│   └── index.html            # Main interface
├── src/
│   ├── ai/                   # Qwen AI Nexus implementation
│   │   └── qwen-nexus.js     # Hardware detection & model management
│   ├── database/             # Database initialization
│   │   └── index.js          # Schema and connection management
│   ├── productivity/         # Productivity engine
│   │   └── index.js          # Task, project, habit, calendar modules
│   ├── learnspace/           # Educational platform
│   │   └── index.js          # Quiz creation and learning modules
│   ├── social/               # Social features
│   │   └── index.js          # Friends, clubs, tournaments
│   ├── economy/              # Points and economy system
│   │   └── index.js          # Dual currency and achievements
│   └── utils/                # Utility functions
│       └── logger.js         # Logging infrastructure
├── data/                     # Local database storage
├── logs/                     # Application logs
├── uploads/                  # File uploads storage
└── test-api.js               # API testing script
```

## 🛠️ Implementation Details

### Qwen AI Nexus
The AI core includes:
- 90-second hardware profiling system (CPU, GPU, memory, storage, thermal)
- Intelligent model recommender based on hardware capabilities
- Support for multiple Qwen model variants (0.5B to 72B parameters)
- Quantization support (Q8_0, Q6_K, Q4_K_M, IQ4_XS)
- Privacy-focused architecture with model sandboxing

### Productivity Engine
Features include:
- Natural language task parsing with AI assistance
- Multi-modal input (voice, email, screenshot)
- Advanced project organization with multiple view modes
- Intelligent calendar system with optimization
- Comprehensive habit tracking with multiple types
- Visual automation builder

### LearnSpace Platform
Key capabilities:
- AI-powered quiz creation from various inputs
- Multi-modal question types (text, image, audio, code)
- Adaptive learning with personalized paths
- Community features for content sharing
- Intelligent content moderation

### Economy System
Dual-currency design:
- **Clarity Points**: Earned through productivity activities
- **Knowledge Points**: Earned through learning activities
- Comprehensive achievement system
- Tournament and competition mechanics
- Fair leaderboard systems

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn package manager
- Modern hardware (2018+ recommended for AI features)

### Installation
```bash
# Clone or navigate to the project directory
cd /workspace

# Install dependencies
npm install

# Start the application
npm start
```

### Configuration
The system automatically detects hardware capabilities on first run and recommends appropriate AI models. No additional configuration is required for basic operation.

## 🧪 API Endpoints

### Productivity Engine
- `GET /api/productivity/tasks` - Retrieve user tasks
- `POST /api/productivity/tasks` - Create new task
- `PUT /api/productivity/tasks/:id` - Update task
- `DELETE /api/productivity/tasks/:id` - Delete task
- `POST /api/productivity/natural-language-task` - Create task from natural language

### LearnSpace
- `GET /api/learnspace/quizzes` - Retrieve quizzes
- `POST /api/learnspace/quizzes` - Create quiz
- `POST /api/learnspace/attempts` - Submit quiz attempt
- `POST /api/learnspace/create-from-image` - Create quiz from image
- `POST /api/learnspace/create-from-text` - Create quiz from text
- `POST /api/learnspace/learning-path` - Generate learning path

### Social Arena
- `POST /api/social/friends/request` - Send friend request
- `POST /api/social/clubs` - Create club
- `POST /api/social/tournaments` - Create tournament
- `POST /api/social/tournaments/join` - Join tournament

### Economy System
- `GET /api/economy/points/summary` - User points summary
- `GET /api/economy/leaderboard` - Global leaderboard
- `POST /api/economy/points/spend` - Spend points
- `GET /api/economy/achievements` - User achievements

## 🔒 Privacy & Security

SocraTask implements industry-leading privacy practices:
- **Zero Data Egress**: No personal data ever leaves your device
- **Local Processing**: All AI computations run locally
- **Encrypted Storage**: Local data stored with strong encryption
- **Model Sandboxing**: AI models run in isolated environments
- **Granular Permissions**: Fine-grained control over data access

## 📊 Performance Characteristics

The system is designed to run efficiently on a wide range of hardware:
- **Minimal Viable System**: 8GB RAM, 20GB storage
- **Optimized Performance**: 16GB+ RAM, dedicated GPU
- **High-End Experience**: 32GB+ RAM, powerful GPU, NVMe storage

Hardware detection automatically adjusts performance settings to match available resources.

## 🎯 Future Development

Planned enhancements include:
- Mobile applications (iOS/Android)
- WatchOS integration
- Advanced AI fine-tuning capabilities
- Expanded model support
- Enhanced multiplayer features
- Plugin ecosystem

## 🤝 Contributing

We welcome contributions to enhance SocraTask's capabilities while maintaining our privacy-first philosophy. Please follow our contribution guidelines and ensure all additions preserve user sovereignty.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**SocraTask**: Empowering users with sovereign digital intelligence that respects privacy, promotes productivity, and enhances learning - all while keeping your data under your complete control.