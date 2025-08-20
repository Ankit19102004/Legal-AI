import os
import logging
from typing import List, Optional, Tuple, Dict, Any
from pathlib import Path
import json
import fitz  # PyMuPDF
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_community.vectorstores import FAISS
from langchain.chains.question_answering import load_qa_chain
from langchain.prompts import PromptTemplate
from langchain.schema import Document
from config import Config

# Configure logging
logger = logging.getLogger(__name__)

# ------------------------------
# Utility: robust JSON extraction
# ------------------------------

def _extract_json_from_text(text: str) -> Any:
    """Try to parse JSON from a possibly noisy LLM output string."""
    text = text.strip()
    # Try direct parse
    try:
        return json.loads(text)
    except Exception:
        pass

    # Try to locate first JSON object or array
    start_obj = text.find('{')
    start_arr = text.find('[')
    starts = [i for i in [start_obj, start_arr] if i != -1]
    if not starts:
        raise ValueError("No JSON found in model output")
    start = min(starts)
    # Heuristic: find matching closing brace/bracket
    stack = []
    for i in range(start, len(text)):
        if text[i] in '{[':
            stack.append(text[i])
        elif text[i] in '}]':
            if not stack:
                continue
            open_ch = stack.pop()
            if (open_ch == '{' and text[i] == '}') or (open_ch == '[' and text[i] == ']'):
                if not stack:
                    candidate = text[start:i+1]
                    try:
                        return json.loads(candidate)
                    except Exception:
                        break
    # Fallback: return raw text
    raise ValueError("Failed to parse JSON from model output")

# ------------------------------
# New High-Level Capabilities
# ------------------------------

def _make_model(temperature: float = None) -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model="gemini-1.5-flash-latest",
        temperature=Config.AI_TEMPERATURE if temperature is None else temperature,
        google_api_key=Config.GOOGLE_API_KEY
    )

def summarize_text(text: str) -> Dict[str, Any]:
    """Summarize text with key points, obligations, timelines, and risk flags."""
    prompt = PromptTemplate(
        template=(
            "You are a legal analyst. Summarize the following text clearly.\n"
            "Return strict JSON with keys: summary, key_points (array), obligations (array), timelines (array), risks (array of objects with risk and severity).\n\n"
            "Text:\n{content}"
        ),
        input_variables=["content"],
    )
    chain = _make_model().bind()
    output = chain.invoke({"input": prompt.format(content=text)})
    try:
        data = _extract_json_from_text(output.content[0].text if hasattr(output, 'content') else str(output))
    except Exception:
        # Minimal fallback
        data = {"summary": str(output), "key_points": [], "obligations": [], "timelines": [], "risks": []}
    return data

def explain_clause(clause_text: str) -> Dict[str, Any]:
    """Explain a clause in plain language with pros/cons and risks."""
    prompt = PromptTemplate(
        template=(
            "Explain this legal clause in simple terms and provide pros, cons, and risks.\n"
            "Return strict JSON with keys: explanation, pros (array), cons (array), risks (array with risk and severity).\n\nClause:\n{clause}"
        ),
        input_variables=["clause"],
    )
    chain = _make_model().bind()
    output = chain.invoke({"input": prompt.format(clause=clause_text)})
    try:
        data = _extract_json_from_text(output.content[0].text if hasattr(output, 'content') else str(output))
    except Exception:
        data = {"explanation": str(output), "pros": [], "cons": [], "risks": []}
    return data

def generate_checklist(scenario: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a structured checklist for company formation and operations based on scenario.
    scenario keys may include: country, state, company_type, industry, founders_count, employees_count,
    fundraising, online_business, handles_personal_data, regulated_sector, needs_ip_protection, etc.
    """
    prompt = PromptTemplate(
        template=(
            "You are a business formation legal assistant. Based on the scenario, generate a structured checklist of legal documents and steps.\n"
            "Return strict JSON with keys: jurisdiction, entity_type, assumptions (array), \n"
            "checklist (array of items with: id, title, category, mandatory (bool), description, when_needed, who_prepares, references (array)), \n"
            "notes (array), risk_warnings (array).\n\nScenario as JSON:\n{scenario}\n\nConstraints: keep it practical for first-time founders and note data privacy requirements if applicable."
        ),
        input_variables=["scenario"],
    )
    chain = _make_model().bind()
    output = chain.invoke({"input": prompt.format(scenario=json.dumps(scenario))})
    data = _extract_json_from_text(output.content[0].text if hasattr(output, 'content') else str(output))
    return data

def _extract_text_from_pdf(file_obj) -> str:
    file_obj.seek(0)
    pdf_reader = fitz.open(stream=file_obj.read(), filetype="pdf")
    text = ""
    for page in pdf_reader:
        text += page.get_text() + "\n"
    pdf_reader.close()
    return text

def classify_documents(files: List[Tuple[str, bytes]]) -> List[Dict[str, Any]]:
    """Classify each uploaded document by type and extract key metadata.
    files: list of (filename, file_bytes)
    """
    model = _make_model()
    results: List[Dict[str, Any]] = []
    for filename, content in files:
        text = ""
        try:
            # Attempt PDF parse; if fails, treat as text
            import io
            text = _extract_text_from_pdf(io.BytesIO(content))
        except Exception:
            try:
                text = content.decode('utf-8', errors='ignore')
            except Exception:
                text = ""
        prompt = PromptTemplate(
            template=(
                "Classify the legal document and extract key fields.\n"
                "Return strict JSON with keys: filename, doc_type, parties (array), effective_date, governing_law, term, renewal, termination, signatures_present (bool), summary, risks (array).\n\n"
                "Document Text (truncated):\n{doc}"
            ),
            input_variables=["doc"],
        )
        output = model.bind().invoke({"input": prompt.format(doc=text[:12000])})
        try:
            data = _extract_json_from_text(output.content[0].text if hasattr(output, 'content') else str(output))
        except Exception:
            data = {"filename": filename, "doc_type": "Unknown", "summary": str(output), "risks": []}
        data["filename"] = filename
        results.append(data)
    return results

def gap_analysis(checklist: Dict[str, Any], documents: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compare user's documents against the checklist to identify gaps and risks."""
    prompt = PromptTemplate(
        template=(
            "Perform a gap analysis between the checklist and the user's current documents.\n"
            "Return strict JSON with keys: missing_items (array of checklist ids), partially_covered (array with id and note), \n"
            "risks (array), recommendations (array of actions).\n\nChecklist JSON:\n{checklist}\n\nUser Documents JSON:\n{docs}"
        ),
        input_variables=["checklist", "docs"],
    )
    chain = _make_model().bind()
    output = chain.invoke({
        "input": prompt.format(
            checklist=json.dumps(checklist)[:20000],
            docs=json.dumps(documents)[:20000]
        )
    })
    try:
        data = _extract_json_from_text(output.content[0].text if hasattr(output, 'content') else str(output))
    except Exception:
        data = {"missing_items": [], "partially_covered": [], "risks": [], "recommendations": [str(output)]}
    return data

def extract_clauses(text: str) -> List[Dict[str, Any]]:
    """Use the model to segment the document into key clauses with titles and raw text."""
    prompt = PromptTemplate(
        template=(
            "Segment the following legal text into key clauses. Return strict JSON array where each item has: title, text.\n"
            "Prefer common headings like Parties, Term, Termination, Confidentiality, IP, Payment, Liability, Governing Law, Dispute Resolution, Privacy/Data, Assignment.\n\nText:\n{content}"
        ),
        input_variables=["content"],
    )
    chain = _make_model().bind()
    output = chain.invoke({"input": prompt.format(content=text[:24000])})
    data = _extract_json_from_text(output.content[0].text if hasattr(output, 'content') else str(output))
    if isinstance(data, dict) and 'clauses' in data:
        return data['clauses']
    if isinstance(data, list):
        return data
    raise ValueError("Unexpected clause segmentation output")


def analyze_document(pdf_file) -> Dict[str, Any]:
    """End-to-end analysis: summary, clause explanations, risks, obligations, timelines, glossary, recommendations."""
    # Extract text
    raw_text = _extract_text_from_pdf(pdf_file)
    # Summary
    summary = summarize_text(raw_text)
    # Clauses
    try:
        clauses = extract_clauses(raw_text)
    except Exception:
        clauses = []
    explained: List[Dict[str, Any]] = []
    for c in clauses[:12]:
        try:
            exp = explain_clause(c.get('text', '')[:6000])
        except Exception:
            exp = {"explanation": "", "pros": [], "cons": [], "risks": []}
        explained.append({
            "title": c.get('title', ''),
            "text": c.get('text', ''),
            "analysis": exp
        })
    # Glossary & recommendations
    gloss_prompt = PromptTemplate(
        template=(
            "From this legal text, extract a glossary of hard legal terms with simple definitions (max 12).\n"
            "Return strict JSON array of {term, definition}.\n\nText:\n{content}"
        ), input_variables=["content"],
    )
    rec_prompt = PromptTemplate(
        template=(
            "Given the summary, list practical recommendations for a layperson (max 10), strict JSON array of strings.\n\nSummary JSON:\n{summary}"
        ), input_variables=["summary"],
    )
    model = _make_model()
    try:
        gl_out = model.bind().invoke({"input": gloss_prompt.format(content=raw_text[:20000])})
        glossary = _extract_json_from_text(gl_out.content[0].text if hasattr(gl_out, 'content') else str(gl_out))
    except Exception:
        glossary = []
    try:
        rc_out = model.bind().invoke({"input": rec_prompt.format(summary=json.dumps(summary)[:8000])})
        recommendations = _extract_json_from_text(rc_out.content[0].text if hasattr(rc_out, 'content') else str(rc_out))
    except Exception:
        recommendations = []
    # Aggregate risks/obligations/timelines
    risks = list(summary.get('risks', [])) if isinstance(summary.get('risks'), list) else []
    obligations = summary.get('obligations', []) if isinstance(summary.get('obligations'), list) else []
    timelines = summary.get('timelines', []) if isinstance(summary.get('timelines'), list) else []
    for c in explained:
        for r in c.get('analysis', {}).get('risks', []) or []:
            risks.append(r)
    return {
        "text_length": len(raw_text),
        "summary": summary,
        "clauses": explained,
        "risks": risks,
        "obligations": obligations,
        "timelines": timelines,
        "glossary": glossary,
        "recommendations": recommendations
    }

# ------------------------------
# Existing RAG Q&A (kept as legacy)
# ------------------------------

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
        try:
            text = ""
            pdf_reader = fitz.open(stream=pdf_file.read(), filetype="pdf")
            for page_num, page in enumerate(pdf_reader):
                page_text = page.get_text()
                if page_text.strip():
                    text += page_text + "\n"
            pdf_reader.close()
            if not text.strip():
                raise RuntimeError("No text content found in PDF")
            return text
        except Exception as e:
            raise RuntimeError(f"Failed to extract text from PDF: {e}")
    
    def split_text_into_chunks(self, text: str) -> List[str]:
        try:
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=Config.CHUNK_SIZE,
                chunk_overlap=Config.CHUNK_OVERLAP,
                length_function=len,
                separators=["\n\n", "\n", " ", ""]
            )
            chunks = text_splitter.split_text(text)
            return chunks
        except Exception as e:
            raise RuntimeError(f"Failed to split text into chunks: {e}")
    
    def create_vector_store(self, text_chunks: List[str]) -> FAISS:
        try:
            if not text_chunks:
                raise ValueError("No text chunks provided")
            documents = [Document(page_content=chunk) for chunk in text_chunks]
            vector_store = FAISS.from_documents(documents, self.embeddings)
            vector_store.save_local(str(Config.VECTOR_STORE_PATH))
            self.vector_store = vector_store
            return vector_store
        except Exception as e:
            raise RuntimeError(f"Failed to create vector store: {e}")
    
    def _get_conversational_chain(self):
        try:
            prompt_template = (
                "You are a professional legal assistant with expertise in document analysis. \n"
                "Answer based only on the provided context. If unknown, say so.\n\nContext: {context}\nQuestion: {question}\n\nAnswer:"
            )
            model = ChatGoogleGenerativeAI(
                model="gemini-1.5-flash-latest", 
                temperature=Config.AI_TEMPERATURE, 
                google_api_key=Config.GOOGLE_API_KEY
            )
            prompt = PromptTemplate(template=prompt_template, input_variables=["context", "question"])
            chain = load_qa_chain(model, chain_type="stuff", prompt=prompt)
            return chain
        except Exception as e:
            raise RuntimeError(f"Chain creation failed: {e}")
    
    def process_document(self, pdf_file) -> dict:
        try:
            raw_text = self.extract_pdf_text(pdf_file)
            text_chunks = self.split_text_into_chunks(raw_text)
            self.create_vector_store(text_chunks)
            return {"text_length": len(raw_text), "chunks_count": len(text_chunks), "vector_store_created": True}
        except Exception as e:
            raise RuntimeError(f"Document processing failed: {e}")
    
    def answer_question(self, question: str) -> str:
        try:
            if not question.strip():
                raise ValueError("Question cannot be empty")
            if not Config.VECTOR_STORE_PATH.exists():
                raise RuntimeError("No document has been processed yet. Please upload a document first.")
            try:
                vector_store = FAISS.load_local(
                    str(Config.VECTOR_STORE_PATH), 
                    self.embeddings, 
                    allow_dangerous_deserialization=True
                )
            except TypeError:
                vector_store = FAISS.load_local(str(Config.VECTOR_STORE_PATH), self.embeddings)
            docs = vector_store.similarity_search(question, k=4)
            if not docs:
                return "I couldn't find any relevant information in the document to answer your question."
            chain = self._get_conversational_chain()
            response = chain({"input_documents": docs, "question": question}, return_only_outputs=True)
            return response.get("output_text", "")
        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg or "quota" in error_msg.lower() or "exceeded" in error_msg.lower():
                return (
                    "I'm currently experiencing high demand and have reached my usage limits. "
                    "Please try again in a few minutes, or consider upgrading your Google AI plan."
                )
            elif "No document has been processed" in error_msg:
                return "Please upload a document first before asking questions."
            elif "vector store" in error_msg.lower():
                return "There was an issue with the document processing. Please try uploading the document again."
            else:
                return f"Sorry, I encountered an error while processing your question: {error_msg[:100]}..."

# Global instance
legal_ai = LegalAI()