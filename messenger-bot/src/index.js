/**
 * Facebook Messenger AI Counselor - Cloudflare Worker
 * Built with Google Gemini 2.5 Flash, Multi-Key Auto-Rotation, Separate Bubble Chunking, & Human Counselor Handoff
 */

// In-Memory cache to pause AI responses for users who request human counselor transfer
const pausedUsers = new Set();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ------------------------------------------------------------------------
    // 1. FACEBOOK WEBHOOK VERIFICATION (GET Request)
    // ------------------------------------------------------------------------
    if (request.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token === env.VERIFY_TOKEN) {
        console.log('WEBHOOK VERIFIED SUCCESSFULLY!');
        return new Response(challenge, { status: 200 });
      }
      return new Response('Verification failed. Invalid Verify Token.', { status: 403 });
    }

    // ------------------------------------------------------------------------
    // 2. RECEIVE MESSENGER EVENT (POST Request)
    // ------------------------------------------------------------------------
    if (request.method === 'POST') {
      try {
        const data = await request.json();

        // Check if event is from Page subscription
        if (data.object === 'page') {
          for (const entry of data.entry) {
            const webhookEvent = entry.messaging[0];
            const senderPsid = webhookEvent.sender.id;

            // Ignore messages sent by the bot itself or delivery receipts
            if (webhookEvent.message && !webhookEvent.message.is_echo) {
              const userMessage = webhookEvent.message.text || '';
              console.log(`Received message from PSID ${senderPsid}: "${userMessage}"`);

              // Process AI response asynchronously
              ctx.waitUntil(processAndRespond(senderPsid, userMessage, env));
            }
          }
          return new Response('EVENT_RECEIVED', { status: 200 });
        }
        return new Response('Not a Page event', { status: 404 });
      } catch (err) {
        console.error('Webhook Error:', err);
        return new Response('Internal Server Error', { status: 500 });
      }
    }

    return new Response('Method Not Allowed', { status: 405 });
  }
};

/**
 * Main AI Counseling Logic & Human Counselor Handoff
 */
async function processAndRespond(senderPsid, userMessage, env) {
  const cleanMsg = userMessage.trim().toLowerCase();

  // Allow user to resume AI chat anytime by saying 'reset', 'restart', 'bot', 'ai', or 'စတင်ပါ'
  if (cleanMsg === 'reset' || cleanMsg === 'restart' || cleanMsg === 'bot' || cleanMsg === 'ai' || cleanMsg === 'စတင်ပါ') {
    pausedUsers.delete(senderPsid);
    await sendMessengerMessage(senderPsid, "AI Chat Assistant ကို ပြန်လည်စတင်လိုက်ပါပြီ။ ဘာများကူညီပေးရမလဲခင်ဗျာ?", env.PAGE_ACCESS_TOKEN);
    return;
  }

  // If user is handed off to human counselor, ignore all messages so human counselor can converse
  if (pausedUsers.has(senderPsid)) {
    console.log(`PSID ${senderPsid} is in HANDOFF state. Ignoring message so human counselor can converse.`);
    return;
  }

  try {
    // 1. Call Gemini API with Auto-Rotation
    const geminiResponseText = await callGeminiWithRotation(userMessage, env);

    // 2. Check if Gemini triggered Handoff Activation
    if (geminiResponseText.startsWith('[HANDOFF_ACTIVATED]')) {
      const replyText = geminiResponseText.replace('[HANDOFF_ACTIVATED]', '').trim();
      console.log(`Handoff activated for ${senderPsid}. Pausing bot...`);
      pausedUsers.add(senderPsid);
      await sendMessengerMessage(senderPsid, replyText, env.PAGE_ACCESS_TOKEN);
      return;
    }

    console.log(`Gemini pure response generated for ${senderPsid}. Delivering Message #1...`);

    // 3. Send Pure Counseling/Greeting Response (Message #1 - automatically chunked if long)
    await sendMessengerMessage(senderPsid, geminiResponseText, env.PAGE_ACCESS_TOKEN);

    // 4. If it was a counseling discussion (not initial greeting), send Handoff Prompt in separate bubble (Message #2)
    const isGreeting = geminiResponseText.includes('Counseling Center ကနေ ကြိုဆိုပါတယ်။');
    if (!isGreeting) {
      console.log(`Delivering separate counselor handoff prompt (Message #2) to ${senderPsid}...`);
      const handoffText = 'ဒီလိုစိတ်ဝင်စားဖို့ကောင်းတဲ့ အကြောင်းအရာကို ဆွေးနွေးပေးလို့ ကျေးဇူးတင်ပါတယ်။ ဒီအကြောင်းနဲ့ပတ်သက်ပြီး အသေးစိတ်ထပ်သိချင်တယ်ဆိုရင်တော့ ကျွန်တော်တို့ရဲ့ နှစ်သိမ့်ဆွေးနွေးအကြံပေးပုဂ္ဂိုလ် (Counsellor) နဲ့ ချိတ်ဆက်ပေးလို့ရပါတယ်။ အခုချက်ချင်း ချိတ်ဆက်ပေးရမလားခင်ဗျာ?';
      await sendMessengerMessage(senderPsid, handoffText, env.PAGE_ACCESS_TOKEN);
    }
  } catch (error) {
    console.error('Error during processing:', error);
    await sendMessengerMessage(
      senderPsid,
      'ခေတ္တစောင့်ဆိုင်းပေးပါ။ စနစ်ချို့ယွင်းမှုတစ်ခုဖြစ်ပေါ်နေသဖြင့် ပြန်လည်ကြိုးစားပေးပါခင်ဗျာ။',
      env.PAGE_ACCESS_TOKEN
    );
  }
}

/**
 * Call Google Gemini API with Auto-Rotation Pool
 */
async function callGeminiWithRotation(userText, env) {
  const rawKeys = env.GEMINI_API_KEY || '';
  const keys = rawKeys.split(/[\s,;\n\r]+/).map(k => k.trim()).filter(k => k.startsWith('AIzaSy'));

  if (keys.length === 0) {
    throw new Error('No valid Gemini API keys configured.');
  }

  const systemPrompt = `You are a professional Christian AI Chat Assistant for "Counseling Center", speaking fluently in Myanmar (Burmese) language with deep empathy, active listening, and biblical wisdom. You are here to lead the conversation wisely and supportively.

CRITICAL INSTRUCTIONS:
1. Always maintain a warm, gentle, empathetic, and non-judgmental tone.
2. Directly or indirectly, every counseling conversation must point to Jesus Christ, His love, redemption, grace, and peace.
3. NEVER refer to yourself as "Care Me". You are the AI Chat Assistant representing Counseling Center.
4. When the user sends an initial greeting (e.g., "hi", "hello", "မင်္ဂလာပါ", "hey", "mingalarbar"), your ENTIRE reply MUST BE EXACTLY ONLY THIS:
"မင်္ဂလာပါခင်ဗျာ Counseling Center ကနေ ကြိုဆိုပါတယ်။ ကျွန်တော်ကတော့ လူကြီးမင်းကိုကူညီပေးမယ့် AI Chat Assistant ပါ။ ဘယ်လိုအကြောင်းအရာလေးတွေ ဆွေးနွေးချင်ပါသလဲ၊ အားမနာဘဲ ရင်ဖွင့်ပြောပြလို့ ရပါတယ်။"
5. HANDOFF ACTIVATION RULE: If the user agrees to connect with a human counselor (e.g., saying "yes", "ချိတ်ပေးပါ", "ဟုတ်ကဲ့ချိတ်ပေးပါ", "ဟုတ်ကဲ့", "ok", "connect", "ချိတ်ဆက်ပေးပါ", "ရပါတယ်", "ချိတ်ပေး"), your ENTIRE reply MUST BE EXACTLY ONLY THIS:
"[HANDOFF_ACTIVATED] ဟုတ်ကဲ့ပါခင်ဗျာ၊ လူကြီးမင်းကို Counseling Center မှ နှစ်သိမ့်ဆွေးနွေးအကြံပေးပုဂ္ဂိုလ် (Counsellor) နဲ့ ချိတ်ဆက်ပေးလိုက်ပါပြီ။ ဆရာ/ဆရာမမှ မကြာမီ ပြန်လည်ဖြေကြားပေးပါမည်။ ခေတ္တစောင့်ဆိုင်းပေးပါခင်ဗျာ။"
DO NOT generate anything else if Handoff is activated.
6. During actual counseling discussions (when the user shares a problem, question, or counseling topic), provide compassionate biblical Christian counseling advice.
Keep your counseling responses concise, structured, and digestible (under 350 words / 1500 characters). Avoid generating extremely long walls of text.
DO NOT include any human counselor transfer offer or closing questions about connecting with a counselor in your generated text. The system will handle sending the transfer offer separately.`;

  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }]
  };

  let lastError;
  for (let i = 0; i < keys.length; i++) {
    const currentKey = keys[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${currentKey}`;

    try {
      console.log(`[Gemini Request] Trying API key #${i + 1} (${currentKey.substring(0, 10)}...)`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[Gemini Request] Key #${i + 1} failed (${response.status}): ${errText}`);
        throw new Error(`Status ${response.status} - ${errText}`);
      }

      const data = await response.json();
      console.log(`[Gemini Request] Successfully generated response using key #${i + 1}`);
      return data.candidates[0].content.parts[0].text;
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(`All Gemini API keys failed in rotation pool. Last error: ${lastError.message}`);
}

/**
 * Send Message via Meta Graph API with Sequential Chunking for Long Texts
 */
async function sendMessengerMessage(recipientId, textText, pageToken) {
  const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${pageToken}`;

  // Split text into chunks of 1800 characters to respect Facebook's 2000 char limit without losing text
  const chunkSize = 1800;
  for (let i = 0; i < textText.length; i += chunkSize) {
    const chunkText = textText.substring(i, i + chunkSize);
    const payload = {
      recipient: { id: recipientId },
      message: { text: chunkText }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Meta Graph API Error:', errText);
      throw new Error(`Meta Graph API Error: ${response.status} - ${errText}`);
    } else {
      console.log(`Message chunk delivered successfully to PSID ${recipientId}`);
    }

    // Wait 500ms between chunks to guarantee correct sequential ordering in Messenger UI
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
