// Initialize Lucide icons
lucide.createIcons();

// DOM Elements
const welcomeScreen = document.getElementById('welcome-screen');
const chatContainer = document.getElementById('chat-container');
const chatInput = document.getElementById('chat-input');
const btnSend = document.getElementById('btn-send');
const btnApiKey = document.getElementById('btn-api-key');
const apiKeyStatus = document.getElementById('api-key-status');
const btnTheme = document.getElementById('btn-theme');
const btnLang = document.getElementById('btn-lang');
const btnInstall = document.getElementById('btn-install');
const apiModal = document.getElementById('api-modal');
const modalClose = document.getElementById('modal-close');
const apiKeyInput = document.getElementById('api-key-input');
const btnSaveKey = document.getElementById('btn-save-key');
const quickPrompts = document.querySelectorAll('.prompt-card');

// App State
let apiKey = localStorage.getItem('gemini_api_key') || '';
let chatHistory = [];
let isDarkTheme = false;
let preferredLang = localStorage.getItem('preferred_lang') || 'bi'; // 'bi' = bilingual, 'en' = English, 'my' = Myanmar
let deferredPrompt;

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker Registered!', reg))
      .catch(err => console.error('Service Worker Registration Failed:', err));
  });
}

// PWA Install Event Handler
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (btnInstall) {
    btnInstall.style.display = 'flex';
  }
});

if (btnInstall) {
  btnInstall.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User prompt outcome: ${outcome}`);
      deferredPrompt = null;
      btnInstall.style.display = 'none';
    } else {
      alert('To install on iOS: tap the Share button at the bottom of Safari and select "Add to Home Screen".\nTo install on Android: tap the 3-dots menu and select "Install App".');
    }
  });
}

// System Prompt
const getSystemPrompt = () => {
  return `You are a warm, compassionate, and highly professional AI counseling assistant for "Counseling Center". 
You are fluent in both Myanmar (Burmese) language and English.

Key Principles:
1. Language Mirroring: If the user communicates in Myanmar (Burmese), reply entirely in beautiful, natural Myanmar language. If the user communicates in English, reply in English.
2. Empathy & Active Listening: Validate the user's feelings without judgment. Create a safe, comforting space.
3. Practical Guidance: Offer gentle, actionable grounding techniques, mindfulness advice, or stress management tools when appropriate.
4. Disclaimer: You are an AI emotional support assistant. If a user expresses severe crisis or self-harm intent, gently encourage them to reach out to professional healthcare providers, crisis hotlines, or trusted loved ones.
5. Tone: Calm, supportive, warm, and structured. Use clear formatting, bullet points where helpful, and keep paragraphs digestible.`;
};

// Initialize UI
const initUI = () => {
  if (apiKey) {
    apiKeyStatus.textContent = 'Key Active';
    apiKeyStatus.style.color = 'var(--accent-color)';
  }

  // Theme setup
  const savedTheme = localStorage.getItem('app_theme');
  if (savedTheme === 'dark') {
    isDarkTheme = true;
    document.documentElement.setAttribute('data-theme', 'dark');
    btnTheme.innerHTML = '<i data-lucide="sun"></i>';
    lucide.createIcons();
  }
};

// Event Listeners
btnApiKey.addEventListener('click', () => {
  apiKeyInput.value = apiKey;
  apiModal.style.display = 'flex';
});

modalClose.addEventListener('click', () => {
  apiModal.style.display = 'none';
});

apiModal.addEventListener('click', (e) => {
  if (e.target === apiModal) {
    apiModal.style.display = 'none';
  }
});

btnSaveKey.addEventListener('click', () => {
  const val = apiKeyInput.value.trim();
  if (val) {
    apiKey = val;
    localStorage.setItem('gemini_api_key', apiKey);
    apiKeyStatus.textContent = 'Key Active';
    apiKeyStatus.style.color = 'var(--accent-color)';
    apiModal.style.display = 'none';
  } else {
    alert('Please enter a valid API key.');
  }
});

btnTheme.addEventListener('click', () => {
  isDarkTheme = !isDarkTheme;
  if (isDarkTheme) {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('app_theme', 'dark');
    btnTheme.innerHTML = '<i data-lucide="sun"></i>';
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('app_theme', 'light');
    btnTheme.innerHTML = '<i data-lucide="moon"></i>';
  }
  lucide.createIcons();
});

btnLang.addEventListener('click', () => {
  if (preferredLang === 'bi') {
    preferredLang = 'my';
    alert('Language Mode: Myanmar 🇲🇲 (Preferred)');
  } else if (preferredLang === 'my') {
    preferredLang = 'en';
    alert('Language Mode: English 🇬🇧 (Preferred)');
  } else {
    preferredLang = 'bi';
    alert('Language Mode: Auto Detect (Bilingual 🇲🇲 & 🇬🇧)');
  }
  localStorage.setItem('preferred_lang', preferredLang);
});

// Auto-adjust textarea height
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
  btnSend.disabled = !chatInput.value.trim();
});

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!btnSend.disabled) {
      sendMessage();
    }
  }
});

btnSend.addEventListener('click', () => {
  if (!btnSend.disabled) {
    sendMessage();
  }
});

quickPrompts.forEach(card => {
  card.addEventListener('click', () => {
    const promptText = card.getAttribute('data-prompt');
    chatInput.value = promptText;
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
    btnSend.disabled = false;
    sendMessage();
  });
});

// Chat Logic
const formatTime = () => {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatTextToHTML = (text) => {
  // Simple markdown conversion for bold and paragraphs
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => `<p style="margin-bottom: 0.5rem;">${line}</p>`)
    .join('');
};

const appendMessage = (sender, text, isStream = false) => {
  if (welcomeScreen.style.display !== 'none') {
    welcomeScreen.style.display = 'none';
    chatContainer.style.display = 'flex';
  }

  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${sender}`;

  const avatar = document.createElement('div');
  avatar.className = `avatar ${sender}`;
  avatar.textContent = sender === 'user' ? 'U' : 'AI';

  const content = document.createElement('div');
  content.style.flex = '1';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = formatTextToHTML(text);

  const time = document.createElement('div');
  time.className = 'message-time';
  time.innerHTML = `<span>${sender === 'user' ? 'You' : 'Counseling Center'}</span> • <span>${formatTime()}</span>`;

  content.appendChild(bubble);
  content.appendChild(time);

  if (sender === 'user') {
    wrapper.appendChild(content);
    wrapper.appendChild(avatar);
  } else {
    wrapper.appendChild(avatar);
    wrapper.appendChild(content);
  }

  chatContainer.appendChild(wrapper);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  return bubble;
};

const appendTypingIndicator = () => {
  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper bot typing-container';
  
  const avatar = document.createElement('div');
  avatar.className = 'avatar bot';
  avatar.textContent = 'AI';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = `
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatContainer.appendChild(wrapper);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  return wrapper;
};

const sendMessage = async () => {
  if (!apiKey) {
    apiModal.style.display = 'flex';
    alert('Please configure your Gemini API key to start chatting.');
    return;
  }

  const text = chatInput.value.trim();
  if (!text) return;

  // Clear input
  chatInput.value = '';
  chatInput.style.height = 'auto';
  btnSend.disabled = true;

  // Append user message
  appendMessage('user', text);

  // Update history
  chatHistory.push({
    role: 'user',
    parts: [{ text }]
  });

  // Show typing
  const typingIndicator = appendTypingIndicator();

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${apiKey}`;
    
    const payload = {
      systemInstruction: {
        parts: [{ text: getSystemPrompt() }]
      },
      contents: chatHistory
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP Error ${response.status}`);
    }

    // Remove typing indicator
    typingIndicator.remove();

    // Create bot message container for streaming
    const botBubble = appendMessage('bot', '', true);
    let fullResponseText = '';

    // Parse stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Split into json objects
      const parts = buffer.split('\n,\n');
      
      // Process complete json chunks
      for (let i = 0; i < parts.length; i++) {
        let chunkStr = parts[i].trim();
        if (chunkStr.startsWith('[')) chunkStr = chunkStr.slice(1);
        if (chunkStr.endsWith(']')) chunkStr = chunkStr.slice(0, -1);
        if (!chunkStr) continue;

        try {
          const json = JSON.parse(chunkStr);
          const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (candidateText) {
            fullResponseText += candidateText;
            botBubble.innerHTML = formatTextToHTML(fullResponseText);
            chatContainer.scrollTop = chatContainer.scrollHeight;
          }
          // Successfully parsed, remove from buffer
          if (i === parts.length - 1) buffer = '';
        } catch (e) {
          // If incomplete JSON, leave in buffer for next read
          if (i === parts.length - 1) buffer = chunkStr;
        }
      }
    }

    // Add to history
    chatHistory.push({
      role: 'model',
      parts: [{ text: fullResponseText }]
    });

  } catch (error) {
    typingIndicator.remove();
    console.error('Gemini API Error:', error);
    appendMessage('bot', `⚠️ Could not get response: ${error.message}. Please check your API key and connection.`);
  }
};

// Start
initUI();
