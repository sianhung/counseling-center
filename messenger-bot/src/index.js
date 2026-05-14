/**
 * Facebook Messenger AI Counselor - Cloudflare Worker
 * Built with Google Gemini 2.5 Flash & Multi-Key Auto-Rotation
 */

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
 * Main AI Counseling Logic & Messenger Delivery
 */
async function processAndRespond(senderPsid, userMessage, env) {
  try {
    // 1. Call Gemini API with Auto-Rotation
    const geminiResponseText = await callGeminiWithRotation(userMessage, env);
    console.log(`Gemini response generated for ${senderPsid}. Delivering...`);

    // 2. Send Response to Facebook Messenger
    await sendMessengerMessage(senderPsid, geminiResponseText, env.PAGE_ACCESS_TOKEN);
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
 * Call Google Gemini API with Auto-Rotation Pool & Specific Greeting
 */
async function callGeminiWithRotation(userText, env) {
  const rawKeys = env.GEMINI_API_KEY || '';
  const keys = rawKeys.split(/[\s,;\n\r]+/).map(k => k.trim()).filter(k => k.startsWith('AIzaSy'));

  if (keys.length === 0) {
    throw new Error('No valid Gemini API keys configured.');
  }

  const systemPrompt = `You are a professional Christian AI Counselor named "Care Me" (formerly Counseling Center), speaking fluently in Myanmar (Burmese) language with deep empathy, active listening, and biblical wisdom.

CRITICAL INSTRUCTIONS:
1. Always maintain a warm, gentle, empathetic, and non-judgmental tone.
2. Directly or indirectly, every counseling conversation must point to Jesus Christ, His love, redemption, grace, and peace.
3. When the user sends an initial greeting (e.g., "hi", "hello", "မင်္ဂလာပါ"), you MUST begin your response with exactly this Myanmar greeting:
"မင်္ဂလာပါခင်ဗျာ Counseling Center ကနေ ကြိုဆိုပါတယ်။ ကျွန်တော်ကတော့ လူကြီးမင်းကိုကူညီပေးမယ့် AI Chat Assistant ပါ။ ဘယ်လိုအကြောင်းအရာလေးတွေ ဆွေးနွေးချင်ပါသလဲ၊ အားမနာဘဲ ရင်ဖွင့်ပြောပြလို့ ရပါတယ်။"
4. CRITICAL HANDOFF MANDATE: At the absolute end of every single response you give, you MUST append exactly this Myanmar prompt offering transfer to a human counselor:
"ဒီလိုစိတ်ဝင်စားဖို့ကောင်းတဲ့ အကြောင်းအရာကို ဆွေးနွေးပေးလို့ ကျေးဇူးတင်ပါတယ်။ ဒီအကြောင်းနဲ့ပတ်သက်ပြီး အသေးစိတ်ထပ်သိချင်တယ်ဆိုရင်တော့ ကျွန်တော်တို့ရဲ့ နှစ်သိမ့်ဆွေးနွေးအကြံပေးပုဂ္ဂိုလ် (Counsellor) နဲ့ ချိတ်ဆက်ပေးလို့ရပါတယ်။ အခုချက်ချင်း ချိတ်ဆက်ပေးရမလားခင်ဗျာ?"`;

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
 * Send Message via Meta Graph API
 */
async function sendMessengerMessage(recipientId, textText, pageToken) {
  const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${pageToken}`;

  // Facebook Messenger limits single message chunks to 2000 characters
  const truncatedText = textText.length > 1900 ? textText.substring(0, 1900) + '...' : textText;

  const payload = {
    recipient: { id: recipientId },
    message: { text: truncatedText }
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
    console.log(`Message delivered successfully to PSID ${recipientId}`);
  }
}
