from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import time
from datetime import datetime
from werkzeug.exceptions import RequestEntityTooLarge
import traceback

from config import Config
from utils import validate_file, create_error_response, create_success_response
from ai_core import legal_ai, generate_checklist, summarize_text, explain_clause, classify_documents, gap_analysis, analyze_document

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
        return jsonify({
            "error": "File too large",
            "status": "error",
            "max_mb": Config.MAX_CONTENT_LENGTH // (1024*1024)
        }), 413
    
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Endpoint not found"}), 404
    
    @app.errorhandler(500)
    def internal_error(e):
        logger.error(f"Internal server error: {e}")
        return jsonify({"error": "Internal server error"}), 500
    
    @app.errorhandler(Exception)
    def handle_exception(e):
        logger.error(f"Unhandled exception: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "An unexpected error occurred"}), 500
    
    # Health check endpoint
    @app.route('/health', methods=['GET'])
    def health_check():
        return jsonify({
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "Legal AI Backend"
        })
    
    # File upload endpoint (RAG setup)
    @app.route('/api/upload', methods=['POST'])
    def upload_file():
        try:
            if 'file' not in request.files:
                return jsonify({"error": "No file part"}), 400
            file = request.files['file']
            is_valid, filename, error_msg = validate_file(file)
            if not is_valid:
                return jsonify({"error": error_msg}), 400
            logger.info(f"Processing file: {filename}")
            result = legal_ai.process_document(file)
            logger.info(f"File {filename} processed successfully")
            return jsonify({
                "message": "Document processed successfully. You can now ask questions.",
                "filename": filename,
                "text_length": result["text_length"],
                "chunks_count": result["chunks_count"]
            }), 200
        except Exception as e:
            logger.error(f"File upload failed: {str(e)}")
            return jsonify({"error": "Failed to process document", "details": str(e)}), 500
    
    # Question answering endpoint (RAG)
    @app.route('/api/query', methods=['POST'])
    def ask_question():
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            question = data.get('question', '').strip()
            if not question:
                return jsonify({"error": "Question cannot be empty"}), 400
            logger.info(f"Processing question: {question[:100]}...")
            answer = legal_ai.answer_question(question)
            return jsonify({"answer": answer}), 200
        except Exception as e:
            logger.error(f"Question processing failed: {str(e)}")
            return jsonify({"error": "Failed to process question", "details": str(e)}), 500
    
    # Status endpoint
    @app.route('/api/status', methods=['GET'])
    def get_status():
        try:
            has_document = Config.VECTOR_STORE_PATH.exists()
            status_data = {
                "document_processed": has_document,
                "vector_store_path": str(Config.VECTOR_STORE_PATH),
                "upload_folder": str(Config.UPLOAD_FOLDER),
                "status": "ready" if has_document else "no_document",
                "message": "Document is ready for questions" if has_document else "No document has been processed yet"
            }
            return jsonify(status_data), 200
        except Exception as e:
            logger.error(f"Status check failed: {str(e)}")
            return jsonify({"error": "Failed to get status"}), 500
    
    # Clear endpoint
    @app.route('/api/clear', methods=['POST'])
    def clear_document():
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
            return jsonify({"message": "Document and vector store cleared successfully"}), 200
        except Exception as e:
            logger.error(f"Clear operation failed: {str(e)}")
            return jsonify({"error": "Failed to clear document"}), 500

    # New intelligent endpoints
    @app.route('/api/checklist', methods=['POST'])
    def api_checklist():
        try:
            data = request.get_json() or {}
            result = generate_checklist(data)
            return jsonify(result), 200
        except Exception as e:
            logger.error(f"Checklist generation failed: {e}")
            return jsonify({"error": "Failed to generate checklist", "details": str(e)}), 500

    @app.route('/api/summarize', methods=['POST'])
    def api_summarize():
        try:
            data = request.get_json() or {}
            content = data.get('content', '').strip()
            if not content:
                return jsonify({"error": "content is required"}), 400
            result = summarize_text(content)
            return jsonify(result), 200
        except Exception as e:
            logger.error(f"Summarization failed: {e}")
            return jsonify({"error": "Failed to summarize", "details": str(e)}), 500

    @app.route('/api/explain', methods=['POST'])
    def api_explain():
        try:
            data = request.get_json() or {}
            clause = data.get('clause', '').strip()
            if not clause:
                return jsonify({"error": "clause is required"}), 400
            result = explain_clause(clause)
            return jsonify(result), 200
        except Exception as e:
            logger.error(f"Explain clause failed: {e}")
            return jsonify({"error": "Failed to explain clause", "details": str(e)}), 500

    @app.route('/api/classify', methods=['POST'])
    def api_classify():
        try:
            if 'files' not in request.files:
                return jsonify({"error": "No files part"}), 400
            files = request.files.getlist('files')
            to_classify: list = []
            for f in files:
                f.seek(0)
                to_classify.append((f.filename, f.read()))
            result = classify_documents(to_classify)
            return jsonify({"documents": result}), 200
        except Exception as e:
            logger.error(f"Classification failed: {e}")
            return jsonify({"error": "Failed to classify documents", "details": str(e)}), 500

    @app.route('/api/gap', methods=['POST'])
    def api_gap():
        try:
            data = request.get_json() or {}
            checklist = data.get('checklist')
            documents = data.get('documents')
            if not checklist or not documents:
                return jsonify({"error": "checklist and documents are required"}), 400
            result = gap_analysis(checklist, documents)
            return jsonify(result), 200
        except Exception as e:
            logger.error(f"Gap analysis failed: {e}")
            return jsonify({"error": "Failed to perform gap analysis", "details": str(e)}), 500

    # Full document analysis (non-chat)
    @app.route('/api/analyze', methods=['POST'])
    def api_analyze():
        try:
            if 'file' not in request.files:
                return jsonify({"error": "No file part"}), 400
            file = request.files['file']
            is_valid, filename, error_msg = validate_file(file)
            if not is_valid:
                return jsonify({"error": error_msg}), 400
            file.seek(0)
            result = analyze_document(file)
            result["filename"] = filename
            return jsonify(result), 200
        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            return jsonify({"error": "Failed to analyze document", "details": str(e)}), 500

    return app

# Create app instance
app = create_app()

if __name__ == '__main__':
    logger.info(f"Starting Legal AI Backend on {Config.HOST}:{Config.PORT}")
    logger.info(f"Debug mode: {Config.DEBUG}")
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)