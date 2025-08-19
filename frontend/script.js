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
                const data = await response.json();
                if (data.data.document_processed) {
                    this.state.documentLoaded = true;
                    this.showChatSection();
                    this.updateDocumentInfo(data.data);
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
                this.state.currentDocument = {
                    name: file.name,
                    size: file.size,
                    ...result.data
                };
                
                this.showToast('Document processed successfully!', 'success');
                this.showChatSection();
                this.updateDocumentInfo(result.data);
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
                this.addMessage(result.data.answer, 'ai');
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