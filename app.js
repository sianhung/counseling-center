// Initialize
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
      btnInstall.classList.remove('hidden');
});

btnInstall.addEventListener('click', async () => {
      if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                deferredPrompt = null;
                btnInstall.classList.add('hidden');
      }
});

window.addEventListener('appinstalled', (evt) => {
      console.log('App was installed');
      btnInstall.classList.add('hidden');
});
