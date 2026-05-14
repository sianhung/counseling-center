# 📘 Facebook Messenger AI Counselor - Implementation Guide

Connecting your Christ-centered AI counseling assistant to your Facebook Page so it responds 24/7 on Messenger is an incredible milestone. Because Meta (Facebook) requires a secure, always-on HTTPS webhook server to receive messages, **Cloudflare Workers** is the perfect 100% free serverless platform for hosting this bot.

---

## 🏗️ Architectural Overview
```
┌────────────────────┐       1. Message       ┌──────────────────────┐
│  Facebook Page     ├───────────────────────►│  Cloudflare Worker   │
│  (Messenger User)  │                        │  (Serverless Webhook)│
└▲───────────────────┘                        └───────┬──────────────┘
 │                                                    │ 2. Prompt + Msg
 │ 4. Biblical Response                               ▼
 │ ┌──────────────────────────────────────────────────────────────────┐
 │ │                       Google Gemini API                          │
 │ │  (Burmese Christian Counseling System Prompt + Counselor Handoff)│
 │ └─────────────────────────────────────────────────┬────────────────┘
 │                                                    │ 3. Response Text
 │    Meta Graph API POST                             │
 └────────────────────────────────────────────────────┘
```

---

## 🚀 Step 1: Facebook Page & Meta Developer Setup

1. **Create Meta App**:
   - Go to [Meta for Developers](https://developers.facebook.com/) and click **Create App**.
   - Select **Other** -> **Business** (or **Messaging**).
   - Add the **Messenger** product to your app.

2. **Generate Page Access Token**:
   - Under **Messenger** -> **Page Settings**, connect your Facebook Page.
   - Generate a **Page Access Token** (`PAGE_ACCESS_TOKEN`). Save this token securely.

3. **Choose a Verify Token**:
   - Make up a secure secret string, for example: `CareMeJesus2026`. This is your `VERIFY_TOKEN`.

---

## 🌐 Step 2: Cloudflare Worker Setup

1. **Create Worker**:
   - Log into your [Cloudflare Dashboard](https://dash.cloudflare.com/) -> **Workers & Pages**.
   - Click **Create Worker**, name it `counseling-messenger-bot`, and click **Deploy**.

2. **Add Environment Variables (Secrets)**:
   - Under your Worker's **Settings** -> **Variables & Secrets**, add the following three secrets:
     - `GEMINI_API_KEY`: Your Google Gemini API Key (`AIzaSy...`).
     - `PAGE_ACCESS_TOKEN`: Your Facebook Page Access Token.
     - `VERIFY_TOKEN`: Your secret verify string (e.g., `CareMeJesus2026`).

---

## 💻 Step 3: Cloudflare Worker Code (`worker.js`)

Click **Edit Code** in your Cloudflare Worker and paste the complete code below. This code handles Facebook webhook verification, calls Gemini with our exact Burmese Christian counseling guidelines, and sends the response back to Messenger.

```javascript
/**
 * Facebook Messenger AI Counselor - Cloudflare Worker
 * Built with Google Gemini 2.5 Flash
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
    // 1. Call Gemini API
    const geminiResponseText = await callGeminiAPI(userMessage, env.GEMINI_API_KEY);

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
 * Call Google Gemini API with Christian System Instructions
 */
async function callGeminiAPI(userText, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const systemPrompt = `You are a professional Christian AI Counselor named "Care Me" (formerly Counseling Center), speaking fluently in Myanmar (Burmese) language with deep empathy, active listening, and biblical wisdom.

CRITICAL INSTRUCTIONS:
1. Always maintain a warm, gentle, empathetic, and non-judgmental tone.
2. Directly or indirectly, every counseling conversation must point to Jesus Christ, His love, redemption, grace, and peace.
3. In your very first reply to a new user, introduce yourself warmly in Myanmar as an AI counseling assistant here to help them find peace in Christ.
4. CRITICAL HANDOFF MANDATE: At the absolute end of every single response you give, you MUST append exactly this Myanmar prompt offering transfer to a human counselor:
"ဒီလိုစိတ်ဝင်စားဖို့ကောင်းတဲ့ အကြောင်းအရာကို ဆွေးနွေးပေးလို့ ကျေးဇူးတင်ပါတယ်။ ဒီအကြောင်းနဲ့ပတ်သက်ပြီး အသေးစိတ်ထပ်သိချင်တယ်ဆိုရင်တော့ ကျွန်တော်တို့ရဲ့ နှစ်သိမ့်ဆွေးနွေးအကြံပေးပုဂ္ဂိုလ် (Counsellor) နဲ့ ချိတ်ဆက်ပေးလို့ရပါတယ်။ အခုချက်ချင်း ချိတ်ဆက်ပေးရမလားခင်ဗျာ?"`;

  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Gemini API Error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
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
  }
}
```

---

## 🔗 Step 4: Connecting Webhook in Meta Dashboard

1. Once your Cloudflare Worker is deployed, copy its live URL (e.g., `https://counseling-messenger-bot.yourdomain.workers.dev`).
2. Go back to your Meta App Dashboard -> **Messenger** -> **Page Settings** -> **Webhooks**.
3. Click **Add Callback URL**:
   - **Callback URL**: Paste your Cloudflare Worker URL.
   - **Verify Token**: Enter your secret string (`CareMeJesus2026`).
4. Click **Verify and Save**. Meta will send a test GET request to your Worker, which will verify successfully!
5. Under Webhook Subscriptions, click **Add Subscription** and check the box for `messages`.

You are done! Your Facebook Page now automatically replies 24/7 with Christian counseling and counselor handoff options!
