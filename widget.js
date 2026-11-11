(function () {
    // 1. Find our script tag on the host page and grab the client ID
    const currentScript = document.currentScript || document.querySelector('script[data-client-id]');
    if (!currentScript) {
        console.error("Chat Widget Error: Missing script tag or data-client-id attribute.");
        return;
    }
    const CLIENT_ID = currentScript.getAttribute('data-client-id');
    const WEBHOOK_URL = "https://granular-flying-tricycle.ngrok-free.dev/webhook/chat";

    // 2. Setup persistent session ID for the visitor
    let sessionId = localStorage.getItem("chatSessionId");
    if (!sessionId) {
        sessionId = "session-" + Math.random().toString(36).substring(2, 9);
        localStorage.setItem("chatSessionId", sessionId);
    }

    // 3. Inject CSS styles into the host page head
    const style = document.createElement('style');
    style.innerHTML = `
        #store-ai-chat-wrapper {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 999999;
            font-family: Arial, sans-serif;
        }
        #store-ai-chat-bubble {
            width: 60px;
            height: 60px;
            background: #4f46e5;
            border-radius: 50%;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: white;
            font-size: 24px;
            transition: transform 0.2s;
        }
        #store-ai-chat-bubble:hover {
            transform: scale(1.05);
        }
        .ai-tooltip {
            position: absolute;
            right: 75px;
            bottom: 12px;
            background: white;
            color: #1f2937;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            white-space: nowrap;
            pointer-events: none;
        }
        #store-ai-chat-container {
            display: none;
            width: 380px;
            height: 500px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            flex-direction: column;
            overflow: hidden;
            position: absolute;
            bottom: 75px;
            right: 0;
            border: 1px solid #e5e7eb;
        }
        #store-ai-chat-container.open {
            display: flex;
        }
        .chat-header { background: #4f46e5; color: white; padding: 16px; font-weight: bold; text-align: center; display: flex; justify-content: space-between; align-items: center; }
        .chat-header button { background: none; border: none; color: white; font-size: 18px; cursor: pointer; }
        .chat-messages { flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; background: #fafafa; }
        .message { max-width: 80%; padding: 10px 14px; border-radius: 8px; font-size: 14px; line-height: 1.4; word-wrap: break-word; }
        .message.user { background: #4f46e5; color: white; align-self: flex-end; }
        .message.assistant { background: #e5e7eb; color: #1f2937; align-self: flex-start; }
        
        .message.typing { background: #e5e7eb; color: #4b5563; font-style: italic; display: flex; align-items: center; gap: 4px; }
        .typing-dots span {
            height: 6px; width: 6px; float: left; margin: 0 1px;
            background-color: #9ca3af; border-radius: 50%; display: inline-block;
            animation: bounce 1.3s infinite ease-in-out;
        }
        .typing-dots span:nth-child(2) { animation-delay: -1.1s; }
        .typing-dots span:nth-child(3) { animation-delay: -0.9s; }
        @keyframes bounce {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-4px); }
        }

        .chat-input-area { display: flex; padding: 12px; background: white; border-top: 1px solid #e5e7eb; }
        .chat-input-area input { flex: 1; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; outline: none; font-size: 14px; }
        .chat-input-area button { background: #4f46e5; color: white; border: none; padding: 10px 16px; margin-left: 8px; border-radius: 6px; cursor: pointer; font-weight: bold; }
        .chat-input-area button:hover { background: #4338ca; }
    `;
    document.head.appendChild(style);

    // 4. Inject Widget HTML structure into the body
    const wrapper = document.createElement('div');
    wrapper.id = 'store-ai-chat-wrapper';
    wrapper.innerHTML = `
        <div class="ai-tooltip">Chat with AI ✨</div>
        <div id="store-ai-chat-container">
            <div class="chat-header">
                <span>Store Virtual Assistant</span>
                <button id="closeChat">&times;</button>
            </div>
            <div id="chatMessages" class="chat-messages">
                <div class="message assistant">Hello! How can I help you today?</div>
            </div>
            <div class="chat-input-area">
                <input type="text" id="userInput" placeholder="Type a message..." autocomplete="off">
                <button id="sendBtn">Send</button>
            </div>
        </div>
        <div id="store-ai-chat-bubble">💬</div>
    `;
    document.body.appendChild(wrapper);

    // 5. Element references & Event Handlers
    const bubble = document.getElementById("store-ai-chat-bubble");
    const container = document.getElementById("store-ai-chat-container");
    const closeBtn = document.getElementById("closeChat");
    const sendBtn = document.getElementById("sendBtn");
    const inputField = document.getElementById("userInput");

    bubble.addEventListener("click", () => {
        container.classList.toggle("open");
        if (container.classList.contains("open")) {
            inputField.focus();
        }
    });

    closeBtn.addEventListener("click", () => {
        container.classList.remove("open");
    });

    async function sendMessage() {
        const messageText = inputField.value.trim();
        if (!messageText) return;

        appendMessage(messageText, "user");
        inputField.value = "";

        const typingMsgId = appendTypingIndicator("Assistant is thinking...");
        let slowTimer = setTimeout(() => {
            updateTypingIndicator(typingMsgId, "This is taking a bit longer than usual, still working on it...");
        }, 6000);

        try {
            const response = await fetch(WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId: CLIENT_ID,
                    sessionId: sessionId,
                    message: messageText
                })
            });

            clearTimeout(slowTimer);
            removeMessage(typingMsgId);

            if (!response.ok) {
                throw new Error("Server error");
            }

            const data = await response.json();
            
            let botReply = "Sorry, I couldn't process that.";
            if (typeof data === 'string') {
                botReply = data;
            } else if (data.output) {
                botReply = data.output;
            } else if (data.response) {
                botReply = data.response;
            } else if (data.content) {
                botReply = data.content;
            } else if (data.message) {
                botReply = data.message;
            } else if (data.error) {
                botReply = data.error;
            } else {
                botReply = JSON.stringify(data);
            }

            appendMessage(botReply, "assistant");
        } catch (error) {
            clearTimeout(slowTimer);
            removeMessage(typingMsgId);
            console.error("Error:", error);
            appendMessage("Connection error. Please try again later.", "assistant");
        }
    }

    function appendMessage(text, sender) {
        const messagesDiv = document.getElementById("chatMessages");
        const msgDiv = document.createElement("div");
        msgDiv.className = `message ${sender}`;
        msgDiv.textContent = text;
        messagesDiv.appendChild(msgDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function appendTypingIndicator(text) {
        const messagesDiv = document.getElementById("chatMessages");
        const msgDiv = document.createElement("div");
        const uniqueId = "msg-" + Date.now();
        msgDiv.id = uniqueId;
        msgDiv.className = `message assistant typing`;
        msgDiv.innerHTML = `<span id="${uniqueId}-text">${text}</span> <div class="typing-dots"><span></span><span></span><span></span></div>`;
        messagesDiv.appendChild(msgDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        return uniqueId;
    }

    function updateTypingIndicator(uniqueId, newText) {
        const textSpan = document.getElementById(`${uniqueId}-text`);
        if (textSpan) {
            textSpan.textContent = newText;
        }
    }

    function removeMessage(uniqueId) {
        const msgDiv = document.getElementById(uniqueId);
        if (msgDiv) {
            msgDiv.remove();
        }
    }

    sendBtn.addEventListener("click", sendMessage);
    inputField.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            sendMessage();
        }
    });
})();
