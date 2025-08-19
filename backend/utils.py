import os
from werkzeug.utils import secure_filename
from typing import Optional, Tuple
import logging
from config import Config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def allowed_file(filename: str) -> bool:
    """Check if the file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS

def validate_file(file) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Validate uploaded file.
    Returns: (is_valid, filename, error_message)
    """
    if not file:
        return False, None, "No file provided"
    
    if file.filename == '':
        return False, None, "No file selected"
    
    if not allowed_file(file.filename):
        return False, None, f"File type not allowed. Allowed types: {', '.join(Config.ALLOWED_EXTENSIONS)}"
    
    # Check file size
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)  # Reset file pointer
    
    if file_size > Config.MAX_CONTENT_LENGTH:
        return False, None, f"File too large. Maximum size: {Config.MAX_CONTENT_LENGTH // (1024*1024)}MB"
    
    # Secure the filename
    secure_name = secure_filename(file.filename)
    if not secure_name:
        return False, None, "Invalid filename"
    
    return True, secure_name, None

def create_error_response(message: str, status_code: int = 400, details: str = None) -> dict:
    """Create a standardized error response."""
    response = {
        "error": message,
        "status": "error",
        "timestamp": None  # Will be set by the API layer
    }
    if details:
        response["details"] = details
    return response, status_code

def create_success_response(message: str, data: dict = None) -> dict:
    """Create a standardized success response."""
    response = {
        "message": message,
        "status": "success",
        "timestamp": None  # Will be set by the API layer
    }
    if data:
        response.update(data)
    return response
