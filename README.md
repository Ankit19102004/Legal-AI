# LegalEase AI - Professional Legal Document Analysis

A sophisticated, production-ready AI-powered legal document analysis platform that provides intelligent Q&A capabilities for legal professionals and businesses.

## 🚀 Features

- **Advanced PDF Processing**: Intelligent text extraction and chunking for optimal AI analysis
- **AI-Powered Q&A**: Google Gemini Pro integration for accurate legal document interpretation
- **Professional UI/UX**: Modern, responsive interface with drag-and-drop file upload
- **Enterprise Security**: Comprehensive error handling, validation, and security measures
- **Scalable Architecture**: Modular backend with proper separation of concerns
- **Real-time Status**: Live document processing status and health monitoring

## 🏗️ Architecture

```
Legal-AI/
├── backend/                 # Flask REST API
│   ├── app.py             # Main application with middleware
│   ├── ai_core.py         # AI processing engine
│   ├── config.py          # Configuration management
│   ├── utils.py           # Utility functions
│   └── requirements.txt   # Python dependencies
├── frontend/               # Modern web interface
│   ├── index.html         # Semantic HTML structure
│   ├── style.css          # Professional CSS with design system
│   └── script.js          # ES6+ JavaScript application
└── docs/                   # Documentation
```

## 🛠️ Technology Stack

### Backend
- **Flask 3.0**: Modern Python web framework
- **LangChain**: AI/LLM orchestration
- **Google Generative AI**: Gemini Pro for document analysis
- **FAISS**: Vector similarity search
- **PyMuPDF**: PDF text extraction
- **Gunicorn**: Production WSGI server

### Frontend
- **Vanilla JavaScript**: Modern ES6+ without framework dependencies
- **CSS3**: Custom design system with CSS variables
- **HTML5**: Semantic markup with accessibility
- **Font Awesome**: Professional iconography
- **Inter Font**: Modern typography

## 📋 Prerequisites

- Python 3.9+
- Node.js 16+ (for development tools)
- Google AI API key
- Modern web browser

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/Legal-AI.git
cd Legal-AI
```

### 2. Set Up Backend
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env
# Edit .env with your Google API key
```

### 3. Configure Environment
Create a `.env` file in the backend directory:
```env
# Required
GOOGLE_API_KEY=your_google_ai_api_key_here

# Optional (with defaults)
FLASK_DEBUG=False
FLASK_HOST=0.0.0.0
FLASK_PORT=5000
SECRET_KEY=your-secret-key-change-in-production
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CHUNK_SIZE=10000
CHUNK_OVERLAP=1000
AI_TEMPERATURE=0.3
```

### 4. Start Backend Server
```bash
# Development
python app.py

# Production
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### 5. Open Frontend
Open `frontend/index.html` in your web browser or serve it with a local server:
```bash
cd frontend
python -m http.server 3000
# Then visit http://localhost:3000
```

## 🔧 Configuration

### Backend Configuration
The application uses a centralized configuration system in `config.py`:

- **API Configuration**: Google AI API settings
- **Flask Settings**: Server configuration and security
- **File Upload**: Size limits and allowed formats
- **AI Parameters**: Chunk sizes and model settings
- **CORS**: Cross-origin resource sharing settings

### Frontend Configuration
Frontend configuration is handled in the JavaScript application:

- **API Endpoints**: Backend service URLs
- **UI Behavior**: User interface preferences
- **Error Handling**: User feedback and notifications

## 📚 API Endpoints

### Health Check
```
GET /health
```
Returns service health status.

### Document Upload
```
POST /api/upload
Content-Type: multipart/form-data
```
Upload and process PDF documents.

### Question Answering
```
POST /api/query
Content-Type: application/json
Body: {"question": "Your legal question here"}
```
Ask questions about uploaded documents.

### Status Check
```
GET /api/status
```
Check current document processing status.

### Clear Document
```
POST /api/clear
```
Remove current document and vector store.

## 🔒 Security Features

- **Input Validation**: Comprehensive file and data validation
- **Error Handling**: Secure error responses without information leakage
- **CORS Protection**: Configurable cross-origin access control
- **File Size Limits**: Configurable upload size restrictions
- **Secure Headers**: Production-ready security headers
- **Environment Variables**: Secure configuration management

## 🧪 Testing

### Backend Testing
```bash
cd backend
python -m pytest tests/
```

### Frontend Testing
```bash
cd frontend
npm test
```

## 🚀 Deployment

### Production Backend
```bash
# Using Gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 --timeout 120 app:app

# Using Docker
docker build -t legal-ai-backend .
docker run -p 5000:5000 legal-ai-backend
```

### Production Frontend
```bash
# Build and serve static files
cd frontend
npm run build
# Serve the dist/ directory with your web server
```

## 📊 Monitoring

The application includes comprehensive logging and monitoring:

- **Request Logging**: All API requests with timing
- **Error Tracking**: Detailed error logging with stack traces
- **Performance Metrics**: Response time monitoring
- **Health Checks**: Service availability monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Wiki](https://github.com/yourusername/Legal-AI/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/Legal-AI/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/Legal-AI/discussions)

## 🙏 Acknowledgments

- Google AI for providing the Gemini Pro API
- LangChain for AI orchestration tools
- FAISS for vector similarity search
- The open-source community for inspiration and tools

---

**Built with ❤️ for the legal community**