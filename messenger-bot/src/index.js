/**
 * Facebook Messenger AI Counselor - Cloudflare Worker
 * Built with Google Gemini 2.5 Flash, Multi-Key Auto-Rotation, Separate Bubble Chunking, Human Counselor Handoff, Live KV Dashboard, & 10-Minute Silent User Check-in
 */

// In-Memory cache to pause AI responses for users who request human counselor transfer
const pausedUsers = new Set();

export default {
  // ------------------------------------------------------------------------
  // 0. LIVE CHAT DASHBOARD (GET /dashboard)
  // ------------------------------------------------------------------------
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/dashboard') {
      try {
        const psids = (await env.CHAT_LOGS.get('all_active_psids', { type: 'json' })) || [];
        let htmlRows = '';

        for (const psid of psids) {
          const profile = (await env.CHAT_LOGS.get(`profile_${psid}`, { type: 'json' })) || { name: `User ${psid}`, pic: '' };
          const logs = (await env.CHAT_LOGS.get(`psid_${psid}`, { type: 'json' })) || [];
          for (const log of logs) {
            const timeStr = new Date(log.timestamp).toLocaleString();
            htmlRows += `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px; font-weight: 600; color: #4f46e5; min-width: 180px;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    ${profile.pic ? `<img src="${profile.pic}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid #e5e7eb;">` : `<div style="width: 32px; height: 32px; border-radius: 50%; background: #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 14px;">👤</div>`}
                    <div>
                      <div style="font-size: 0.95rem; color: #111827;">${profile.name}</div>
                      <div style="font-size: 0.7rem; color: #6b7280; font-family: monospace;">PSID: ${psid}</div>
                    </div>
                  </div>
                </td>
                <td style="padding: 12px; font-weight: 500; color: #1f2937;">${log.user_message || '[File/Audio/Sticker]'}</td>
                <td style="padding: 12px; color: #374151; background: #f9fafb;">${log.ai_response || '[Handoff / Greeting]'}</td>
                <td style="padding: 12px; font-size: 0.8rem; color: #6b7280; white-space: nowrap;">${timeStr}</td>
              </tr>
            `;
          }
        }

        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Counseling Center — Live Chat Dashboard</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 2rem; background: #f3f4f6; }
              .card { background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); overflow: hidden; max-width: 1400px; margin: 0 auto; }
              .header { background: #4f46e5; color: white; padding: 1.5rem 2rem; display: flex; justify-content: space-between; align-items: center; }
              h1 { margin: 0; font-size: 1.5rem; }
              table { width: 100%; border-collapse: collapse; text-align: left; }
              th { background: #f3f4f6; padding: 12px; font-weight: 600; color: #374151; font-size: 0.9rem; text-transform: uppercase; tracking: wider; border-bottom: 2px solid #e5e7eb; }
              tr:hover { background: #fefefe; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="header">
                <h1>💬 Live Facebook Messenger Chat Logs</h1>
                <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 99px; font-size: 0.85rem; font-weight: 600;">Active Users: ${psids.length}</span>
              </div>
              <div style="overflow-x: auto;">
                <table>
                  <thead>
                    <tr>
                      <th>User Profile</th>
                      <th>Incoming Message</th>
                      <th>AI Response</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${htmlRows || '<tr><td colspan="4" style="padding: 2rem; text-align: center; color: #6b7280;">No chat messages logged yet. Send a message on Messenger to see it here!</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
          </body>
          </html>
        `;

        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      } catch (err) {
        return new Response(`Dashboard Error: ${err.message}`, { status: 500 });
      }
    }

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

        if (data.object === 'page') {
          for (const entry of data.entry) {
            const webhookEvent = entry.messaging[0];
            const senderPsid = webhookEvent.sender.id;

            if (webhookEvent.message && !webhookEvent.message.is_echo) {
              const userMessage = webhookEvent.message.text || '';
              console.log(`Received message from PSID ${senderPsid}: "${userMessage}"`);

              // Await processAndRespond synchronously to ensure Cloudflare doesn't kill background logging
              await processAndRespond(senderPsid, userMessage, env);
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
  },

  // ------------------------------------------------------------------------
  // 3. SCHEDULED CRON TRIGGER (Runs every minute to check for 10-min silent users)
  // ------------------------------------------------------------------------
  async scheduled(event, env, ctx) {
    console.log('Running scheduled 10-minute check-in job...');
    if (!env.CHAT_LOGS) return;

    try {
      const psids = (await env.CHAT_LOGS.get('all_active_psids', { type: 'json' })) || [];
      const now = Date.now();

      for (const psid of psids) {
        if (pausedUsers.has(psid)) continue; // Skip users already handed off to human counselor

        const lastActivity = await env.CHAT_LOGS.get(`last_activity_${psid}`);
        if (!lastActivity) continue;

        const timeDiff = now - parseInt(lastActivity, 10);
        const promptSent = await env.CHAT_LOGS.get(`prompt_sent_${psid}`);

        // If user has been silent for between 10 and 15 minutes, and transfer prompt not sent yet
        if (timeDiff >= 10 * 60 * 1000 && timeDiff <= 15 * 60 * 1000 && promptSent !== 'true') {
          console.log(`PSID ${psid} has been silent for 10 minutes. Delivering separate handoff offer...`);
          const handoffText = 'ဒီလိုစိတ်ဝင်စားဖို့ကောင်းတဲ့ အကြောင်းအရာကို ဆွေးနွေးပေးလို့ ကျေးဇူးတင်ပါတယ်။ ဒီအကြောင်းနဲ့ပတ်သက်ပြီး အသေးစိတ်ထပ်သိချင်တယ်ဆိုရင်တော့ ကျွန်တော်တို့ရဲ့ နှစ်သိမ့်ဆွေးနွေးအကြံပေးပုဂ္ဂိုလ် (Counsellor) နဲ့ ချိတ်ဆက်ပေးလို့ရပါတယ်။ အခုချက်ချင်း ချိတ်ဆက်ပေးရမလားခင်ဗျာ?';
          await sendMessengerMessage(psid, handoffText, env.PAGE_ACCESS_TOKEN);
          await env.CHAT_LOGS.put(`prompt_sent_${psid}`, 'true');
          await logConversation(psid, '[Silent 10m Timer Check-in]', handoffText, env);
        }
      }
    } catch (err) {
      console.error('Scheduled Cron Error:', err);
    }
  }
};

/**
 * Main AI Counseling Logic, Human Counselor Handoff, Profile Fetching, & Synchronous KV Logging
 */
async function processAndRespond(senderPsid, userMessage, env) {
  const cleanMsg = userMessage.trim().toLowerCase();

  // Fetch or cache Facebook Profile Name and Picture
  const userProfile = await getFacebookProfile(senderPsid, env);
  console.log(`Processing chat for user: ${userProfile.name}`);

  // Update user's last activity timestamp for 10-minute check-in timer
  if (env.CHAT_LOGS) {
    await env.CHAT_LOGS.put(`last_activity_${senderPsid}`, Date.now().toString());
    await env.CHAT_LOGS.put(`prompt_sent_${senderPsid}`, 'false');
  }

  if (cleanMsg === 'reset' || cleanMsg === 'restart' || cleanMsg === 'bot' || cleanMsg === 'ai' || cleanMsg === 'စတင်ပါ') {
    pausedUsers.delete(senderPsid);
    const replyText = "AI Chat Assistant ကို ပြန်လည်စတင်လိုက်ပါပြီ။ ဘာများကူညီပေးရမလဲခင်ဗျာ?";
    await logConversation(senderPsid, userMessage, replyText, env);
    await sendMessengerMessage(senderPsid, replyText, env.PAGE_ACCESS_TOKEN);
    return;
  }

  if (pausedUsers.has(senderPsid)) {
    console.log(`PSID ${senderPsid} is in HANDOFF state. Ignoring message so human counselor can converse.`);
    await logConversation(senderPsid, userMessage, "[PAUSED - Human Counselor Handoff State]", env);
    return;
  }

  try {
    const geminiResponseText = await callGeminiWithRotation(userMessage, env);

    if (geminiResponseText.startsWith('[HANDOFF_ACTIVATED]')) {
      const replyText = geminiResponseText.replace('[HANDOFF_ACTIVATED]', '').trim();
      console.log(`Handoff activated for ${senderPsid}. Pausing bot...`);
      pausedUsers.add(senderPsid);
      await logConversation(senderPsid, userMessage, replyText, env);
      await sendMessengerMessage(senderPsid, replyText, env.PAGE_ACCESS_TOKEN);
      return;
    }

    console.log(`Gemini response generated for ${senderPsid}. Logging to KV instantly before delivering...`);

    // Log instantly before slow network chunking delivery
    await logConversation(senderPsid, userMessage, geminiResponseText, env);

    // Deliver Message #1 (AI Counseling advice)
    await sendMessengerMessage(senderPsid, geminiResponseText, env.PAGE_ACCESS_TOKEN);

  } catch (error) {
    console.error('Error during processing:', error);
    const errText = 'ခေတ္တစောင့်ဆိုင်းပေးပါ။ စနစ်ချို့ယွင်းမှုတစ်ခုဖြစ်ပေါ်နေသဖြင့် ပြန်လည်ကြိုးစားပေးပါခင်ဗျာ။';
    await logConversation(senderPsid, userMessage, `[ERROR] ${error.message}`, env);
    await sendMessengerMessage(senderPsid, errText, env.PAGE_ACCESS_TOKEN);
  }
}

/**
 * Fetch Facebook Profile (Name & Picture) via Meta Graph API with KV Caching
 */
async function getFacebookProfile(psid, env) {
  if (!env.CHAT_LOGS) return { name: `User (${psid})`, pic: '' };
  try {
    const profileKey = `profile_${psid}`;
    const cached = await env.CHAT_LOGS.get(profileKey, { type: 'json' });
    if (cached && cached.name) return cached;

    const url = `https://graph.facebook.com/v21.0/${psid}?fields=first_name,last_name,name,profile_pic&access_token=${env.PAGE_ACCESS_TOKEN}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const profile = {
        name: data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || `User ${psid}`,
        pic: data.profile_pic || ''
      };
      await env.CHAT_LOGS.put(profileKey, JSON.stringify(profile));
      return profile;
    }
  } catch (e) {
    console.error('Failed to fetch FB profile:', e);
  }
  return { name: `User (${psid})`, pic: '' };
}

/**
 * Log conversation thread into Cloudflare KV Storage
 */
async function logConversation(psid, userMsg, aiReply, env) {
  if (!env.CHAT_LOGS) {
    console.warn('env.CHAT_LOGS binding is missing!');
    return;
  }
  try {
    const key = `psid_${psid}`;
    const existing = (await env.CHAT_LOGS.get(key, { type: 'json' })) || [];
    existing.push({
      timestamp: new Date().toISOString(),
      user_message: userMsg,
      ai_response: aiReply
    });
    if (existing.length > 50) existing.shift();
    await env.CHAT_LOGS.put(key, JSON.stringify(existing));

    const indexKey = 'all_active_psids';
    const psids = (await env.CHAT_LOGS.get(indexKey, { type: 'json' })) || [];
    if (!psids.includes(psid)) {
      psids.push(psid);
      await env.CHAT_LOGS.put(indexKey, JSON.stringify(psids));
    }
    console.log(`Successfully logged chat for PSID ${psid} into KV storage.`);
  } catch (e) {
    console.error('Failed to log conversation to KV:', e);
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

    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
