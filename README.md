# LegalEase AI

A modern, privacy-first legal copilot that helps you understand documents, generate actionable checklists for starting and running a company, explain tricky clauses, classify files, compare what you have vs. what you need, and chat about uploaded PDFs.

Built with Google Gemini, LangChain, FAISS, Flask, and a lightweight, responsive frontend.

---

## ✨ What it can do

- 🧭 Company formation advisor
  - Generate a tailored legal checklist based on your scenario (jurisdiction, company type, industry, privacy needs)
- 🧾 Smart document summarizer
  - Clear summaries + key points, obligations, timelines, and risks
- 🧩 Clause explainer
  - Explain complex clauses in plain language with pros/cons and risks
- 🏷️ Document classifier
  - Detect doc type (NDA, MSA, Employment, etc.), key fields, risks
- 🧮 Gap analysis
  - Compare your current docs to the generated checklist and find missing/partial items
- 💬 RAG Q&A on your PDFs
  - Upload a PDF → ask questions grounded in the document content

All in a clean, tabbed UI: Upload • Q&A • Advisory Tools.

---

## 🚀 Quick start (local)

### 1) Backend
```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
# configure env
copy env.example .env
notepad .env  # set GOOGLE_API_KEY=
python app.py
```
- Health check: `http://127.0.0.1:5000/health`

### 2) Frontend
```powershell
cd frontend
python -m http.server 3000
```
Then open `http://127.0.0.1:3000`.

---

## ⚙️ Configuration (.env)
Create `backend/.env` (use `env.example` as a base):

```
GOOGLE_API_KEY=your_google_ai_api_key_here
FLASK_DEBUG=False
FLASK_HOST=0.0.0.0
FLASK_PORT=5000
SECRET_KEY=change-me-in-prod
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CHUNK_SIZE=10000
CHUNK_OVERLAP=1000
AI_TEMPERATURE=0.3
```

Get a key from `https://aistudio.google.com/apikey`.

---

## 🧑‍💻 Using the app

- Upload tab
  - Drag & drop a PDF and process it for Q&A
- Q&A tab
  - Ask grounded questions about your uploaded document
- Advisory Tools tab
  - Checklist: fill scenario → Generate
  - Summarize: paste text → Summarize
  - Explain: paste clause → Explain
  - Classify: select multiple files → Classify
  - Gap Analysis: paste Checklist JSON + Classified docs JSON → Analyze

Outputs are shown in pretty code blocks for copy/paste.

---

## 🔌 API reference
Base URL: `http://127.0.0.1:5000`

- Health
  - GET `/health`

- Upload (RAG setup)
  - POST `/api/upload` (multipart/form-data `file`)
  - Response:
    ```json
    {
      "message": "Document processed successfully. You can now ask questions.",
      "filename": "contract.pdf",
      "text_length": 34567,
      "chunks_count": 12
    }
    ```

- Q&A (RAG)
  - POST `/api/query`
    ```json
    { "question": "What are termination rights?" }
    ```
  - Response:
    ```json
    { "answer": "..." }
    ```

- Company checklist
  - POST `/api/checklist`
    ```json
    {
      "country": "US",
      "state": "CA",
      "company_type": "LLC",
      "industry": "SaaS",
      "online_business": true,
      "handles_personal_data": true
    }
    ```
  - Response (example shape):
    ```json
    {
      "jurisdiction": "US-CA",
      "entity_type": "LLC",
      "assumptions": ["Online B2B SaaS"],
      "checklist": [
        {
          "id": "inc-articles",
          "title": "Articles of Organization",
          "category": "Formation",
          "mandatory": true,
          "description": "File with Secretary of State",
          "when_needed": "Before operations",
          "who_prepares": "Founder/Lawyer",
          "references": ["https://www.sos.ca.gov/"]
        }
      ],
      "notes": [],
      "risk_warnings": []
    }
    ```

- Summarize
  - POST `/api/summarize`
    ```json
    { "content": "<text to summarize>" }
    ```

- Explain clause
  - POST `/api/explain`
    ```json
    { "clause": "<clause text>" }
    ```

- Classify documents
  - POST `/api/classify` (multipart/form-data `files`[])
  - Response:
    ```json
    { "documents": [ { "filename": "nda.pdf", "doc_type": "NDA", "summary": "..." } ] }
    ```

- Gap analysis
  - POST `/api/gap`
    ```json
    { "checklist": { ... }, "documents": [ ... ] }
    ```

---

## 🏗️ Architecture

- Frontend: Vanilla JS + CSS (fast, framework-free, responsive UI with tabs)
- Backend: Flask 3
  - Gemini 1.5 Flash via `langchain-google-genai`
  - Summarization / Explanation / Classification / Checklist / Gap: direct model calls (structured JSON prompts)
  - RAG Q&A: FAISS vector store + embeddings (`models/embedding-001`)

```text
Browser (Tabs) → Flask API → Gemini + LangChain
             ↘ FAISS (for RAG Q&A)
```

---

## 🔐 Privacy & safety
- Your uploads stay local (processed in-memory and indexed to a local FAISS store)
- No analytics or tracking
- Clear, supportive language in explanations

---

## 🧰 Troubleshooting

- "Failed to get answer" or empty answers
  - Upload a PDF first (Q&A needs a vector store)
- Quota errors (429)
  - Free-tier limits reached. Wait a bit or upgrade your Google AI plan
- FAISS load errors
  - We handle both new/old FAISS signatures automatically
- CORS issues
  - Use `http://127.0.0.1:3000` (not `file://`)

---

## 🗺️ Roadmap
- Entity extraction and redline suggestions
- Auto-mapping classified docs directly into gap analysis
- Save/load workspaces
- Email/PDF export of checklists and analyses

---

## 📄 License
MIT

---

## 🙌 Acknowledgments
- Google Gemini
- LangChain & FAISS
- Open-source community