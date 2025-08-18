import os
from dotenv import load_dotenv
import fitz  # PyMuPDF

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain.vectorstores import FAISS
from langchain.chains.question_answering import load_qa_chain
from langchain.prompts import PromptTemplate

# Load environment variables from .env file
load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")

def get_pdf_text(pdf_doc):
    """Extracts text from an uploaded PDF file."""
    text = ""
    # The pdf_doc is a file-like object
    pdf_reader = fitz.open(stream=pdf_doc.read(), filetype="pdf")
    for page in pdf_reader:
        text += page.get_text()
    return text

def get_text_chunks(text):
    """Splits text into manageable chunks."""
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=10000, chunk_overlap=1000)
    chunks = text_splitter.split_text(text)
    return chunks

def get_vector_store(text_chunks):
    """Creates and saves a vector store from text chunks."""
    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001", google_api_key=api_key)
    # FAISS is used for efficient similarity search
    vector_store = FAISS.from_texts(text_chunks, embedding=embeddings)
    # The 'faiss_index' is a local file that stores the vector embeddings.
    vector_store.save_local("faiss_index")
    return vector_store

def get_conversational_chain():
    """Creates a conversational chain for Q&A."""
    prompt_template = """
    You are a helpful legal assistant. Your task is to answer the user's question based on the provided context from a legal document.
    Provide a detailed and clear answer. If the answer is not in the provided context, state that clearly.
    
    Context:\n {context}?\n
    Question: \n{question}\n

    Answer:
    """
    model = ChatGoogleGenerativeAI(model="gemini-1.5-pro-latest", temperature=0.3, google_api_key=api_key)
    prompt = PromptTemplate(template=prompt_template, input_variables=["context", "question"])
    chain = load_qa_chain(model, chain_type="stuff", prompt=prompt)
    return chain

def user_input(user_question):
    """Handles user input and provides a response from the AI."""
    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001", google_api_key=api_key)
    
    # Load the local FAISS index
    # allow_dangerous_deserialization is needed for loading FAISS indexes.
    new_db = FAISS.load_local("faiss_index", embeddings, allow_dangerous_deserialization=True)
    docs = new_db.similarity_search(user_question)
    
    chain = get_conversational_chain()
    
    response = chain(
        {"input_documents": docs, "question": user_question},
        return_only_outputs=True
    )
    
    return response["output_text"]