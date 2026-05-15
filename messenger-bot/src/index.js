async function renderDashboard(request, env) {
  const url = new URL(request.url);
  const activeTab = url.searchParams.get('tab') || 'clients';

  // Handle Settings Update
  if (request.method === 'POST' && url.pathname === '/dashboard/settings') {
    const formData = await request.formData();
    const systemInstruction = formData.get('system_instruction');
    if (systemInstruction) {
      await env.CHAT_LOGS.put('settings_system_instruction', systemInstruction);
    }
    return new Response('', { status: 303, headers: { 'Location': '/dashboard?tab=settings' } });
  }

  try {
    const psids = (await env.CHAT_LOGS.get('all_active_psids', { type: 'json' })) || [];
    const totalMessages = (await env.CHAT_LOGS.get('stat_total_messages')) || 0;
    const lastWebhook = (await env.CHAT_LOGS.get('stat_last_webhook')) || 'Never';
    const apiKeyCount = (env.GEMINI_API_KEY || '').split(/[\s,;\n\r]+/).filter(k => k.startsWith('AIzaSy')).length;
    const currentInstruction = await env.CHAT_LOGS.get('settings_system_instruction') || 'You are a professional Christian AI Chat Assistant for "Counseling Center", speaking fluently in Myanmar (Burmese) language with deep empathy, active listening, and biblical wisdom. Use compassionate tone and offer spiritual guidance based on Christian principles.';

    let userGridHtml = '';
    let chatRowsHtml = '';

    for (const psid of psids) {
      const profile = (await env.CHAT_LOGS.get(`profile_${psid}`, { type: 'json' })) || { name: `User ${psid}`, pic: '' };
      const logs = (await env.CHAT_LOGS.get(`psid_${psid}`, { type: 'json' })) || [];
      
      userGridHtml += `
        <div class="user-card">
          ${profile.pic ? `<img src="${profile.pic}" class="user-avatar">` : `<div class="user-avatar-placeholder">👤</div>`}
          <div class="user-info">
            <h3>${profile.name}</h3>
            <p>ID: ${psid}</p>
          </div>
        </div>
      `;

      for (const log of logs) {
        const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        chatRowsHtml += `
          <tr>
            <td>
              <div class="client-compact">
                ${profile.pic ? `<img src="${profile.pic}" class="compact-avatar">` : `<div class="compact-placeholder">👤</div>`}
                <span>${profile.name}<br><small>${timeStr}</small></span>
              </div>
            </td>
            <td class="msg-cell">${log.user_message || '...'}</td>
            <td class="msg-cell ai-cell">${log.ai_response || '...'}</td>
          </tr>
        `;
      }
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Hungpi Admin | AI Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #6366f1;
      --primary-glow: rgba(99, 102, 241, 0.4);
      --accent: #10b981;
      --text: #1e293b;
      --text-muted: #64748b;
      --bg: #f8fafc;
      --glass: rgba(255, 255, 255, 0.7);
      --glass-dark: #0f172a;
      --border: #e2e8f0;
    }
    * { box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; margin: 0; background: var(--bg); color: var(--text); display: flex; height: 100vh; overflow: hidden; }
    
    /* Sidebar */
    .sidebar { width: 280px; background: var(--glass-dark); color: white; display: flex; flex-direction: column; padding: 2.5rem 1.5rem; }
    .sidebar h1 { font-size: 1.2rem; font-weight: 700; letter-spacing: 1px; color: white; margin-bottom: 3rem; text-align: center; }
    .nav-link { padding: 1.2rem; color: #94a3b8; text-decoration: none; border-radius: 16px; margin-bottom: 0.75rem; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; gap: 12px; font-weight: 600; }
    .nav-link:hover { background: rgba(255,255,255,0.05); color: white; }
    .nav-link.active { background: var(--primary); color: white; box-shadow: 0 8px 20px var(--primary-glow); }

    /* Main Container */
    .content { flex: 1; padding: 2.5rem; overflow-y: auto; background: radial-gradient(circle at 100% 0%, #eef2ff 0%, #f8fafc 50%); position: relative; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem; }
    h2 { margin: 0; font-size: 1.8rem; font-weight: 800; color: #0f172a; }

    /* Stats */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem; }
    .stat-card { background: var(--glass); backdrop-filter: blur(12px); padding: 1.5rem; border-radius: 24px; border: 1px solid white; box-shadow: 0 10px 30px rgba(0,0,0,0.04); }
    .stat-card .label { font-size: 0.8rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.5px; }
    .stat-card .value { font-size: 1.75rem; font-weight: 800; color: #0f172a; }

    /* User Grid & Avatar Fix */
    .user-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.25rem; margin-bottom: 2.5rem; }
    .user-card { background: white; padding: 1rem; border-radius: 20px; border: 1px solid var(--border); display: flex; align-items: center; gap: 14px; transition: 0.3s; cursor: default; }
    .user-card:hover { transform: translateY(-4px); box-shadow: 0 12px 25px rgba(0,0,0,0.06); }
    
    .user-avatar { width: 48px; height: 48px; border-radius: 50%; background: #f1f5f9; object-fit: cover; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
    .user-avatar-placeholder { width: 48px; height: 48px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
    
    .user-info h3 { margin: 0; font-size: 0.95rem; font-weight: 700; color: #0f172a; }
    .user-info p { margin: 2px 0 0; font-size: 0.75rem; color: var(--text-muted); font-family: monospace; }

    /* Live Workflow Tracker - FULL SCREEN STYLE */
    .workflow-section { background: var(--glass-dark); border-radius: 32px; padding: 5rem 3rem; margin-top: 1rem; position: relative; overflow: hidden; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.3); }
    .workflow-visual { display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 2; max-width: 900px; margin: 0 auto; }
    
    .wf-node { width: 160px; padding: 1.5rem 1rem; background: rgba(30, 41, 59, 0.8); backdrop-filter: blur(8px); border: 2px solid #334155; border-radius: 24px; color: white; text-align: center; transition: 0.5s; position: relative; }
    .wf-node.active { border-color: var(--primary); box-shadow: 0 0 40px var(--primary-glow); transform: scale(1.05); background: rgba(99, 102, 241, 0.1); }
    .wf-node h4 { margin: 0; font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
    .wf-node .status { font-size: 1rem; font-weight: 700; margin-top: 8px; color: white; }
    .wf-node i { display: block; font-size: 1.5rem; margin-bottom: 10px; }

    .wf-connector { flex: 1; height: 2px; background: #334155; position: relative; margin: 0 10px; }
    .wf-pulse { position: absolute; width: 12px; height: 12px; background: var(--primary); border-radius: 50%; top: -5px; box-shadow: 0 0 15px var(--primary); animation: flow 2s infinite linear; opacity: 0; }
    @keyframes flow { 
      0% { left: 0; opacity: 0; transform: scale(0.5); } 
      20% { opacity: 1; transform: scale(1); }
      80% { opacity: 1; transform: scale(1); }
      100% { left: 100%; opacity: 0; transform: scale(0.5); } 
    }

    .bg-glow { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 300px; height: 300px; background: var(--primary); filter: blur(150px); opacity: 0.15; z-index: 1; }

    /* Live Feed Table */
    .table-container { background: white; border-radius: 28px; border: 1px solid var(--border); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.02); }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f8fafc; padding: 1.25rem 1.5rem; text-align: left; font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--border); }
    td { padding: 1.25rem 1.5rem; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; vertical-align: top; }
    .msg-cell { line-height: 1.5; color: #475569; }
    .ai-cell { background: #fcfdff; color: var(--glass-dark); font-weight: 500; border-left: 4px solid var(--primary); }
    
    .client-compact { display: flex; align-items: center; gap: 12px; }
    .compact-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; background: #eee; }
    .compact-placeholder { width: 32px; height: 32px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; }
    .client-compact span { font-weight: 700; color: #0f172a; font-size: 0.85rem; }
    .client-compact small { font-weight: 400; color: var(--text-muted); font-size: 0.7rem; }

    /* Settings */
    .settings-card { background: white; padding: 2.5rem; border-radius: 32px; border: 1px solid var(--border); box-shadow: 0 20px 40px rgba(0,0,0,0.03); max-width: 800px; }
    .form-group { margin-bottom: 2rem; }
    label { display: block; font-weight: 700; margin-bottom: 0.75rem; color: #0f172a; font-size: 1rem; }
    textarea { width: 100%; height: 250px; padding: 1.25rem; border-radius: 20px; border: 2px solid var(--border); font-family: inherit; font-size: 1rem; line-height: 1.6; transition: 0.3s; resize: vertical; background: #fcfdff; }
    textarea:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 4px var(--primary-glow); }
    .save-btn { background: var(--primary); color: white; border: none; padding: 1rem 2.5rem; border-radius: 16px; font-weight: 700; font-size: 1rem; cursor: pointer; transition: 0.3s; display: flex; align-items: center; gap: 10px; }
    .save-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 20px var(--primary-glow); opacity: 0.9; }

    /* Pulse for Workflow Tab Title */
    .pulse-dot { display: inline-block; width: 8px; height: 8px; background: #ef4444; border-radius: 50%; margin-left: 8px; animation: blink 1.5s infinite; }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  </style>
</head>
<body>
  <div class="sidebar">
    <h1>HUNGPI AI</h1>
    <nav>
      <a href="?tab=clients" class="nav-link ${activeTab === 'clients' ? 'active' : ''}">
        <span>👥</span> Clients
      </a>
      <a href="?tab=workflow" class="nav-link ${activeTab === 'workflow' ? 'active' : ''}">
        <span>🛰️</span> Workflow
      </a>
      <a href="?tab=settings" class="nav-link ${activeTab === 'settings' ? 'active' : ''}">
        <span>⚙️</span> Settings
      </a>
    </nav>
  </div>

  <div class="content">
    ${activeTab === 'clients' ? `
      <header><h2>Client Directory</h2></header>
      <div class="user-grid">${userGridHtml || '<p>No clients registered yet.</p>'}</div>
      
      <header style="margin-top: 3rem;">
        <h2>Live Interaction Feed</h2>
      </header>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th width="200">Client</th>
              <th>Latest Message</th>
              <th>AI Counseling Response</th>
            </tr>
          </thead>
          <tbody>
            ${chatRowsHtml || '<tr><td colspan="3" style="text-align:center; padding: 3rem; color: #94a3b8;">Waiting for interactions...</td></tr>'}
          </tbody>
        </table>
      </div>
    ` : ''}

    ${activeTab === 'workflow' ? `
      <header><h2>System Live Workflow</h2></header>
      <div class="stats-grid">
        <div class="stat-card"><div class="label">Traffic</div><div class="value">${totalMessages} msg</div></div>
        <div class="stat-card"><div class="label">Compute</div><div class="value">${apiKeyCount} nodes</div></div>
        <div class="stat-card"><div class="label">Last Pulse</div><div class="value">${lastWebhook === 'Never' ? '...' : new Date(parseInt(lastWebhook)).toLocaleTimeString()}</div></div>
        <div class="stat-card"><div class="label">Retention</div><div class="value">${psids.length} clients</div></div>
      </div>

      <div class="workflow-section">
        <div class="bg-glow"></div>
        <div class="workflow-visual">
          <div class="wf-node active">
            <h4>Entry</h4>
            <div class="status">Messenger</div>
          </div>
          <div class="wf-connector">
            <div class="wf-pulse" style="animation-delay: 0s"></div>
          </div>
          <div class="wf-node active">
            <h4>Processor</h4>
            <div class="status">Gemini 2.5</div>
          </div>
          <div class="wf-connector">
            <div class="wf-pulse" style="animation-delay: 0.6s"></div>
          </div>
          <div class="wf-node active">
            <h4>Memory</h4>
            <div class="status">Cloudflare KV</div>
          </div>
          <div class="wf-connector">
            <div class="wf-pulse" style="animation-delay: 1.2s"></div>
          </div>
          <div class="wf-node active">
            <h4>Output</h4>
            <div class="status">Live Chat</div>
          </div>
        </div>
      </div>

      <div style="margin-top: 2rem; color: var(--text-muted); font-size: 0.9rem; display: flex; align-items:center; gap: 10px;">
        <span class="pulse-dot"></span> System is currently monitoring live traffic...
      </div>
    ` : ''}

    ${activeTab === 'settings' ? `
      <header><h2>System Configuration</h2></header>
      <div class="settings-card">
        <form action="/dashboard/settings" method="POST">
          <div class="form-group">
            <label>AI Behavioral Persona & Persona Prompt</label>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
              Define how the AI should respond to clients. Changes take effect immediately.
            </p>
            <textarea name="system_instruction" placeholder="Enter instructions...">${currentInstruction}</textarea>
          </div>
          <button type="submit" class="save-btn">
            <span>💾</span> Save Configuration
          </button>
        </form>
      </div>
    ` : ''}
  </div>
</body>
</html>`;

    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (err) {
    return new Response(`Dashboard Error: ${err.message}`, { status: 500 });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Root status page
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Hungpi AI Service</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: white; }
            .status { font-size: 3rem; font-weight: bold; margin-bottom: 1rem; color: #10b981; }
            .btn { background: #6366f1; color: white; padding: 1rem 2rem; border-radius: 12px; text-decoration: none; font-weight: bold; margin-top: 2rem; transition: 0.3s; }
            .btn:hover { transform: scale(1.05); box-shadow: 0 0 20px rgba(99, 102, 241, 0.5); }
          </style>
        </head>
        <body>
          <div class="status">● Bot Active</div>
          <p>Hungpi Counseling AI is online and monitoring Messenger webhooks.</p>
          <a href="/dashboard" class="btn">Admin Dashboard</a>
        </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

    // Admin Dashboard
    if (url.pathname.startsWith('/dashboard')) {
      return await renderDashboard(request, env);
    }

    // Facebook Webhook Verification
    if (request.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token === env.VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        return new Response(challenge, { status: 200 });
      } else {
        return new Response('Verification failed', { status: 403 });
      }
    }

    // Handle Incoming Messages
    if (request.method === 'POST') {
      try {
        const body = await request.json();

        if (body.object === 'page') {
          // Log webhook activity
          await env.CHAT_LOGS.put('stat_last_webhook', Date.now().toString());

          for (const entry of body.entry) {
            const webhook_event = entry.messaging[0];
            const sender_psid = webhook_event.sender.id;

            if (webhook_event.message && webhook_event.message.text) {
              ctx.waitUntil(handleMessage(sender_psid, webhook_event.message.text, env));
            }
          }
          return new Response('EVENT_RECEIVED', { status: 200 });
        }
      } catch (e) {
        return new Response('Error', { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};

async function handleMessage(sender_psid, messageText, env) {
  // Update total messages stat
  const total = parseInt(await env.CHAT_LOGS.get('stat_total_messages') || '0');
  await env.CHAT_LOGS.put('stat_total_messages', (total + 1).toString());

  // Track active users
  let psids = (await env.CHAT_LOGS.get('all_active_psids', { type: 'json' })) || [];
  if (!psids.includes(sender_psid)) {
    psids.push(sender_psid);
    await env.CHAT_LOGS.put('all_active_psids', JSON.stringify(psids));
    // Pre-fetch profile if new
    await getFacebookProfile(sender_psid, env);
  }

  // Get dynamic system instruction from KV
  const systemInstruction = await env.CHAT_LOGS.get('settings_system_instruction') || 
    'You are a professional Christian AI Chat Assistant for "Counseling Center", speaking fluently in Myanmar (Burmese) language with deep empathy, active listening, and biblical wisdom.';

  // Get chat history
  let history = (await env.CHAT_LOGS.get(`psid_${sender_psid}`, { type: 'json' })) || [];
  
  // Prepare contents for Gemini
  const contents = [
    { role: 'user', parts: [{ text: `SYSTEM_INSTRUCTION: ${systemInstruction}` }] },
    ...history.slice(-10).flatMap(log => [
      { role: 'user', parts: [{ text: log.user_message }] },
      { role: 'model', parts: [{ text: log.ai_response }] }
    ]),
    { role: 'user', parts: [{ text: messageText }] }
  ];

  // Call Gemini
  const apiKey = env.GEMINI_API_KEY.split(/[\s,;\n\r]+/)[0]; // Use first key
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents })
  });

  const data = await response.json();
  const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'I apologize, I am having trouble processing that right now.';

  // Log conversation
  history.push({
    timestamp: Date.now(),
    user_message: messageText,
    ai_response: aiText
  });
  await env.CHAT_LOGS.put(`psid_${sender_psid}`, JSON.stringify(history.slice(-50)));

  // Send response back to Facebook
  await callSendAPI(sender_psid, aiText, env.PAGE_ACCESS_TOKEN);
}

async function getFacebookProfile(psid, env) {
  const cacheKey = `profile_${psid}`;
  const cached = await env.CHAT_LOGS.get(cacheKey, { type: 'json' });
  if (cached) return cached;

  try {
    const response = await fetch(`https://graph.facebook.com/${psid}?fields=first_name,last_name,profile_pic&access_token=${env.PAGE_ACCESS_TOKEN}`);
    const data = await response.json();
    const profile = {
      name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || `User ${psid}`,
      pic: data.profile_pic || ''
    };
    await env.CHAT_LOGS.put(cacheKey, JSON.stringify(profile));
    return profile;
  } catch (e) {
    return { name: `User ${psid}`, pic: '' };
  }
}

async function callSendAPI(sender_psid, responseText, pageAccessToken) {
  const requestBody = {
    recipient: { id: sender_psid },
    message: { text: responseText }
  };

  await fetch(`https://graph.facebook.com/v12.0/me/messages?access_token=${pageAccessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
}
