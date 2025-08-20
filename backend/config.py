import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv()

class Config:
    """Configuration class for the Legal AI application."""
    
    # API Configuration
    GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
    
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
    def validate_config(cls):
        """Validate configuration and return any errors."""
        errors = []
        
        if not cls.GOOGLE_API_KEY:
            errors.append("GOOGLE_API_KEY environment variable is required")
        elif cls.GOOGLE_API_KEY == "your_google_ai_api_key_here":
            errors.append("GOOGLE_API_KEY must be set to a valid API key, not the placeholder value")
        
        return errors
    
    @classmethod
    def init_app(cls, app):
        """Initialize Flask app with configuration."""
        # Validate configuration first
        errors = cls.validate_config()
        if errors:
            error_msg = "\n".join(errors)
            raise ValueError(f"Configuration errors:\n{error_msg}")
        
        # Create necessary directories
        cls.UPLOAD_FOLDER.mkdir(exist_ok=True)
        cls.VECTOR_STORE_PATH.mkdir(exist_ok=True)
        
        # Set Flask config
        app.config['SECRET_KEY'] = cls.SECRET_KEY
        app.config['MAX_CONTENT_LENGTH'] = cls.MAX_CONTENT_LENGTH
