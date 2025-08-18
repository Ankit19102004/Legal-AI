from flask import Flask, request, jsonify
from flask_cors import CORS
import ai_core  # Import our AI logic

app = Flask(__name__)
# CORS allows our frontend (on a different 'origin') to communicate with this backend
CORS(app)

@app.route('/upload', methods=['POST'])
def upload_file():
    """Endpoint to upload a PDF and create its vector store."""
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file and file.filename.endswith('.pdf'):
        try:
            # 1. Extract text from the PDF
            raw_text = ai_core.get_pdf_text(file)
            
            # 2. Split text into chunks
            text_chunks = ai_core.get_text_chunks(raw_text)
            
            # 3. Create and save the vector store
            ai_core.get_vector_store(text_chunks)
            
            return jsonify({"message": "File processed successfully. You can now ask questions."}), 200
        
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({"error": "Invalid file type. Please upload a PDF."}), 400

@app.route('/query', methods=['POST'])
def ask_question():
    """Endpoint to ask a question about the processed document."""
    data = request.get_json()
    if not data or 'question' not in data:
        return jsonify({"error": "Question not provided"}), 400
        
    user_question = data['question']
    
    try:
        # Get the answer from our AI core logic
        answer = ai_core.user_input(user_question)
        return jsonify({"answer": answer})
    
    except Exception as e:
        # This can happen if the 'faiss_index' is not created yet (no file uploaded)
        return jsonify({"error": "Could not process the question. Have you uploaded a document first?", "details": str(e)}), 500

if __name__ == '__main__':
    # Runs the app on http://127.0.0.1:5000
    app.run(debug=True)