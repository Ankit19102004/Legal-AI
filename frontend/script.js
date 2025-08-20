/**
 * LegalEase AI Frontend Application
 * Professional legal document analysis interface
 */

class LegalAIApp {
    constructor() {
        const defaultApiBase = 'http://127.0.0.1:5000';
        const globalApiUrl = (typeof window !== 'undefined' && window.API_URL) ? window.API_URL : null;
        this.config = {
            apiBaseUrl: globalApiUrl || defaultApiBase,
            endpoints: {
                upload: '/api/upload',
                query: '/api/query',
                status: '/api/status',
                clear: '/api/clear',
                health: '/health'
            }
        };
        
        this.state = {
            documentLoaded: false,
            currentDocument: null,
            isProcessing: false,
            isAsking: false
        };
        
        this.elements = {};
        this.init();
    }
    
    init() {
        this.cacheElements();
        this.bindEvents();
        this.checkHealth();
        this.checkStatus();
    }
    
    cacheElements() {
        // Main sections
        this.elements.uploadSection = document.getElementById('upload-section');
        this.elements.chatSection = document.getElementById('chat-section');
        this.elements.loadingOverlay = document.getElementById('loading-overlay');
        this.elements.loadingText = document.getElementById('loading-text');
        
        // Upload elements
        this.elements.uploadDropZone = document.getElementById('upload-drop-zone');
        this.elements.pdfUpload = document.getElementById('pdf-upload');
        this.elements.uploadBtn = document.getElementById('upload-btn');
        this.elements.uploadStatus = document.getElementById('upload-status');
        
        // Chat elements
        this.elements.chatMessages = document.getElementById('chat-messages');
        this.elements.questionInput = document.getElementById('question-input');
        this.elements.askBtn = document.getElementById('ask-btn');
        this.elements.documentInfo = document.getElementById('document-info');
        this.elements.documentName = document.getElementById('document-name');
        
        // Action buttons
        this.elements.clearBtn = document.getElementById('clear-btn');
        this.elements.newUploadBtn = document.getElementById('new-upload-btn');
        
        // Toast container
        this.elements.toastContainer = document.getElementById('toast-container');
    }
    
    bindEvents() {
        // File upload events
        this.elements.uploadDropZone.addEventListener('click', () => this.elements.pdfUpload.click());
        this.elements.pdfUpload.addEventListener('change', (e) => this.handleFileSelect(e));
        this.elements.uploadBtn.addEventListener('click', () => this.elements.pdfUpload.click());
        
        // Drag and drop events
        this.elements.uploadDropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.elements.uploadDropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.elements.uploadDropZone.addEventListener('drop', (e) => this.handleFileDrop(e));
        
        // Chat events
        this.elements.questionInput.addEventListener('input', () => this.handleInputChange());
        this.elements.questionInput.addEventListener('keypress', (e) => this.handleKeyPress(e));
        this.elements.askBtn.addEventListener('click', () => this.askQuestion());
        
        // Action button events
        this.elements.clearBtn.addEventListener('click', () => this.clearDocument());
        this.elements.newUploadBtn.addEventListener('click', () => this.showUploadSection());
    }
    
    // Health check
    async checkHealth() {
        try {
            const response = await fetch(`${this.config.apiBaseUrl}${this.config.endpoints.health}`);
            if (!response.ok) {
                this.showToast('Backend service unavailable', 'error');
            }
        } catch (error) {
            this.showToast('Cannot connect to backend service', 'error');
        }
    }
    
    // Status check
    async checkStatus() {
        try {
            const response = await fetch(`${this.config.apiBaseUrl}${this.config.endpoints.status}`);
            if (response.ok) {
                const payload = await response.json();
                // Backend returns top-level fields (no data wrapper)
                if (payload.document_processed) {
                    this.state.documentLoaded = true;
                    this.showChatSection();
                    this.updateDocumentInfo(payload);
                }
            }
        } catch (error) {
            console.log('Status check failed:', error);
        }
    }
    
    // File handling
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }
    
    handleDragOver(event) {
        event.preventDefault();
        this.elements.uploadDropZone.classList.add('drag-over');
    }
    
    handleDragLeave(event) {
        event.preventDefault();
        this.elements.uploadDropZone.classList.remove('drag-over');
    }
    
    handleFileDrop(event) {
        event.preventDefault();
        this.elements.uploadDropZone.classList.remove('drag-over');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type === 'application/pdf') {
                this.processFile(file);
            } else {
                this.showToast('Please select a PDF file', 'error');
            }
        }
    }
    
    async processFile(file) {
        if (this.state.isProcessing) return;
        
        this.state.isProcessing = true;
        this.showLoading('Processing document...');
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch(`${this.config.apiBaseUrl}${this.config.endpoints.upload}`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.state.documentLoaded = true;
                // Backend returns top-level fields: filename, text_length, chunks_count
                this.state.currentDocument = {
                    name: file.name,
                    size: file.size,
                    filename: result.filename,
                    text_length: result.text_length,
                    chunks_count: result.chunks_count
                };
                
                this.showToast(result.message || 'Document processed successfully!', 'success');
                this.showChatSection();
                this.updateDocumentInfo(this.state.currentDocument);
                this.elements.uploadStatus.innerHTML = '';
                
            } else {
                throw new Error(result.error || 'Upload failed');
            }
            
        } catch (error) {
            console.error('File processing error:', error);
            this.showToast(`Processing failed: ${error.message}`, 'error');
            this.elements.uploadStatus.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        } finally {
            this.state.isProcessing = false;
            this.hideLoading();
        }
    }
    
    // Chat functionality
    handleInputChange() {
        const hasValue = this.elements.questionInput.value.trim().length > 0;
        this.elements.askBtn.disabled = !hasValue || this.state.isAsking;
    }
    
    handleKeyPress(event) {
        if (event.key === 'Enter' && !this.elements.askBtn.disabled) {
            this.askQuestion();
        }
    }
    
    async askQuestion() {
        const question = this.elements.questionInput.value.trim();
        if (!question || this.state.isAsking) return;
        
        this.state.isAsking = true;
        this.elements.askBtn.disabled = true;
        
        // Add user message
        this.addMessage(question, 'user');
        this.elements.questionInput.value = '';
        this.handleInputChange();
        
        try {
            const response = await fetch(`${this.config.apiBaseUrl}${this.config.endpoints.query}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Backend returns top-level answer
                this.addMessage(result.answer, 'ai');
            } else {
                throw new Error(result.error || 'Failed to get answer');
            }
            
        } catch (error) {
            console.error('Question error:', error);
            this.addMessage(`Error: ${error.message}`, 'error');
        } finally {
            this.state.isAsking = false;
            this.handleInputChange();
        }
    }
    
    addMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = content;
        
        this.elements.chatMessages.appendChild(messageDiv);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }
    
    // Document management
    async clearDocument() {
        if (!confirm('Are you sure you want to clear the current document? This action cannot be undone.')) {
            return;
        }
        
        try {
            const response = await fetch(`${this.config.apiBaseUrl}${this.config.endpoints.clear}`, {
                method: 'POST'
            });
            
            if (response.ok) {
                this.state.documentLoaded = false;
                this.state.currentDocument = null;
                this.showToast('Document cleared successfully', 'success');
                this.showUploadSection();
                this.clearChat();
            } else {
                throw new Error('Failed to clear document');
            }
            
        } catch (error) {
            console.error('Clear error:', error);
            this.showToast(`Failed to clear document: ${error.message}`, 'error');
        }
    }
    
    clearChat() {
        this.elements.chatMessages.innerHTML = `
            <div class="welcome-message">
                <i class="fas fa-robot"></i>
                <p>Hello! I've analyzed your document. Ask me any questions about it.</p>
            </div>
        `;
    }
    
    // UI state management
    showUploadSection() {
        this.elements.uploadSection.classList.remove('hidden');
        this.elements.chatSection.classList.add('hidden');
        this.elements.uploadStatus.innerHTML = '';
    }
    
    showChatSection() {
        this.elements.uploadSection.classList.add('hidden');
        this.elements.chatSection.classList.remove('hidden');
        this.elements.questionInput.focus();
    }
    
    showLoading(text = 'Processing...') {
        this.elements.loadingText.textContent = text;
        this.elements.loadingOverlay.classList.remove('hidden');
    }
    
    hideLoading() {
        this.elements.loadingOverlay.classList.add('hidden');
    }
    
    updateDocumentInfo(data) {
        if (this.state.currentDocument) {
            this.elements.documentName.textContent = this.state.currentDocument.name;
        }
    }
    
    // Toast notifications
    showToast(message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        
        toast.innerHTML = `
            <div class="toast-header">
                <span class="toast-title">${this.getToastTitle(type)}</span>
                <button class="toast-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="toast-message">${message}</div>
        `;
        
        this.elements.toastContainer.appendChild(toast);
        
        // Auto-remove after duration
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, duration);
        
        // Add click to dismiss
        toast.addEventListener('click', () => toast.remove());
    }
    
    getToastTitle(type) {
        const titles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Information'
        };
        return titles[type] || 'Information';
    }
    
    // Utility methods
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.legalAIApp = new LegalAIApp();
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LegalAIApp;
}

// Tab navigation
(function tabs(){
  document.addEventListener('DOMContentLoaded', () => {
    const tabs = Array.from(document.querySelectorAll('.nav-tab'));
    const sections = ['#upload-section', '#advisory-section'].map(s => document.querySelector(s));
    function show(target){
      sections.forEach(sec => sec.classList.add('hidden-tab'));
      const el = document.querySelector(target);
      if (el) el.classList.remove('hidden-tab');
      tabs.forEach(t => t.classList.toggle('active', t.dataset.target === target));
    }
    // initialize
    show('#upload-section');
    tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.target)));
  });
})();

/* Append advisory tools wiring */
(function attachAdvisoryTools(){
    document.addEventListener('DOMContentLoaded', () => {
        // If new result-block UI exists, skip legacy wiring to avoid raw JSON output
        if (document.querySelector('.result-block')) return;
        const apiBase = (window.legalAIApp && window.legalAIApp.config.apiBaseUrl) || 'http://127.0.0.1:5000';

        // Checklist (legacy)
        const btnChecklist = document.getElementById('generate-checklist');
        const outChecklist = document.getElementById('checklist-output');
        if (btnChecklist && outChecklist) {
            btnChecklist.addEventListener('click', async () => {
                const scenario = {
                    country: document.getElementById('scenario-country')?.value || '',
                    state: document.getElementById('scenario-state')?.value || '',
                    company_type: document.getElementById('scenario-company-type')?.value || '',
                    industry: document.getElementById('scenario-industry')?.value || '',
                    online_business: document.getElementById('scenario-online')?.checked || false,
                    handles_personal_data: document.getElementById('scenario-personal-data')?.checked || false,
                };
                outChecklist.textContent = 'Generating checklist...';
                try {
                    const res = await fetch(`${apiBase}/api/checklist`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(scenario)
                    });
                    const data = await res.json();
                    if (!res.ok && data.error) throw new Error(data.error);
                    outChecklist.textContent = JSON.stringify(data, null, 2);
                } catch (e) {
                    outChecklist.textContent = `Error: ${e.message}`;
                }
            });
        }

        // Summarize (legacy)
        const btnSum = document.getElementById('summarize-btn');
        const inSum = document.getElementById('summary-input');
        const outSum = document.getElementById('summary-output');
        if (btnSum && inSum && outSum) {
            btnSum.addEventListener('click', async () => {
                const content = inSum.value.trim();
                if (!content) return;
                outSum.textContent = 'Summarizing...';
                try {
                    const res = await fetch(`${apiBase}/api/summarize`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content })
                    });
                    const data = await res.json();
                    if (!res.ok && data.error) throw new Error(data.error);
                    outSum.textContent = JSON.stringify(data, null, 2);
                } catch (error) {
                    outSum.textContent = `Error: ${error.message}`;
                }
            });
        }

        // Explain (legacy)
        const btnExplain = document.getElementById('explain-btn');
        const inClause = document.getElementById('clause-input');
        const outExplain = document.getElementById('explain-output');
        if (btnExplain && inClause && outExplain) {
            btnExplain.addEventListener('click', async () => {
                const clause = inClause.value.trim();
                if (!clause) return;
                outExplain.textContent = 'Explaining...';
                try {
                    const res = await fetch(`${apiBase}/api/explain`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ clause })
                    });
                    const data = await res.json();
                    if (!res.ok && data.error) throw new Error(data.error);
                    outExplain.textContent = JSON.stringify(data, null, 2);
                } catch (error) {
                    outExplain.textContent = `Error: ${error.message}`;
                }
            });
        }

        // Classify (legacy)
        const btnClassify = document.getElementById('classify-btn');
        const filesClassify = document.getElementById('classify-files');
        const outClassify = document.getElementById('classify-output');
        if (btnClassify && filesClassify && outClassify) {
            btnClassify.addEventListener('click', async () => {
                if (!filesClassify.files || filesClassify.files.length === 0) return;
                outClassify.textContent = 'Classifying...';
                try {
                    const fd = new FormData();
                    Array.from(filesClassify.files).forEach(f => fd.append('files', f));
                    const res = await fetch(`${apiBase}/api/classify`, { method: 'POST', body: fd });
                    const data = await res.json();
                    if (!res.ok && data.error) throw new Error(data.error);
                    outClassify.textContent = JSON.stringify(data, null, 2);
                } catch (error) {
                    outClassify.textContent = `Error: ${error.message}`;
                }
            });
        }

        // Gap (legacy)
        const btnGap = document.getElementById('gap-btn');
        const inChecklist = document.getElementById('gap-checklist');
        const inDocs = document.getElementById('gap-documents');
        const outGap = document.getElementById('gap-output');
        if (btnGap && inChecklist && inDocs && outGap) {
            btnGap.addEventListener('click', async () => {
                let checklist, documents;
                try { checklist = JSON.parse(inChecklist.value); } catch { outGap.textContent = 'Invalid checklist JSON'; return; }
                try {
                    const parsed = JSON.parse(inDocs.value);
                    documents = parsed.documents || parsed;
                } catch { outGap.textContent = 'Invalid documents JSON'; return; }
                outGap.textContent = 'Analyzing gaps...';
                try {
                    const res = await fetch(`${apiBase}/api/gap`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ checklist, documents })
                    });
                    const data = await res.json();
                    if (!res.ok && data.error) throw new Error(data.error);
                    outGap.textContent = JSON.stringify(data, null, 2);
                } catch (error) {
                    outGap.textContent = `Error: ${error.message}`;
                }
            });
        }
    });
})();

// Theme toggle and render helpers
(function uiEnhancements(){
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      const saved = localStorage.getItem('theme') || 'light';
      if (saved === 'dark') root.setAttribute('data-theme', 'dark');
      btn.addEventListener('click', () => {
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        if (next === 'dark') root.setAttribute('data-theme', 'dark'); else root.removeAttribute('data-theme');
        localStorage.setItem('theme', next);
      });
    }

    // Toggle view / copy JSON
    function bindResultBlock(key){
      const toggle = document.querySelector(`.toggle-view[data-target="${key}"]`);
      const copy = document.querySelector(`.copy-json[data-target="${key}"]`);
      const rendered = document.getElementById(`${key}-output`);
      const jsonEl = document.getElementById(`${key}-json`);
      if (toggle && rendered && jsonEl) {
        toggle.addEventListener('click', () => {
          const showingJson = !jsonEl.classList.contains('hidden');
          if (showingJson) {
            jsonEl.classList.add('hidden');
            rendered.classList.remove('hidden');
            toggle.textContent = 'View JSON';
          } else {
            jsonEl.classList.remove('hidden');
            rendered.classList.add('hidden');
            toggle.textContent = 'View Rendered';
          }
        });
      }
      if (copy && jsonEl) {
        copy.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(jsonEl.textContent || ''); } catch {}
        });
      }
    }
    ['checklist','summary','explain','classify','gap'].forEach(bindResultBlock);

    // Pretty render helpers
    function setJSON(key, data){
      const el = document.getElementById(`${key}-json`);
      if (el) el.textContent = JSON.stringify(data, null, 2);
    }
    function setRendered(key, node){
      const el = document.getElementById(`${key}-output`);
      if (el) { el.innerHTML = ''; el.appendChild(node); }
    }

    function renderList(items){
      const ul = document.createElement('ul');
      ul.style.margin = '0';
      items.forEach(i => { const li = document.createElement('li'); li.textContent = typeof i === 'string' ? i : JSON.stringify(i); ul.appendChild(li); });
      return ul;
    }

    function renderChecklist(data){
      const wrap = document.createElement('div');
      const h = document.createElement('h4'); h.textContent = `${data.entity_type || ''} • ${data.jurisdiction || ''}`.trim(); wrap.appendChild(h);
      if (Array.isArray(data.assumptions) && data.assumptions.length){
        const t = document.createElement('div'); t.innerHTML = '<strong>Assumptions</strong>'; wrap.appendChild(t); wrap.appendChild(renderList(data.assumptions));
      }
      if (Array.isArray(data.checklist)){
        const g = document.createElement('div'); g.innerHTML = '<strong>Checklist</strong>'; wrap.appendChild(g);
        const list = document.createElement('ol');
        data.checklist.forEach(item => {
          const li = document.createElement('li');
          const title = document.createElement('div'); title.innerHTML = `<strong>${item.title || item.id}</strong> ${item.mandatory ? '<span style="color:#10b981">(mandatory)</span>' : ''}`;
          const desc = document.createElement('div'); desc.textContent = item.description || '';
          li.appendChild(title); li.appendChild(desc); list.appendChild(li);
        });
        wrap.appendChild(list);
      }
      return wrap;
    }

    function renderSummary(data){
      const wrap = document.createElement('div');
      const s = document.createElement('p'); s.textContent = data.summary || ''; wrap.appendChild(s);
      const cols = document.createElement('div'); cols.style.display = 'grid'; cols.style.gridTemplateColumns = 'repeat(2, minmax(0,1fr))'; cols.style.gap='1rem';
      const left = document.createElement('div'); left.innerHTML = '<strong>Key points</strong>'; left.appendChild(renderList(data.key_points || []));
      const right = document.createElement('div'); right.innerHTML = '<strong>Obligations</strong>'; right.appendChild(renderList(data.obligations || []));
      cols.appendChild(left); cols.appendChild(right); wrap.appendChild(cols);
      const tl = document.createElement('div'); tl.innerHTML = '<strong>Timelines</strong>'; wrap.appendChild(tl); wrap.appendChild(renderList(data.timelines || []));
      const rk = document.createElement('div'); rk.innerHTML = '<strong>Risks</strong>'; wrap.appendChild(rk); wrap.appendChild(renderList((data.risks||[]).map(r=>`${r.risk||r} ${r.severity?`(severity: ${r.severity})`:''}`)));
      return wrap;
    }

    function renderExplain(data){
      const wrap = document.createElement('div');
      const e = document.createElement('p'); e.textContent = data.explanation || ''; wrap.appendChild(e);
      const cols = document.createElement('div'); cols.style.display='grid'; cols.style.gridTemplateColumns='repeat(2, minmax(0,1fr))'; cols.style.gap='1rem';
      const pros = document.createElement('div'); pros.innerHTML = '<strong>Pros</strong>'; pros.appendChild(renderList(data.pros || []));
      const cons = document.createElement('div'); cons.innerHTML = '<strong>Cons</strong>'; cons.appendChild(renderList(data.cons || []));
      cols.appendChild(pros); cols.appendChild(cons); wrap.appendChild(cols);
      const rk = document.createElement('div'); rk.innerHTML = '<strong>Risks</strong>'; wrap.appendChild(rk); wrap.appendChild(renderList((data.risks||[]).map(r=>`${r.risk||r} ${r.severity?`(severity: ${r.severity})`:''}`)));
      return wrap;
    }

    function renderClassify(data){
      const wrap = document.createElement('div');
      const docs = Array.isArray(data.documents) ? data.documents : [];
      docs.forEach(d => {
        const card = document.createElement('div'); card.style.border='1px solid var(--gray-200)'; card.style.padding='0.75rem'; card.style.borderRadius='0.5rem'; card.style.marginBottom='0.5rem';
        const t = document.createElement('div'); t.innerHTML = `<strong>${d.filename}</strong> • <span>${d.doc_type||'Unknown'}</span>`; card.appendChild(t);
        const s = document.createElement('div'); s.textContent = d.summary || ''; card.appendChild(s);
        wrap.appendChild(card);
      });
      return wrap;
    }

    function renderGap(data){
      const wrap = document.createElement('div');
      const miss = document.createElement('div'); miss.innerHTML = '<strong>Missing Items</strong>'; wrap.appendChild(miss); wrap.appendChild(renderList(data.missing_items||[]));
      const partial = document.createElement('div'); partial.innerHTML = '<strong>Partially Covered</strong>'; wrap.appendChild(partial); wrap.appendChild(renderList((data.partially_covered||[]).map(p=>`${p.id||JSON.stringify(p)} ${p.note?`- ${p.note}`:''}`)));
      const recs = document.createElement('div'); recs.innerHTML = '<strong>Recommendations</strong>'; wrap.appendChild(recs); wrap.appendChild(renderList(data.recommendations||[]));
      return wrap;
    }

    // Expose setters used by advisory tool handlers
    window.LE_RENDER = { setJSON, setRendered, renderChecklist, renderSummary, renderExplain, renderClassify, renderGap };
  });
})();

(function integrateRenders(){
  document.addEventListener('DOMContentLoaded', () => {
    const R = window.LE_RENDER;
    if (!R) return;

    // Checklist
    const btnChecklist = document.getElementById('generate-checklist');
    if (btnChecklist) {
      btnChecklist.addEventListener('click', async () => {
        const apiBase = (window.legalAIApp && window.legalAIApp.config.apiBaseUrl) || 'http://127.0.0.1:5000';
        const scenario = {
          country: document.getElementById('scenario-country')?.value || '',
          state: document.getElementById('scenario-state')?.value || '',
          company_type: document.getElementById('scenario-company-type')?.value || '',
          industry: document.getElementById('scenario-industry')?.value || '',
          online_business: document.getElementById('scenario-online')?.checked || false,
          handles_personal_data: document.getElementById('scenario-personal-data')?.checked || false,
        };
        R.setRendered('checklist', document.createTextNode('Generating checklist...'));
        try {
          const res = await fetch(`${apiBase}/api/checklist`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(scenario)});
          const data = await res.json();
          if (!res.ok && data.error) throw new Error(data.error);
          R.setJSON('checklist', data);
          R.setRendered('checklist', R.renderChecklist(data));
        } catch (e) { R.setRendered('checklist', document.createTextNode(`Error: ${e.message}`)); }
      });
    }

    // Summarize
    const btnSum = document.getElementById('summarize-btn');
    if (btnSum) {
      btnSum.addEventListener('click', async () => {
        const apiBase = (window.legalAIApp && window.legalAIApp.config.apiBaseUrl) || 'http://127.0.0.1:5000';
        const content = document.getElementById('summary-input')?.value?.trim(); if (!content) return;
        R.setRendered('summary', document.createTextNode('Summarizing...'));
        try {
          const res = await fetch(`${apiBase}/api/summarize`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({content})});
          const data = await res.json();
          if (!res.ok && data.error) throw new Error(data.error);
          R.setJSON('summary', data);
          R.setRendered('summary', R.renderSummary(data));
        } catch (e) { R.setRendered('summary', document.createTextNode(`Error: ${e.message}`)); }
      });
    }

    // Explain
    const btnExplain = document.getElementById('explain-btn');
    if (btnExplain) {
      btnExplain.addEventListener('click', async () => {
        const apiBase = (window.legalAIApp && window.legalAIApp.config.apiBaseUrl) || 'http://127.0.0.1:5000';
        const clause = document.getElementById('clause-input')?.value?.trim(); if (!clause) return;
        R.setRendered('explain', document.createTextNode('Explaining...'));
        try {
          const res = await fetch(`${apiBase}/api/explain`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({clause})});
          const data = await res.json();
          if (!res.ok && data.error) throw new Error(data.error);
          R.setJSON('explain', data);
          R.setRendered('explain', R.renderExplain(data));
        } catch (e) { R.setRendered('explain', document.createTextNode(`Error: ${e.message}`)); }
      });
    }

    // Classify
    const btnClassify = document.getElementById('classify-btn');
    if (btnClassify) {
      btnClassify.addEventListener('click', async () => {
        const apiBase = (window.legalAIApp && window.legalAIApp.config.apiBaseUrl) || 'http://127.0.0.1:5000';
        const files = document.getElementById('classify-files')?.files; if (!files || files.length===0) return;
        R.setRendered('classify', document.createTextNode('Classifying...'));
        try {
          const fd = new FormData(); Array.from(files).forEach(f=>fd.append('files', f));
          const res = await fetch(`${apiBase}/api/classify`, { method: 'POST', body: fd });
          const data = await res.json();
          if (!res.ok && data.error) throw new Error(data.error);
          R.setJSON('classify', data);
          R.setRendered('classify', R.renderClassify(data));
        } catch (e) { R.setRendered('classify', document.createTextNode(`Error: ${e.message}`)); }
      });
    }

    // Gap
    const btnGap = document.getElementById('gap-btn');
    if (btnGap) {
      btnGap.addEventListener('click', async () => {
        const apiBase = (window.legalAIApp && window.legalAIApp.config.apiBaseUrl) || 'http://127.0.0.1:5000';
        let checklist, documents;
        try { checklist = JSON.parse(document.getElementById('gap-checklist')?.value || '{}'); } catch { R.setRendered('gap', document.createTextNode('Invalid checklist JSON')); return; }
        try {
          const raw = document.getElementById('gap-documents')?.value || '[]';
          const parsed = JSON.parse(raw); documents = parsed.documents || parsed;
        } catch { R.setRendered('gap', document.createTextNode('Invalid documents JSON')); return; }
        R.setRendered('gap', document.createTextNode('Analyzing...'));
        try {
          const res = await fetch(`${apiBase}/api/gap`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({checklist, documents})});
          const data = await res.json();
          if (!res.ok && data.error) throw new Error(data.error);
          R.setJSON('gap', data);
          R.setRendered('gap', R.renderGap(data));
        } catch (e) { R.setRendered('gap', document.createTextNode(`Error: ${e.message}`)); }
      });
    }
  });
})();

(function oneClickAnalysis(){
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('analyze-btn');
    const input = document.getElementById('analyze-file');
    if (!btn || !input) return;
    const apiBase = (window.legalAIApp && window.legalAIApp.config.apiBaseUrl) || 'http://127.0.0.1:5000';

    function renderListTo(id, arr, formatter){
      const el = document.getElementById(id); if (!el) return; el.innerHTML = '';
      (arr||[]).forEach(x => { const li = document.createElement('li'); li.textContent = formatter? formatter(x) : (typeof x === 'string' ? x : JSON.stringify(x)); el.appendChild(li); });
    }

    btn.addEventListener('click', async () => {
      if (!input.files || input.files.length === 0) return;
      const fd = new FormData(); fd.append('file', input.files[0]);
      // Loading states
      renderListTo('analysis-obligations', ['Loading...']);
      renderListTo('analysis-timelines', ['Loading...']);
      renderListTo('analysis-risks', ['Loading...']);
      renderListTo('analysis-glossary', ['Loading...']);
      const R = window.LE_RENDER;
      if (R) { R.setRendered('analysis-summary', document.createTextNode('Analyzing...')); }
      try {
        const res = await fetch(`${apiBase}/api/analyze`, { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok && data.error) throw new Error(data.error);
        // Summary
        if (R) {
          R.setJSON('analysis-summary', data.summary || {});
          R.setRendered('analysis-summary', R.renderSummary(data.summary || {}));
        }
        // Lists
        renderListTo('analysis-obligations', data.obligations || []);
        renderListTo('analysis-timelines', data.timelines || []);
        renderListTo('analysis-risks', (data.risks||[]).map(r=>`${r.risk||r} ${r.severity?`(severity: ${r.severity})`:''}`));
        renderListTo('analysis-glossary', data.glossary || [], g => `${g.term||''}: ${g.definition||''}`);
        // Clauses
        const clausesEl = document.getElementById('analysis-clauses'); if (clausesEl) { clausesEl.innerHTML=''; }
        (data.clauses||[]).forEach(c => {
          const card = document.createElement('div'); card.className='analysis-card';
          const title = document.createElement('div'); title.className='analysis-title'; title.textContent = c.title || 'Clause'; card.appendChild(title);
          const plain = document.createElement('p'); plain.textContent = c.text || ''; card.appendChild(plain);
          const exp = (c.analysis||{});
          const expl = document.createElement('p'); expl.textContent = exp.explanation || ''; card.appendChild(expl);
          const pros = document.createElement('ul'); (exp.pros||[]).forEach(p=>{ const li=document.createElement('li'); li.textContent=p; pros.appendChild(li); });
          const cons = document.createElement('ul'); (exp.cons||[]).forEach(p=>{ const li=document.createElement('li'); li.textContent=p; cons.appendChild(li); });
          const grid = document.createElement('div'); grid.style.display='grid'; grid.style.gridTemplateColumns='repeat(2, minmax(0,1fr))'; grid.style.gap='1rem';
          const prosWrap = document.createElement('div'); prosWrap.innerHTML='<strong>Pros</strong>'; prosWrap.appendChild(pros);
          const consWrap = document.createElement('div'); consWrap.innerHTML='<strong>Cons</strong>'; consWrap.appendChild(cons);
          grid.appendChild(prosWrap); grid.appendChild(consWrap); card.appendChild(grid);
          clausesEl && clausesEl.appendChild(card);
        });
        // Recos
        renderListTo('analysis-recos', data.recommendations || []);
      } catch (e) {
        if (R) { R.setRendered('analysis-summary', document.createTextNode(`Error: ${e.message}`)); }
        renderListTo('analysis-obligations', []);
        renderListTo('analysis-timelines', []);
        renderListTo('analysis-risks', []);
        renderListTo('analysis-glossary', []);
        const clausesEl = document.getElementById('analysis-clauses'); if (clausesEl) clausesEl.innerHTML='';
        renderListTo('analysis-recos', []);
      }
    });
  });
})();

(function uxImprovements(){
  document.addEventListener('DOMContentLoaded', () => {
    // Drag & drop for analyze
    const drop = document.getElementById('analyze-drop');
    const input = document.getElementById('analyze-file');
    if (drop && input) {
      ['dragover','dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('drag-over'); }));
      ;['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('drag-over'); }));
      drop.addEventListener('drop', e => { if (e.dataTransfer?.files?.[0]) { input.files = e.dataTransfer.files; } });
    }

    // Example fillers
    const sumEx = document.getElementById('summary-example');
    if (sumEx) sumEx.addEventListener('click', () => {
      const t = document.getElementById('summary-input');
      if (t) t.value = 'This Master Service Agreement governs the relationship between Acme and Client. Payment terms are Net 30. Either party may terminate for material breach with 30 days notice. Confidentiality obligations last 2 years. The governing law is California. Liability is capped at fees paid in the last 12 months.';
    });
    const clauseEx = document.getElementById('clause-example');
    if (clauseEx) clauseEx.addEventListener('click', () => {
      const t = document.getElementById('clause-input');
      if (t) t.value = 'Limitation of Liability: Except for willful misconduct, in no event will either party be liable for any indirect, incidental, or consequential damages. Aggregate liability is limited to the fees paid in the twelve (12) months preceding the claim.';
    });

    // Export JSON (analysis)
    const exportBtns = document.querySelectorAll('.export-json[data-target="analysis"]');
    exportBtns.forEach(b => b.addEventListener('click', () => {
      const jsonEl = document.getElementById('analysis-summary-json');
      try {
        const blob = new Blob([jsonEl?.textContent || '{}'], {type:'application/json'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'analysis.json'; a.click(); URL.revokeObjectURL(a.href);
      } catch {}
    }));

    // Clause expand/collapse
    const clausesWrap = document.getElementById('analysis-clauses');
    if (clausesWrap) clausesWrap.addEventListener('click', (e) => {
      const card = e.target.closest('.analysis-card');
      if (!card) return;
      const body = Array.from(card.children).slice(1);
      body.forEach((node, idx) => { if (idx>0) node.classList.toggle('hidden'); });
    });
  });
})();