import os
import logging
from typing import List, Optional
from pathlib import Path
import fitz  # PyMuPDF
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain.vectorstores import FAISS
from langchain.chains.question_answering import load_qa_chain
from langchain.prompts import PromptTemplate
from langchain.schema import Document
from config import Config

# Configure logging
logger = logging.getLogger(__name__)

class LegalAI:
    """Main AI class for handling legal document processing and Q&A."""
    
    def __init__(self):
        """Initialize the LegalAI instance."""
        self.embeddings = None
        self.vector_store = None
        self.chain = None
        self._initialize_ai_components()
    
    def _initialize_ai_components(self):
        """Initialize AI components with proper error handling."""
        try:
            self.embeddings = GoogleGenerativeAIEmbeddings(
                model="models/embedding-001", 
                google_api_key=Config.GOOGLE_API_KEY
            )
            logger.info("AI embeddings initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize embeddings: {e}")
            raise RuntimeError(f"AI initialization failed: {e}")
    
    def extract_pdf_text(self, pdf_file) -> str:
        """
        Extract text from PDF file with comprehensive error handling.
        
        Args:
            pdf_file: File-like object containing PDF data
            
        Returns:
            str: Extracted text from PDF
            
        Raises:
            RuntimeError: If PDF processing fails
        """
        try:
            text = ""
            pdf_reader = fitz.open(stream=pdf_file.read(), filetype="pdf")
            
            for page_num, page in enumerate(pdf_reader):
                page_text = page.get_text()
                if page_text.strip():
                    text += page_text + "\n"
                logger.debug(f"Processed page {page_num + 1}")
            
            pdf_reader.close()
            
            if not text.strip():
                raise RuntimeError("No text content found in PDF")
            
            logger.info(f"Successfully extracted {len(text)} characters from PDF")
            return text
            
        except Exception as e:
            logger.error(f"PDF text extraction failed: {e}")
            raise RuntimeError(f"Failed to extract text from PDF: {e}")
    
    def split_text_into_chunks(self, text: str) -> List[str]:
        """
        Split text into manageable chunks for processing.
        
        Args:
            text: Raw text to split
            
        Returns:
            List[str]: List of text chunks
        """
        try:
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=Config.CHUNK_SIZE,
                chunk_overlap=Config.CHUNK_OVERLAP,
                length_function=len,
                separators=["\n\n", "\n", " ", ""]
            )
            
            chunks = text_splitter.split_text(text)
            logger.info(f"Text split into {len(chunks)} chunks")
            return chunks
            
        except Exception as e:
            logger.error(f"Text chunking failed: {e}")
            raise RuntimeError(f"Failed to split text into chunks: {e}")
    
    def create_vector_store(self, text_chunks: List[str]) -> FAISS:
        """
        Create and save vector store from text chunks.
        
        Args:
            text_chunks: List of text chunks to vectorize
            
        Returns:
            FAISS: Vector store instance
        """
        try:
            if not text_chunks:
                raise ValueError("No text chunks provided")
            
            # Create documents from chunks
            documents = [Document(page_content=chunk) for chunk in text_chunks]
            
            # Create vector store
            vector_store = FAISS.from_documents(documents, self.embeddings)
            
            # Save to local storage
            vector_store.save_local(str(Config.VECTOR_STORE_PATH))
            
            self.vector_store = vector_store
            logger.info(f"Vector store created and saved with {len(text_chunks)} chunks")
            return vector_store
            
        except Exception as e:
            logger.error(f"Vector store creation failed: {e}")
            raise RuntimeError(f"Failed to create vector store: {e}")
    
    def _get_conversational_chain(self):
        """Create conversational chain for Q&A."""
        try:
            prompt_template = """
            You are a professional legal assistant with expertise in document analysis. 
            Your task is to provide accurate, helpful answers based on the provided legal document context.
            
            Guidelines:
            - Answer based ONLY on the provided context
            - If the answer is not in the context, clearly state that
            - Provide specific references when possible
            - Use clear, professional language
            - If asked about legal advice, remind users to consult qualified legal professionals
            
            Context: {context}
            Question: {question}
            
            Answer:"""
            
            model = ChatGoogleGenerativeAI(
                model="gemini-1.5-pro-latest", 
                temperature=Config.AI_TEMPERATURE, 
                google_api_key=Config.GOOGLE_API_KEY
            )
            
            prompt = PromptTemplate(
                template=prompt_template, 
                input_variables=["context", "question"]
            )
            
            chain = load_qa_chain(model, chain_type="stuff", prompt=prompt)
            return chain
            
        except Exception as e:
            logger.error(f"Failed to create conversational chain: {e}")
            raise RuntimeError(f"Chain creation failed: {e}")
    
    def process_document(self, pdf_file) -> dict:
        """
        Process uploaded PDF document through the complete pipeline.
        
        Args:
            pdf_file: File-like object containing PDF data
            
        Returns:
            dict: Processing results
        """
        try:
            logger.info("Starting document processing pipeline")
            
            # Extract text
            raw_text = self.extract_pdf_text(pdf_file)
            
            # Split into chunks
            text_chunks = self.split_text_into_chunks(raw_text)
            
            # Create vector store
            vector_store = self.create_vector_store(text_chunks)
            
            result = {
                "text_length": len(raw_text),
                "chunks_count": len(text_chunks),
                "vector_store_created": True
            }
            
            logger.info("Document processing completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"Document processing failed: {e}")
            raise RuntimeError(f"Document processing failed: {e}")
    
    def answer_question(self, question: str) -> str:
        """
        Answer user question based on processed document.
        
        Args:
            question: User's question
            
        Returns:
            str: AI-generated answer
        """
        try:
            if not question.strip():
                raise ValueError("Question cannot be empty")
            
            # Check if vector store exists
            if not Config.VECTOR_STORE_PATH.exists():
                raise RuntimeError("No document has been processed yet. Please upload a document first.")
            
            # Load vector store
            vector_store = FAISS.load_local(
                str(Config.VECTOR_STORE_PATH), 
                self.embeddings, 
                allow_dangerous_deserialization=True
            )
            
            # Search for relevant documents
            docs = vector_store.similarity_search(question, k=4)
            
            if not docs:
                return "I couldn't find any relevant information in the document to answer your question."
            
            # Get conversational chain
            chain = self._get_conversational_chain()
            
            # Generate response
            response = chain(
                {"input_documents": docs, "question": question},
                return_only_outputs=True
            )
            
            logger.info(f"Question answered successfully: '{question[:50]}...'")
            return response["output_text"]
            
        except Exception as e:
            logger.error(f"Question answering failed: {e}")
            raise RuntimeError(f"Failed to answer question: {e}")

# Global instance
legal_ai = LegalAI()