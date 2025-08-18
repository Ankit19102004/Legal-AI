document.addEventListener("DOMContentLoaded", () => {
    const uploadButton = document.getElementById("upload-button");
    const pdfUploadInput = document.getElementById("pdf-upload");
    const statusMessage = document.getElementById("status-message");
    const chatSection = document.getElementById("chat-section");
    const askButton = document.getElementById("ask-button");
    const questionInput = document.getElementById("question-input");
    const responseArea = document.getElementById("response-area");

    const API_URL = "http://127.0.0.1:5000"; // Your Flask backend URL

    uploadButton.addEventListener("click", async () => {
        const file = pdfUploadInput.files[0];
        if (!file) {
            updateStatus("Please select a PDF file first.", "error");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        updateStatus("Processing document...", "loading");

        try {
            const response = await fetch(`${API_URL}/upload`, {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {
                updateStatus(result.message, "success");
                chatSection.classList.remove("hidden");
            } else {
                throw new Error(result.error || "Unknown error occurred.");
            }
        } catch (error) {
            updateStatus(`Error: ${error.message}`, "error");
        }
    });

    askButton.addEventListener("click", async () => {
        const question = questionInput.value.trim();
        if (!question) {
            return;
        }

        appendMessage(question, "user");
        questionInput.value = "";

        try {
            const response = await fetch(`${API_URL}/query`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ question: question }),
            });

            const result = await response.json();

            if (response.ok) {
                appendMessage(result.answer, "ai");
            } else {
                throw new Error(result.error || "Failed to get answer.");
            }
        } catch (error) {
            appendMessage(`Error: ${error.message}`, "ai");
        }
    });

    function updateStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.style.color = type === "error" ? "red" : type === "success" ? "green" : "black";
    }

    function appendMessage(text, sender) {
        const messageElement = document.createElement("p");
        messageElement.textContent = text;
        messageElement.className = sender === "user" ? "user-message" : "ai-message";
        responseArea.appendChild(messageElement);
        responseArea.scrollTop = responseArea.scrollHeight; // Auto-scroll
    }
});