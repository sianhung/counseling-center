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

  // Handle Sync Profiles
  if (request.method === 'POST' && url.pathname === '/dashboard/sync-profiles') {
    const psids = (await env.CHAT_LOGS.get('all_active_psids', { type: 'json' })) || [];
    // We do this in a loop, but in production we should limit this or do it background
    for (const psid of psids) {
      await getFacebookProfile(psid, env, true); // Force refresh
    }
    return new Response('', { status: 303, headers: { 'Location': '/dashboard?tab=clients' } });
  }

  // Handle Emergency Sweep (Reply to unanswered)
  if (request.method === 'POST' && url.pathname === '/dashboard/sweep') {
    const psids = (await env.CHAT_LOGS.get('all_active_psids', { type: 'json' })) || [];
    let sweepCount = 0;
    for (const psid of psids) {
      const logs = (await env.CHAT_LOGS.get(`psid_${psid}`, { type: 'json' })) || [];
      if (logs.length > 0) {
        const lastLog = logs[logs.length - 1];
        // If last message is from user and no AI response, or it's the fallback error
        if (!lastLog.ai_response || lastLog.ai_response.includes('တောင်းပန်ပါတယ်ရှင့်')) {
          const userMsg = lastLog.user_message;
          if (userMsg) {
            // We run this in background
            ctx.waitUntil(handleMessage(psid, userMsg, env));
            sweepCount++;
          }
        }
      }
    }
    return new Response(`Sweep initiated for ${sweepCount} users.`, { status: 200 });
  }

  try {
    const psids = (await env.CHAT_LOGS.get('all_active_psids', { type: 'json' })) || [];
    const totalMessages = (await env.CHAT_LOGS.get('stat_total_messages')) || 0;
    const lastWebhook = (await env.CHAT_LOGS.get('stat_last_webhook')) || 'Never';
    const apiKeyCount = (env.GEMINI_API_KEY || '').split(/[\s,;\n\r]+/).filter(k => k.startsWith('AIzaSy')).length;
    const lastAiErrorRaw = (await env.CHAT_LOGS.get('stat_last_ai_error', { type: 'json' })) || null;
    
    // Sanitize error display to prevent leakage
    const sanitize = (obj) => {
      let str = JSON.stringify(obj);
      return str ? str.replace(/AIzaSy[a-zA-Z0-9_\-]+/g, '[MASKED_KEY]') : '';
    };
    const lastAiErrorStr = lastAiErrorRaw ? sanitize(lastAiErrorRaw.error) : '';
    const lastAiError = lastAiErrorRaw;

    const currentInstruction = await env.CHAT_LOGS.get('settings_system_instruction') || 'You are a professional Christian AI Chat Assistant for "Counseling Center", speaking fluently in Myanmar (Burmese) language with deep empathy, active listening, and biblical wisdom. Use compassionate tone and offer spiritual guidance based on Christian principles.';

    let userGridHtml = '';
    let chatRowsHtml = '';

    for (const psid of psids) {
      const profile = (await env.CHAT_LOGS.get(`profile_${psid}`, { type: 'json' })) || { name: `User ${psid}`, pic: '' };
      const logs = (await env.CHAT_LOGS.get(`psid_${psid}`, { type: 'json' })) || [];
      
      userGridHtml += `
        <div class="user-card" onclick="filterByClient('${psid}', this)" data-psid="${psid}">
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
          <tr class="chat-row" data-psid="${psid}">
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
    .sidebar { width: 280px; background: #ffffff; color: #0f172a; display: flex; flex-direction: column; padding: 2.5rem 1.5rem; border-right: 1px solid var(--border); }
    .sidebar h1 { font-size: 1.2rem; font-weight: 800; letter-spacing: 1px; color: #0f172a; margin-bottom: 3rem; text-align: center; }
    .nav-link { padding: 1.2rem; color: #64748b; text-decoration: none; border-radius: 16px; margin-bottom: 0.75rem; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; gap: 12px; font-weight: 700; }
    .nav-link:hover { background: #f8fafc; color: #0f172a; }
    .nav-link.active { background: var(--primary); color: white; box-shadow: 0 10px 25px var(--primary-glow); }

    /* Main Container */
    .content { flex: 1; padding: 2.5rem; overflow-y: auto; background: radial-gradient(circle at 100% 0%, #eef2ff 0%, #f8fafc 50%); position: relative; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem; }
    h2 { margin: 0; font-size: 1.8rem; font-weight: 800; color: #0f172a; }

    .sync-btn { background: white; color: var(--text); border: 1px solid var(--border); padding: 0.6rem 1.2rem; border-radius: 12px; font-weight: 600; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.3s; }
    .sync-btn:hover { background: #f1f5f9; border-color: #cbd5e1; }

    /* Stats Cards */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem; }
    .stat-card { background: var(--glass); backdrop-filter: blur(12px); padding: 1.5rem; border-radius: 24px; border: 1px solid white; box-shadow: 0 10px 30px rgba(0,0,0,0.04); }
    .stat-card .label { font-size: 0.8rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.5px; }
    .stat-card .value { font-size: 1.75rem; font-weight: 800; color: #0f172a; }

    /* User Directory */
    .user-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.25rem; margin-bottom: 2.5rem; }
    .user-card { background: white; padding: 1rem; border-radius: 20px; border: 1px solid var(--border); display: flex; align-items: center; gap: 14px; transition: 0.3s; cursor: pointer; user-select: none; position: relative; }
    .user-card:hover { transform: translateY(-4px); box-shadow: 0 12px 25px rgba(0,0,0,0.06); border-color: var(--primary); }
    .user-card.active { border-color: var(--primary); background: #f5f7ff; box-shadow: 0 10px 20px var(--primary-glow); }
    
    .user-avatar { width: 48px; height: 48px; border-radius: 50%; background: #f1f5f9; object-fit: cover; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
    .user-avatar-placeholder { width: 48px; height: 48px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
    
    .user-info h3 { margin: 0; font-size: 0.9rem; font-weight: 800; color: #0f172a; }
    .user-info p { margin: 2px 0 0; font-size: 0.7rem; color: var(--text-muted); font-family: monospace; }

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

    /* Settings & Utils */
    .settings-card { background: white; padding: 2.5rem; border-radius: 32px; border: 1px solid var(--border); box-shadow: 0 20px 40px rgba(0,0,0,0.03); max-width: 800px; }
    textarea { width: 100%; height: 250px; padding: 1.25rem; border-radius: 20px; border: 2px solid var(--border); font-family: inherit; font-size: 1rem; line-height: 1.6; transition: 0.3s; resize: vertical; background: #fcfdff; }
    textarea:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 4px var(--primary-glow); }
    .save-btn { background: var(--primary); color: white; border: none; padding: 1rem 2.5rem; border-radius: 16px; font-weight: 700; font-size: 1rem; cursor: pointer; transition: 0.3s; display: flex; align-items: center; gap: 10px; }
    .save-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 20px var(--primary-glow); opacity: 0.9; }

    .chat-row { transition: 0.2s ease-in-out; }
    .hidden { display: none !important; }

    .pulse-dot { display: inline-block; width: 8px; height: 8px; background: #ef4444; border-radius: 50%; margin-left: 8px; animation: blink 1.5s infinite; }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  </style>

  <script>
    function filterByClient(psid, el) {
      const rows = document.querySelectorAll('.chat-row');
      const cards = document.querySelectorAll('.user-card');
      
      if (el && el.classList.contains('active')) {
        cards.forEach(c => c.classList.remove('active'));
        rows.forEach(r => r.classList.remove('hidden'));
        return;
      }

      cards.forEach(c => c.classList.remove('active'));
      if (el) el.classList.add('active');

      rows.forEach(row => {
        if (row.getAttribute('data-psid') === psid) {
          row.classList.remove('hidden');
        } else {
          row.classList.add('hidden');
        }
      });
    }
  </script>
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
      <header>
        <h2>Client Directory</h2>
        <form action="/dashboard/sync-profiles" method="POST" style="margin-right: 10px;">
          <button type="submit" class="sync-btn">
            <span>🔄</span> Sync Profiles
          </button>
        </form>
        <form action="/dashboard/sweep" method="POST">
          <button type="submit" class="sync-btn" style="background: #f59e0b; padding: 1.2rem 2rem; font-size: 1rem; box-shadow: 0 10px 20px rgba(245, 158, 11, 0.3);">
            <span>🧹</span> Fix All Unanswered Messages (Emergency Sweep)
          </button>
        </form>
      </header>
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
      <style>
        .content { padding: 0 !important; overflow: hidden !important; display: flex; flex-direction: column; height: 100vh; }
        .wf-split-layout { display: flex; flex: 1; overflow: hidden; background: #0f172a; }
        
        /* Left Sidebar: System Blocks */
        .wf-side-panel {
          width: 280px;
          border-right: 1px solid rgba(255,255,255,0.05);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          background: #0f172a;
          z-index: 10;
        }
        .wf-side-panel h3 { font-size: 0.9rem; font-weight: 800; color: #64748b; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 1rem; }
        .block-item { 
          display: flex; 
          align-items: center; 
          gap: 12px; 
          padding: 12px; 
          background: rgba(255,255,255,0.03); 
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px;
          transition: 0.3s;
        }
        .block-item:hover { background: rgba(99, 102, 241, 0.1); border-color: rgba(99, 102, 241, 0.3); }
        .block-status { width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 8px #10b981; }
        .block-info span { display: block; font-weight: 700; font-size: 0.8rem; color: white; }
        .block-info small { color: #64748b; font-size: 0.65rem; }

        /* Right Panel: Infinite Canvas */
        .wf-main { 
          flex: 1; 
          position: relative; 
          overflow: auto; 
          background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0);
          background-size: 24px 24px;
        }
        .wf-canvas {
          width: 1200px;
          height: 800px;
          position: relative;
          margin: 0;
          padding: 60px;
        }

        .wf-svg-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          width: 100%;
          height: 100%;
        }
        .wf-line {
          fill: none;
          stroke: #818cf8;
          stroke-width: 3;
          stroke-dasharray: 2000;
          stroke-dashoffset: 2000;
          animation: drawLine 2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          marker-end: url(#arrowhead);
          filter: drop-shadow(0 0 8px rgba(99, 102, 241, 0.4));
        }
        @keyframes drawLine { to { stroke-dashoffset: 0; } }

        .node {
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 1rem;
          width: 180px;
          position: absolute;
          z-index: 2;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          animation: nodePop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          opacity: 0;
        }
        @keyframes nodePop { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        
        .step-badge {
          position: absolute;
          top: -10px;
          left: -10px;
          background: #6366f1;
          color: white;
          font-size: 0.6rem;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 20px;
          z-index: 10;
        }

        .node-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .node-icon { width: 32px; height: 32px; background: rgba(255,255,255,0.05); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1rem; }
        .node-title { font-weight: 700; font-size: 0.8rem; color: white; }
        .node-body { font-size: 0.6rem; color: #94a3b8; line-height: 1.4; }
        
        .port { width: 10px; height: 10px; background: #0f172a; border: 2.5px solid #6366f1; border-radius: 50%; position: absolute; top: 50%; transform: translateY(-50%); z-index: 5; }
        .port.in { left: -6px; }
        .port.out { right: -6px; }
      </style>

      <div class="wf-split-layout">
        <!-- Sidebar -->
        <div class="wf-side-panel">
          <h3>System Blocks</h3>
          <div class="block-item">
            <div class="block-status"></div>
            <div class="block-info"><span>Webhook Trigger</span><small>Status: Listening</small></div>
          </div>
          <div class="block-item">
            <div class="block-status"></div>
            <div class="block-info"><span>Query Router</span><small>Status: Active</small></div>
          </div>
          <div class="block-item">
            <div class="block-status"></div>
            <div class="block-info"><span>Security Guard</span><small>Status: Filtering</small></div>
          </div>
          <div class="block-item">
            <div class="block-status"></div>
            <div class="block-info"><span>Gemini AI Core</span><small>Status: Ready</small></div>
          </div>
          <div class="block-item">
            <div class="block-status"></div>
            <div class="block-info"><span>Analytics Engine</span><small>Status: Analyzing</small></div>
          </div>
        </div>

        <!-- Main Canvas -->
        <div class="wf-main">
          ${lastAiError ? `
            <div style="position: absolute; top: 20px; right: 20px; background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; padding: 1rem; border-radius: 12px; color: #fca5a5; font-family: monospace; font-size: 0.75rem; z-index: 100; max-width: 400px; backdrop-filter: blur(8px);">
              <div style="font-weight: 800; color: #ef4444; margin-bottom: 5px;">⚠️ LAST SYSTEM ERROR</div>
              <div>Time: ${new Date(lastAiError.timestamp).toLocaleString()}</div>
              <div>PSID: ${lastAiError.psid}</div>
              <div style="margin-top: 5px; opacity: 0.8; white-space: pre-wrap;">${lastAiErrorStr}</div>
            </div>
          ` : ''}
          <div class="wf-canvas">
            <svg class="wf-svg-layer">
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#818cf8" />
                </marker>
              </defs>
              <!-- 5-Step Logic Chain -->
              <path class="wf-line" style="animation-delay: 0.5s;" d="M 220 300 L 260 300" /> <!-- Trigger -> Router -->
              <path class="wf-line" style="animation-delay: 1.5s;" d="M 440 300 L 480 300" /> <!-- Router -> Security -->
              <path class="wf-line" style="animation-delay: 2.5s;" d="M 660 300 C 690 300 700 160 740 160" /> <!-- Security -> AI -->
              <path class="wf-line" style="animation-delay: 2.5s;" d="M 660 300 C 690 300 700 440 740 440" /> <!-- Security -> Storage -->
              <path class="wf-line" style="animation-delay: 4.0s;" d="M 920 160 C 950 160 960 300 1000 300" /> <!-- AI -> Response -->
              <path class="wf-line" style="animation-delay: 4.0s;" d="M 920 440 C 950 440 960 300 1000 300" /> <!-- Storage -> Response -->
            </svg>

            <!-- NODES (X: 40, 260, 480, 740, 1000) -->
            <div class="node" style="left: 40px; top: 250px; animation-delay: 0s;">
              <div class="step-badge">STEP 1</div>
              <div class="node-header"><div class="node-icon">💬</div><div class="node-title">Messenger</div></div>
              <div class="node-body">Incoming message trigger.</div>
              <div class="port out"></div>
            </div>

            <div class="node" style="left: 260px; top: 250px; animation-delay: 1s;">
              <div class="step-badge">STEP 2</div>
              <div class="node-header"><div class="node-icon">🔀</div><div class="node-title">Router</div></div>
              <div class="node-body">Logic & Intent path.</div>
              <div class="port in"></div>
              <div class="port out"></div>
            </div>

            <div class="node" style="left: 480px; top: 250px; animation-delay: 2s; border-color: rgba(16, 185, 129, 0.4);">
              <div class="step-badge" style="background: #10b981;">SECURE</div>
              <div class="node-header"><div class="node-icon">🛡️</div><div class="node-title">Security Guard</div></div>
              <div class="node-body">Content filtering & safety.</div>
              <div class="port in"></div>
              <div class="port out"></div>
            </div>

            <div class="node" style="left: 740px; top: 110px; animation-delay: 3s;">
              <div class="step-badge">STEP 3</div>
              <div class="node-header">
                <div class="node-icon"><img src="https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/google-gemini-icon.png" style="width: 20px;"></div>
                <div class="node-title">AI Core</div>
              </div>
              <div class="node-body">Gemini 2.0 reasoning.</div>
              <div class="port in"></div>
              <div class="port out"></div>
            </div>

            <div class="node" style="left: 740px; top: 390px; animation-delay: 3s;">
              <div class="node-header">
                <div class="node-icon"><img src="https://upload.wikimedia.org/wikipedia/commons/4/4b/Cloudflare_Logo.svg" style="width: 20px;"></div>
                <div class="node-title">Storage</div>
              </div>
              <div class="node-body">Worker KV memory.</div>
              <div class="port in"></div>
              <div class="port out"></div>
            </div>

            <div class="node" style="left: 1000px; top: 250px; animation-delay: 4.5s;">
              <div class="step-badge">STEP 4</div>
              <div class="node-header"><div class="node-icon">🚀</div><div class="node-title">Response</div></div>
              <div class="node-body">Message delivery.</div>
              <div class="port in"></div>
            </div>
          </div>
        </div>
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
            if (!entry.messaging) continue;
            for (const webhook_event of entry.messaging) {
              const sender_psid = webhook_event.sender.id;

              // Ignore echos and ensure it's a real message
              if (webhook_event.message && !webhook_event.message.is_echo && webhook_event.message.text) {
                ctx.waitUntil(handleMessage(sender_psid, webhook_event.message.text, env));
              }
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

  // Get chat history and profile for gender detection
  const profile = (await env.CHAT_LOGS.get(`profile_${sender_psid}`, { type: 'json' })) || { name: `User ${sender_psid}`, pic: '', gender: 'unknown' };
  let history = (await env.CHAT_LOGS.get(`psid_${sender_psid}`, { type: 'json' })) || [];
  
  // Detect Myanmar Gender Particle
  let particle = "ရှင့်"; // Default to Female as it's common in counseling
  const name = profile.name.toLowerCase();
  const maleMarkers = ['u ', 'ko ', 'maung ', 'saw ', 'sai ', 'min '];
  const femaleMarkers = ['daw ', 'ma ', 'naw ', 'nan ', 'eichen '];
  
  if (profile.gender === 'male' || maleMarkers.some(m => name.startsWith(m))) {
    particle = "ခင်ဗျာ";
  } else if (profile.gender === 'female' || femaleMarkers.some(m => name.startsWith(m))) {
    particle = "ရှင့်";
  }

  // Prepare contents for Gemini with GREETING/CLOSING ONLY instruction
  const contents = [
    { role: 'user', parts: [{ text: `SYSTEM_INSTRUCTION: ${systemInstruction}\nCRITICAL LINGUISTIC RULE: The client is ${particle === 'ရှင့်' ? 'FEMALE' : 'MALE'}. \n1. Use the polite particle "${particle}" ONLY in your initial greeting and final closing sentence.\n2. DO NOT use the phrase "အားမနာတမ်း" in your responses.\n3. Example of a PERFECT GREETING: "မင်္ဂလာပါ${particle}။ Counseling Center မှ ကြိုဆိုပါတယ်။ ဘာများကူညီပေးရမလဲ၊ ဒါမှမဟုတ် ရင်ဖွင့်ချင်တာရှိရင် ပြောပြလို့ရပါတယ်။"\n4. STRICT PRIVACY: Each conversation is 100% PRIVATE. Never say "As I mentioned before" or "I already told you" unless the evidence is in the CHAT HISTORY below. Do not confuse different users.\n5. PRIORITY: Always answer every user with deep empathy. Never leave someone unanswered.` }] },
    ...history.slice(-10).flatMap(log => [
      { role: 'user', parts: [{ text: log.user_message }] },
      { role: 'model', parts: [{ text: log.ai_response }] }
    ]),
    { role: 'user', parts: [{ text: messageText }] }
  ];

  // Gemini Safety Settings (Allowing sensitive counseling topics)
  const safetySettings = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
  ];

  // Key-First Multi-Model Fallback Strategy
  const apiKeys = env.GEMINI_API_KEY.split(/[\s,;\n\r]+/).filter(k => k.startsWith('AIzaSy'));
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-flash'];
  let finalData = null;
  let lastErrorDetails = null;

  for (let i = 0; i < apiKeys.length; i++) {
    const key = apiKeys[i];
    let keyFailedCompletely = true;

    for (const model of models) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents, safetySettings })
        });

        const resJson = await response.json();
        if (response.ok) {
          finalData = resJson;
          keyFailedCompletely = false;
          break; // Success!
        } else {
          lastErrorDetails = { model, keyIndex: i + 1, ...resJson };
          console.warn(`[AI_RETRY] Model ${model} Key ${i+1} failed:`, response.status);
          
          // If it's a 503 (Demand) or 429 (Quota), try the NEXT MODEL on THIS KEY immediately
          // Or if it's 404 (Not Found), try the next model
          if (response.status !== 503 && response.status !== 429 && response.status !== 404) {
            // If it's a permanent error (like 400), don't bother with other models on this key
            break; 
          }
        }
      } catch (e) {
        lastErrorDetails = { model, message: e.message };
      }
    }

    if (finalData) break;
    
    // Small pause before trying a completely different API key
    await new Promise(r => setTimeout(r, 500));
  }

  let aiText = '';
  if (finalData && finalData.candidates && finalData.candidates[0] && finalData.candidates[0].content) {
    aiText = finalData.candidates[0].content.parts[0].text;
    
    // Programmatic Sanitization (The "Iron Fist")
    // Keep only the first and last occurrence of the particle
    const p = particle;
    const parts = aiText.split(p);
    if (parts.length > 3) {
      // If found more than 2 times, reconstruct keeping only first and last
      const first = parts[0];
      const last = parts[parts.length - 1];
      const middle = parts.slice(1, -1).join('');
      aiText = `${first}${p}${middle}${p}${last}`;
    }
  } else {
    // All keys failed or returned empty
    console.error('[AI_FATAL_ERROR]', JSON.stringify(lastErrorDetails));
    
    // Sanitize before storing to KV
    const sanitizeError = (obj) => JSON.parse(JSON.stringify(obj).replace(/AIzaSy[a-zA-Z0-9_\-]+/g, '[MASKED_KEY]'));
    
    await env.CHAT_LOGS.put('stat_last_ai_error', JSON.stringify({ 
      timestamp: Date.now(), 
      psid: sender_psid, 
      error: lastErrorDetails ? sanitizeError(lastErrorDetails) : 'All keys exhausted'
    }));
    
    if (lastErrorDetails?.candidates?.[0]?.finishReason === 'SAFETY') {
      aiText = `ကျမတို့ Counseling Center မှ အမြဲအသင့်ရှိနေပါတယ်။ အခုပြောတဲ့အကြောင်းအရာက အရမ်းလေးနက်တဲ့အတွက်ကြောင့် စိတ်အေးအေးထားပြီး ခဏစောင့်ပေးပါ${particle}။ ကျမတို့ လူကိုယ်တိုင် ပြန်လည်ဖြေကြားပေးပါမယ်။`;
    } else {
      aiText = `တောင်းပန်ပါတယ်${particle}။ အခုအချိန်မှာ စနစ်ပိုင်းဆိုင်ရာ အခက်အခဲလေးရှိနေလို့ ခဏနေမှ ပြန်ပြောပေးပါမယ်နော်။`;
    }
  }

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

async function getFacebookProfile(psid, env, force = false) {
  const cacheKey = `profile_${psid}`;
  if (!force) {
    const cached = await env.CHAT_LOGS.get(cacheKey, { type: 'json' });
    if (cached && cached.name && !cached.name.startsWith('User ')) return cached;
  }

  console.log(`[ProfileSync] Attempting fetch for PSID: ${psid}`);
  try {
    const fbUrl = `https://graph.facebook.com/${psid}?fields=first_name,last_name,profile_pic,gender&access_token=${env.PAGE_ACCESS_TOKEN}`;
    const response = await fetch(fbUrl);
    const data = await response.json();
    
    if (data.error) {
       console.error(`[ProfileSync] FB API Error for ${psid}:`, JSON.stringify(data.error));
       // Check for common permission issues
       if (data.error.code === 100) {
         console.warn(`[ProfileSync] PSID ${psid} might be invalid or app lacks permissions for this user.`);
       }
       return { name: `User ${psid}`, pic: '' };
    }

    const profile = {
      name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || `User ${psid}`,
      pic: data.profile_pic || '',
      gender: data.gender || 'unknown'
    };
    
    if (profile.name !== `User ${psid}`) {
      console.log(`[ProfileSync] Success for ${psid}: ${profile.name}`);
      await env.CHAT_LOGS.put(cacheKey, JSON.stringify(profile));
    } else {
      console.warn(`[ProfileSync] No name data returned for ${psid}`);
    }
    
    return profile;
  } catch (e) {
    console.error(`[ProfileSync] Network Error for ${psid}:`, e.message);
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
