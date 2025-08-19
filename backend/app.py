from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import time
from datetime import datetime
from werkzeug.exceptions import RequestEntityTooLarge
import traceback

from config import Config
from utils import validate_file, create_error_response, create_success_response
from ai_core import legal_ai

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def create_app():
    """Application factory pattern for Flask app."""
    app = Flask(__name__)
    
    # Initialize configuration
    Config.init_app(app)
    
    # Configure CORS
    CORS(app, origins=Config.CORS_ORIGINS, supports_credentials=True)
    
    # Request logging middleware
    @app.before_request
    def log_request_info():
        app.logger.info(f'Request: {request.method} {request.url}')
        request.start_time = time.time()
    
    @app.after_request
    def log_response_info(response):
        if hasattr(request, 'start_time'):
            duration = time.time() - request.start_time
            app.logger.info(f'Response: {response.status_code} - {duration:.2f}s')
        return response
    
    # Error handlers
    @app.errorhandler(413)
    def too_large(e):
        return jsonify(create_error_response(
            "File too large", 
            413, 
            f"Maximum file size: {Config.MAX_CONTENT_LENGTH // (1024*1024)}MB"
        ))
    
    @app.errorhandler(404)
    def not_found(e):
        return jsonify(create_error_response("Endpoint not found", 404))
    
    @app.errorhandler(500)
    def internal_error(e):
        logger.error(f"Internal server error: {e}")
        return jsonify(create_error_response("Internal server error", 500))
    
    @app.errorhandler(Exception)
    def handle_exception(e):
        logger.error(f"Unhandled exception: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify(create_error_response("An unexpected error occurred", 500))
    
    # Health check endpoint
    @app.route('/health', methods=['GET'])
    def health_check():
        """Health check endpoint for monitoring."""
        return jsonify({
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "Legal AI Backend"
        })
    
    # File upload endpoint
    @app.route('/api/upload', methods=['POST'])
    def upload_file():
        """Upload and process PDF document."""
        try:
            # Validate file
            if 'file' not in request.files:
                return jsonify(create_error_response("No file part")), 400
            
            file = request.files['file']
            is_valid, filename, error_msg = validate_file(file)
            
            if not is_valid:
                return jsonify(create_error_response(error_msg)), 400
            
            logger.info(f"Processing file: {filename}")
            
            # Process document through AI pipeline
            result = legal_ai.process_document(file)
            
            response_data = create_success_response(
                "Document processed successfully. You can now ask questions.",
                {
                    "filename": filename,
                    "text_length": result["text_length"],
                    "chunks_count": result["chunks_count"]
                }
            )
            
            logger.info(f"File {filename} processed successfully")
            return jsonify(response_data), 200
            
        except Exception as e:
            logger.error(f"File upload failed: {str(e)}")
            return jsonify(create_error_response(
                "Failed to process document", 
                500, 
                str(e)
            )), 500
    
    # Question answering endpoint
    @app.route('/api/query', methods=['POST'])
    def ask_question():
        """Ask a question about the processed document."""
        try:
            data = request.get_json()
            
            if not data:
                return jsonify(create_error_response("No data provided")), 400
            
            question = data.get('question', '').strip()
            
            if not question:
                return jsonify(create_error_response("Question cannot be empty")), 400
            
            logger.info(f"Processing question: {question[:100]}...")
            
            # Get answer from AI
            answer = legal_ai.answer_question(question)
            
            response_data = create_success_response(
                "Question answered successfully",
                {"answer": answer}
            )
            
            return jsonify(response_data), 200
            
        except Exception as e:
            logger.error(f"Question processing failed: {str(e)}")
            return jsonify(create_error_response(
                "Failed to process question", 
                500, 
                str(e)
            )), 500
    
    # Document status endpoint
    @app.route('/api/status', methods=['GET'])
    def get_status():
        """Get current document processing status."""
        try:
            has_document = Config.VECTOR_STORE_PATH.exists()
            
            status_data = {
                "document_processed": has_document,
                "vector_store_path": str(Config.VECTOR_STORE_PATH),
                "upload_folder": str(Config.UPLOAD_FOLDER)
            }
            
            if has_document:
                status_data["status"] = "ready"
                status_data["message"] = "Document is ready for questions"
            else:
                status_data["status"] = "no_document"
                status_data["message"] = "No document has been processed yet"
            
            return jsonify(create_success_response("Status retrieved", status_data)), 200
            
        except Exception as e:
            logger.error(f"Status check failed: {str(e)}")
            return jsonify(create_error_response("Failed to get status", 500)), 500
    
    # Clear document endpoint
    @app.route('/api/clear', methods=['POST'])
    def clear_document():
        """Clear the current document and vector store."""
        try:
            import shutil
            
            if Config.VECTOR_STORE_PATH.exists():
                shutil.rmtree(Config.VECTOR_STORE_PATH)
                logger.info("Vector store cleared")
            
            if Config.UPLOAD_FOLDER.exists():
                for file_path in Config.UPLOAD_FOLDER.iterdir():
                    if file_path.is_file():
                        file_path.unlink()
                logger.info("Upload folder cleared")
            
            return jsonify(create_success_response("Document and vector store cleared successfully")), 200
            
        except Exception as e:
            logger.error(f"Clear operation failed: {str(e)}")
            return jsonify(create_error_response("Failed to clear document", 500)), 500
    
    return app

# Create app instance
app = create_app()

if __name__ == '__main__':
    logger.info(f"Starting Legal AI Backend on {Config.HOST}:{Config.PORT}")
    logger.info(f"Debug mode: {Config.DEBUG}")
    
    app.run(
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG
    )