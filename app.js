// Counseling Center AI Assistant - v8.0.0
// Initialize Lucide icons safely on load
document.addEventListener('DOMContentLoaded', () => {
  if (typeof lucide !== 'undefined') {
    try { lucide.createIcons(); } catch (e) { console.warn('Lucide icons error:', e); }
  }

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
  const btnProfile = document.getElementById('btn-profile');
  const onboardingFlow = document.getElementById('onboarding-flow');
  const settingsMenu = document.getElementById('settings-menu');
  const onboardingSteps = document.querySelectorAll('.onboarding-step');
  const btnStartOnboarding = document.getElementById('btn-start-onboarding');
  const btnPhoneNext = document.getElementById('btn-phone-next');
  const btnProfileNext = document.getElementById('btn-profile-next');
  const btnFinishOnboarding = document.getElementById('btn-finish-onboarding');
  const btnStepBacks = document.querySelectorAll('.btn-step-back');
  const interestGrid = document.getElementById('interest-grid');
  const inputPhone = document.getElementById('input-phone');
  const inputName = document.getElementById('input-name');
  const inputDOB = document.getElementById('input-dob');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnSettingAccount = document.getElementById('btn-setting-account');
  const btnSettingTopics = document.getElementById('btn-setting-topics');
  const topicsSubtitle = document.getElementById('topics-subtitle');
  const btnLogout = document.getElementById('btn-logout');
  const sidebar = document.getElementById('sidebar');
  const btnMenuToggle = document.getElementById('btn-menu-toggle');
  const btnSidebarToggleClose = document.getElementById('btn-sidebar-toggle-close');
  const btnNewChat = document.getElementById('btn-new-chat');
  const historyList = document.getElementById('history-list');
  const btnBackToHome = document.getElementById('btn-back-to-home');
  const chatViewHeader = document.getElementById('chat-view-header');
  const activeChatTitle = document.getElementById('active-chat-title');
  const btnSidebarSettings = document.getElementById('btn-sidebar-settings');

  // App State - sanitize stored key if corrupted
  let storedKey = localStorage.getItem('gemini_api_key') || '';
  const keyMatch = storedKey.match(/(AIzaSy[a-zA-Z0-9_\-]{33})/);
  let apiKey = keyMatch ? keyMatch[1] : '';

  let sessions = JSON.parse(localStorage.getItem('chat_sessions')) || [];
  let currentSessionId = null;
  let chatHistory = [];
  let isDarkTheme = false;
  let preferredLang = localStorage.getItem('preferred_lang') || 'bi';
  let userProfile = JSON.parse(localStorage.getItem('user_profile')) || null;
  let currentStep = 0;
  let selectedInterests = [];
  let isChoosingTopicForChat = false;
  let deferredPrompt;

  const interestsData = [
    { id: 'spiritual', label: 'ဝိညာဉ်ရေးရာ တိုက်ပွဲများနှင့် သံသယများ (Spiritual Struggles & Doubts)' },
    { id: 'marriage', label: 'အိမ်ထောင်ရေးနှင့် မိသားစုဆက်ဆံရေး (ကျမ်းစာအခြေခံ) (Biblical Marriage & Family Dynamics)' },
    { id: 'guilt', label: 'အပြစ်ရှိသလို ခံစားရခြင်းနှင့် ခွင့်လွှတ်ခြင်း (Guilt, Shame & Forgiveness)' },
    { id: 'will', label: 'ဘုရားသခင်၏ အလိုတော်ကို ရှာဖွေခြင်း (Seeking God’s Will & Discernment)' },
    { id: 'grief', label: 'ဝမ်းနည်းပူဆွေးမှုနှင့် မျှော်လင့်ခြင်း (Grief & Hope in Suffering)' },
    { id: 'purity', label: 'စာရိတ္တနှင့် စင်ကြယ်ခြင်းဆိုင်ရာ ကိစ္စရပ်များ (Moral Struggles & Purity)' },
    { id: 'church', label: 'အသင်းတော်နှင့် ဝတ်ပြုရေးဆိုင်ရာ စိတ်ဒဏ်ရာများ (Church-related Hurt or Trauma)' },
    { id: 'identity', label: 'ခရစ်ယာန်တစ်ဦး၏ ကိုယ်ပိုင်လက္ခဏာ (Identity in Christ)' },
    { id: 'anger', label: 'ဒေါသနှင့် ရန်ငြိုးဖွဲ့ခြင်းကို ကုစားခြင်း (Healing Anger & Bitterness)' },
    { id: 'addiction', label: 'စွဲလမ်းမှုများမှ လွတ်မြောက်ခြင်း (Freedom from Addictions)' }
  ];

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
    return `You are a warm, compassionate, and faith-based AI counseling assistant for "Counseling Center". 
You are fluent in both Myanmar (Burmese) language and English.

Key Principles:
1. Warm Introduction: In your initial response to a user's question, always begin by introducing yourself warmly in the user's language. For example, if they speak in Myanmar: "ကျွန်တော်ကတော့ မိတ်ဆွေရဲ့ AI အကြံပေးလက်ထောက်ဖြစ်ပါတယ်။ မိတ်ဆွေ ယေရှုခရစ်တော်၌ စစ်မှန်သော ငြိမ်သက်ခြင်းကို ရှာတွေ့နိုင်ဖို့ ကျွန်တော် ကူညီပေးပါရစေ..." (I am your AI assistant, here to help you find your peace in Christ).
2. Christ-Centered Guidance: Directly or indirectly lead every conversation toward the hope, healing, love, grace, and peace found in Jesus Christ. Gently incorporate biblical wisdom, comforting scriptures, and faith-based encouragement tailored to the user's situation.
3. Language Mirroring: If the user communicates in Myanmar (Burmese), reply entirely in beautiful, natural Myanmar language (using Christian terminology when appropriate). If the user communicates in English, reply in English.
4. Empathy & Active Listening: Validate the user's feelings without judgment. Create a safe, comforting space rooted in the love of Jesus.
5. Practical Guidance: Offer gentle, actionable steps, prayer suggestions, or grounding techniques when appropriate.
6. Crisis Disclaimer: If a user expresses severe crisis or self-harm intent, gently encourage them to reach out to professional healthcare providers, crisis hotlines, or their church leadership.
7. Tone: Calm, supportive, warm, compassionate, and structured. Keep paragraphs digestible.
8. Mandatory Closing in Myanmar: At the very end of every single response you generate, you MUST append exactly the following text in Myanmar language:
"ဒီလိုစိတ်ဝင်စားဖို့ကောင်းတဲ့ အကြောင်းအရာကို ဆွေးနွေးပေးလို့ ကျေးဇူးတင်ပါတယ်။ ဒီအကြောင်းနဲ့ပတ်သက်ပြီး အသေးစိတ်ထပ်သိချင်တယ်ဆိုရင်တော့ ကျွန်တော်တို့ရဲ့ နှစ်သိမ့်ဆွေးနွေးအကြံပေးပုဂ္ဂိုလ် (Counsellor) နဲ့ ချိတ်ဆက်ပေးလို့ရပါတယ်။ အခုချက်ချင်း ချိတ်ဆက်ပေးရမလားခင်ဗျာ?"`;
  };

  // Initialize UI
  const initUI = () => {
    if (apiKey && apiKeyStatus) {
      apiKeyStatus.textContent = 'Key Active';
      apiKeyStatus.style.color = 'var(--accent-color)';
    }

    // Theme setup
    const savedTheme = localStorage.getItem('app_theme');
    if (savedTheme === 'dark' && btnTheme) {
      isDarkTheme = true;
      document.documentElement.setAttribute('data-theme', 'dark');
      btnTheme.innerHTML = '<i data-lucide="sun"></i>';
      if (typeof lucide !== 'undefined') {
        try { lucide.createIcons(); } catch (e) {}
      }
    }

    // History setup
    renderHistoryList();

    // Onboarding setup
    initInterestGrid();
    if (!userProfile) {
      if (onboardingFlow) onboardingFlow.style.display = 'flex';
    } else {
      if (btnProfile) btnProfile.style.display = 'flex';
    }
  };

  const renderHistoryList = () => {
    if (!historyList) return;
    historyList.innerHTML = '';
    
    // Sort by timestamp desc
    const sorted = [...sessions].sort((a, b) => b.timestamp - a.timestamp);
    
    if (sorted.length === 0) {
      historyList.innerHTML = '<div style="padding: 1rem; font-size: 0.75rem; color: var(--text-secondary); text-align: center;">No recent chats</div>';
      return;
    }

    sorted.forEach(session => {
      const item = document.createElement('div');
      item.className = `history-item ${session.id === currentSessionId ? 'active' : ''}`;
      item.innerHTML = `
        <i data-lucide="message-square" size="16"></i>
        <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${session.title || 'Untitled Chat'}</span>
      `;
      item.onclick = () => switchToSession(session.id);
      historyList.appendChild(item);
    });
    
    if (typeof lucide !== 'undefined') {
      try { lucide.createIcons(); } catch (e) {}
    }
  };

  const createNewChat = () => {
    currentSessionId = null;
    chatHistory = [];
    chatContainer.innerHTML = '';
    welcomeScreen.style.display = 'flex';
    chatContainer.style.display = 'none';
    chatViewHeader.style.display = 'none';
    if (activeChatTitle) activeChatTitle.textContent = 'New Conversation';
    renderHistoryList();
    sidebar.classList.remove('active');
  };

  const switchToSession = (id) => {
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    
    currentSessionId = session.id;
    chatHistory = [...session.history];
    chatContainer.innerHTML = '';
    
    // Re-render chat
    chatHistory.forEach(msg => {
      const role = msg.role === 'user' ? 'user' : 'bot';
      appendMessage(role, msg.parts[0].text, false, true);
    });
    
    welcomeScreen.style.display = 'none';
    chatContainer.style.display = 'flex';
    chatViewHeader.style.display = 'flex';
    if (activeChatTitle) activeChatTitle.textContent = session.title || 'Conversation';
    
    renderHistoryList();
    sidebar.classList.remove('active');
  };

  const saveCurrentSession = (firstMsgText) => {
    if (!currentSessionId) {
      currentSessionId = 'session_' + Date.now();
      const title = firstMsgText ? (firstMsgText.substring(0, 30) + (firstMsgText.length > 30 ? '...' : '')) : 'New Chat';
      sessions.push({
        id: currentSessionId,
        title: title,
        history: chatHistory,
        timestamp: Date.now()
      });
    } else {
      const idx = sessions.findIndex(s => s.id === currentSessionId);
      if (idx !== -1) {
        sessions[idx].history = chatHistory;
        sessions[idx].timestamp = Date.now();
      }
    }
    localStorage.setItem('chat_sessions', JSON.stringify(sessions));
    renderHistoryList();
  };

  const startChatWithTopic = async (topicText) => {
    if (isSending) return;
    if (!apiKey) {
      if (apiModal) apiModal.style.display = 'flex';
      alert('Please configure your Gemini API key to start chatting.');
      return;
    }

    if (onboardingFlow) onboardingFlow.style.display = 'none';
    if (settingsMenu) settingsMenu.classList.remove('active');
    if (sidebar) sidebar.classList.remove('active');

    // Create a new chat if not already in one or if previous chat has messages
    if (!currentSessionId || chatHistory.length > 0) {
      createNewChat();
    }

    if (chatInput) {
      chatInput.value = `ကျွန်တော်/ကျွန်မ "${topicText}" အကြောင်း ဆွေးနွေးလိုပါတယ်။`;
      chatInput.style.height = 'auto';
      if (btnSend) btnSend.disabled = false;
      sendMessage();
    }
  };

  const initInterestGrid = () => {
    if (!interestGrid) return;
    interestGrid.innerHTML = '';
    if (userProfile && userProfile.interests) {
      selectedInterests = [...userProfile.interests];
    }
    interestsData.forEach(item => {
      const tag = document.createElement('div');
      tag.className = 'interest-tag';
      if (!isChoosingTopicForChat && selectedInterests.includes(item.id)) {
        tag.classList.add('selected');
      }
      tag.textContent = item.label;
      tag.dataset.id = item.id;
      tag.addEventListener('click', () => {
        if (isChoosingTopicForChat) {
          startChatWithTopic(item.label);
        } else {
          tag.classList.toggle('selected');
          const id = tag.dataset.id;
          if (tag.classList.contains('selected')) {
            if (!selectedInterests.includes(id)) selectedInterests.push(id);
          } else {
            selectedInterests = selectedInterests.filter(i => i !== id);
          }
        }
      });
      interestGrid.appendChild(tag);
    });
  };

  const showStep = (index) => {
    onboardingSteps.forEach((step, i) => {
      step.classList.toggle('active', i === index);
    });
    currentStep = index;
  };

  // Event Listeners
  if (btnApiKey && apiModal && apiKeyInput) {
    btnApiKey.addEventListener('click', () => {
      apiKeyInput.value = apiKey;
      apiModal.style.display = 'flex';
    });
  }

  if (modalClose && apiModal) {
    modalClose.addEventListener('click', () => {
      apiModal.style.display = 'none';
    });
  }

  if (apiModal) {
    apiModal.addEventListener('click', (e) => {
      if (e.target === apiModal) {
        apiModal.style.display = 'none';
      }
    });
  }

  if (btnSaveKey && apiKeyInput && apiModal && apiKeyStatus) {
    btnSaveKey.addEventListener('click', () => {
      const rawVal = apiKeyInput.value.trim();
      const match = rawVal.match(/(AIzaSy[a-zA-Z0-9_\-]{33})/);
      if (match) {
        apiKey = match[1];
        localStorage.setItem('gemini_api_key', apiKey);
        apiKeyStatus.textContent = 'Key Active';
        apiKeyStatus.style.color = 'var(--accent-color)';
        apiModal.style.display = 'none';
      } else {
        alert('Please enter a valid Google Gemini API key starting with AIzaSy...');
      }
    });
  }

  if (btnTheme) {
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
      if (typeof lucide !== 'undefined') {
        try { lucide.createIcons(); } catch (e) {}
      }
    });
  }

  if (btnLang) {
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
  }

  if (btnStartOnboarding) {
    btnStartOnboarding.addEventListener('click', () => {
      isChoosingTopicForChat = false;
      if (topicsSubtitle) topicsSubtitle.textContent = 'သင်ပြောဆိုလိုသည့် အကြောင်းအရာများကို ရွေးချယ်ပါ';
      if (btnFinishOnboarding) btnFinishOnboarding.style.display = 'flex';
      initInterestGrid();
      showStep(1);
    });
  }

  if (btnPhoneNext) {
    btnPhoneNext.addEventListener('click', () => {
      if (inputPhone && inputPhone.value.trim().length > 5) {
        showStep(2);
      } else {
        alert('ကျေးဇူးပြု၍ ဖုန်းနံပါတ် အမှန်ထည့်ပါ။');
      }
    });
  }

  if (btnProfileNext) {
    btnProfileNext.addEventListener('click', () => {
      if (inputName && inputName.value.trim()) {
        showStep(3);
      } else {
        alert('ကျေးဇူးပြု၍ အမည်ထည့်ပါ။');
      }
    });
  }

  if (btnFinishOnboarding) {
    btnFinishOnboarding.addEventListener('click', () => {
      const isExisting = !!userProfile;
      const profile = {
        phone: inputPhone ? inputPhone.value.trim() : '',
        name: inputName ? inputName.value.trim() : '',
        dob: inputDOB ? inputDOB.value : '',
        gender: document.querySelector('input[name="gender"]:checked')?.value || '',
        interests: selectedInterests
      };
      localStorage.setItem('user_profile', JSON.stringify(profile));
      userProfile = profile;
      if (onboardingFlow) onboardingFlow.style.display = 'none';
      if (btnProfile) btnProfile.style.display = 'flex';
      
      if (!isExisting) {
        const welcomeText = `မင်္ဂလာပါ ${userProfile.name}၊ အကောင့်ဖန်တီးမှု အောင်မြင်ပါတယ်။ သင့်ကို ဘယ်လိုကူညီပေးရမလဲ?`;
        appendMessage('bot', welcomeText);
      } else {
        alert('ဆွေးနွေးလိုသော ခေါင်းစဉ်များကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
      }
    });
  }

  btnStepBacks.forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentStep > 0) showStep(currentStep - 1);
    });
  });

  if (btnMenuToggle) {
    btnMenuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('active');
    });
  }

  if (btnSidebarToggleClose) {
    btnSidebarToggleClose.addEventListener('click', () => {
      sidebar.classList.remove('active');
    });
  }

  if (btnNewChat) {
    btnNewChat.addEventListener('click', createNewChat);
  }

  if (btnSidebarSettings) {
    btnSidebarSettings.addEventListener('click', () => {
      if (settingsMenu) settingsMenu.classList.add('active');
    });
  }

  if (btnBackToHome) {
    btnBackToHome.addEventListener('click', () => {
      welcomeScreen.style.display = 'flex';
      chatContainer.style.display = 'none';
      chatViewHeader.style.display = 'none';
    });
  }

  if (btnProfile) {
    btnProfile.addEventListener('click', () => {
      if (settingsMenu) settingsMenu.classList.add('active');
    });
  }

  if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', () => {
      if (settingsMenu) settingsMenu.classList.remove('active');
    });
  }

  if (btnSettingAccount) {
    btnSettingAccount.addEventListener('click', () => {
      isChoosingTopicForChat = false;
      if (topicsSubtitle) topicsSubtitle.textContent = 'သင်ပြောဆိုလိုသည့် အကြောင်းအရာများကို ရွေးချယ်ပါ';
      if (btnFinishOnboarding) btnFinishOnboarding.style.display = 'flex';
      initInterestGrid();
      if (settingsMenu) settingsMenu.classList.remove('active');
      if (userProfile) {
        if (inputPhone) inputPhone.value = userProfile.phone || '';
        if (inputName) inputName.value = userProfile.name || '';
        if (inputDOB) inputDOB.value = userProfile.dob || '';
        if (userProfile.gender) {
          const radio = document.querySelector(`input[name="gender"][value="${userProfile.gender}"]`);
          if (radio) radio.checked = true;
        }
      }
      if (onboardingFlow) {
        onboardingFlow.style.display = 'flex';
        showStep(2); // Jump to Profile step
      }
    });
  }

  if (btnSettingTopics) {
    btnSettingTopics.addEventListener('click', () => {
      isChoosingTopicForChat = true;
      if (topicsSubtitle) topicsSubtitle.textContent = 'ဆွေးနွေးလိုသည့် ခေါင်းစဉ်တစ်ခုကို နှိပ်၍ စတင်ဆွေးနွေးနိုင်ပါသည်';
      if (btnFinishOnboarding) btnFinishOnboarding.style.display = 'none';
      initInterestGrid();
      if (settingsMenu) settingsMenu.classList.remove('active');
      if (onboardingFlow) {
        onboardingFlow.style.display = 'flex';
        showStep(3); // Jump to Topics step
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (confirm('အကောင့်မှ ထွက်မှာ သေချာပါသလား?')) {
        localStorage.removeItem('user_profile');
        location.reload();
      }
    });
  }

  // Auto-adjust textarea height
  if (chatInput && btnSend) {
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
  }

  if (quickPrompts && chatInput && btnSend) {
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
  }

  // Chat Logic
  const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatTextToHTML = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => `<p style="margin-bottom: 0.5rem;">${line}</p>`)
      .join('');
  };

  const appendMessage = (sender, text, isStream = false, isHistory = false) => {
    if (welcomeScreen && welcomeScreen.style.display !== 'none' && !isHistory) {
      welcomeScreen.style.display = 'none';
      if (chatContainer) chatContainer.style.display = 'flex';
      if (chatViewHeader) chatViewHeader.style.display = 'flex';
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

    if (chatContainer) {
      chatContainer.appendChild(wrapper);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

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
    if (chatContainer) {
      chatContainer.appendChild(wrapper);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    return wrapper;
  };

  // Guard to prevent double submissions
  let isSending = false;
  const sendMessage = async () => {
    if (isSending) return; // Prevent duplicate sends
    isSending = true;
    let typingIndicator = null;
    try {
      if (!apiKey) {
        if (apiModal) apiModal.style.display = 'flex';
        alert('Please configure your Gemini API key to start chatting.');
        isSending = false;
        return;
      }

      if (!chatInput) {
        isSending = false;
        return;
      }
      const text = chatInput.value.trim();
      if (!text) {
        isSending = false;
        return;
      }

      // Clear input
      chatInput.value = '';
      chatInput.style.height = 'auto';
      if (btnSend) btnSend.disabled = true;

      // Append user message
      appendMessage('user', text);

      // Update history
      chatHistory.push({
        role: 'user',
        parts: [{ text }]
      });
      
      saveCurrentSession(text);

      // Show typing
      typingIndicator = appendTypingIndicator();

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;
      const payload = {
        systemInstruction: { parts: [{ text: getSystemPrompt() }] },
        contents: chatHistory
      };
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `HTTP Error ${response.status}`);
      }

      // Remove typing indicator
      if (typingIndicator) typingIndicator.remove();
      typingIndicator = null;

      const botBubble = appendMessage('bot', '', true);
      let fullResponseText = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data:')) continue;
          const jsonStr = trimmedLine.replace(/^data:\s*/, '').trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const json = JSON.parse(jsonStr);
            const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (candidateText) {
              fullResponseText += candidateText;
              botBubble.innerHTML = formatTextToHTML(fullResponseText);
              if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          } catch (e) {
            console.error('Failed to parse SSE JSON:', e, jsonStr);
          }
        }
      }
      if (buffer.trim().startsWith('data:')) {
        const jsonStr = buffer.trim().replace(/^data:\s*/, '').trim();
        try {
          if (jsonStr && jsonStr !== '[DONE]') {
            const json = JSON.parse(jsonStr);
            const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (candidateText) {
              fullResponseText += candidateText;
              botBubble.innerHTML = formatTextToHTML(fullResponseText);
              if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          }
        } catch (e) {
          // ignore error in final buffer flush
        }
      }

      // Add to history
      chatHistory.push({
        role: 'model',
        parts: [{ text: fullResponseText }]
      });
      
      saveCurrentSession();

    } catch (error) {
      if (typingIndicator) typingIndicator.remove();
      console.error('Gemini API Error:', error);
      appendMessage('bot', `⚠️ Could not get response: ${error.message}. Please check your API key and connection.`);
    } finally {
      isSending = false;
      if (chatInput && chatInput.value.trim() && btnSend) {
        btnSend.disabled = false;
      }
    }
  };

  // Start UI
  initUI();
});
