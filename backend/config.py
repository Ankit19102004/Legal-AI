import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv()

class Config:
    """Configuration class for the Legal AI application."""
    
    # API Configuration
    GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
    if not GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY environment variable is required")
    
    # Flask Configuration
    SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-change-in-production')
    DEBUG = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    HOST = os.getenv('FLASK_HOST', '0.0.0.0')
    PORT = int(os.getenv('FLASK_PORT', 5000))
    
    # File Upload Configuration
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    ALLOWED_EXTENSIONS = {'pdf'}
    UPLOAD_FOLDER = Path('uploads')
    VECTOR_STORE_PATH = Path('faiss_index')
    
    # AI Configuration
    CHUNK_SIZE = int(os.getenv('CHUNK_SIZE', 10000))
    CHUNK_OVERLAP = int(os.getenv('CHUNK_OVERLAP', 1000))
    AI_TEMPERATURE = float(os.getenv('AI_TEMPERATURE', 0.3))
    
    # CORS Configuration
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000').split(',')
    
    @classmethod
    def init_app(cls, app):
        """Initialize Flask app with configuration."""
        # Create necessary directories
        cls.UPLOAD_FOLDER.mkdir(exist_ok=True)
        cls.VECTOR_STORE_PATH.mkdir(exist_ok=True)
        
        # Set Flask config
        app.config['SECRET_KEY'] = cls.SECRET_KEY
        app.config['MAX_CONTENT_LENGTH'] = cls.MAX_CONTENT_LENGTH
