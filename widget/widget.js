(function () {
  const script = document.currentScript;
  const apiBase = script.getAttribute('data-api') || window.location.origin;
  const theme = script.getAttribute('data-color') || '#0B5FFF';
  const title = script.getAttribute('data-title') || 'BIS Assistant';

  const container = document.createElement('div');
  document.body.appendChild(container);
  const shadow = container.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    .bubble {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: ${theme};
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 999999;
      transition: transform 0.2s ease;
    }
    .bubble:hover { transform: scale(1.05); }
    .bubble svg { width: 28px; height: 28px; fill: #FFF; }
    .window {
      position: fixed;
      bottom: 86px;
      right: 20px;
      width: 360px;
      height: 520px;
      background: #FFF;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .window.open { display: flex; }
    .top {
      background: ${theme};
      color: #FFF;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .top h3 { margin: 0; font-size: 0.95rem; font-weight: 600; }
    .close { background: none; border: none; color: #FFF; font-size: 1.2rem; cursor: pointer; line-height: 1; }
    .body {
      flex: 1;
      padding: 12px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 0.88rem;
      background: #F8FAFC;
    }
    .m {
      padding: 8px 12px;
      border-radius: 10px;
      max-width: 82%;
      line-height: 1.4;
      word-wrap: break-word;
    }
    .m.b { background: #E2E8F0; color: #0F172A; align-self: flex-start; }
    .m.u { background: ${theme}; color: #FFF; align-self: flex-end; }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;
    }
    .chip {
      background: #FFF;
      border: 1px solid ${theme};
      color: ${theme};
      border-radius: 14px;
      padding: 4px 10px;
      font-size: 0.78rem;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
    }
    .chip:hover {
      background: ${theme};
      color: #FFF;
    }
    .bar {
      display: flex;
      padding: 10px;
      border-top: 1px solid #E2E8F0;
      background: #FFF;
      gap: 6px;
    }
    .bar input {
      flex: 1;
      border: 1px solid #CBD5E1;
      border-radius: 16px;
      padding: 8px 12px;
      outline: none;
      font-size: 0.85rem;
    }
    .bar input:focus { border-color: ${theme}; }
    .bar button {
      background: ${theme};
      border: none;
      color: #FFF;
      border-radius: 16px;
      padding: 8px 14px;
      cursor: pointer;
      font-weight: 500;
    }
    @media (max-width: 440px) {
      .window {
        width: 100vw;
        height: 100vh;
        bottom: 0;
        right: 0;
        border-radius: 0;
      }
    }
  `;
  shadow.appendChild(style);

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;

  const win = document.createElement('div');
  win.className = 'window';
  win.innerHTML = `
    <div class="top">
      <h3>${title}</h3>
      <button class="close">✕</button>
    </div>
    <div class="body" id="wMsgs">
      <div class="m b">Hello! How can I assist you with BIS, FMCS, or EPR certifications today?</div>
      <div class="chips">
        <button class="chip" data-val="Our services">Our services</button>
        <button class="chip" data-val="Get a quote">Get a quote</button>
        <button class="chip" data-val="Contact us">Contact us</button>
        <button class="chip" data-val="About BIS">About BIS</button>
      </div>
    </div>
    <div class="bar">
      <input type="text" placeholder="Type a message..." />
      <button>Send</button>
    </div>
  `;

  shadow.appendChild(bubble);
  shadow.appendChild(win);

  let history = [
    { role: 'model', text: 'Hello! How can I assist you with BIS, FMCS, or EPR certifications today?' }
  ];
  let sending = false;

  const body = win.querySelector('#wMsgs');
  const input = win.querySelector('input');
  const sendBtn = win.querySelector('.bar button');

  bubble.onclick = () => win.classList.toggle('open');
  win.querySelector('.close').onclick = () => win.classList.remove('open');

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  function formatText(text) {
    let safe = escapeHTML(text);
    safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\n\*\s/g, '<br>• ');
    safe = safe.replace(/\n-\s/g, '<br>• ');
    safe = safe.replace(/\n/g, '<br>');
    return safe;
  }

  function addMsg(text, type) {
    const el = document.createElement('div');
    el.className = `m ${type}`;
    el.innerHTML = formatText(text);
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
  }

  async function send(customText) {
    const text = (typeof customText === 'string' ? customText : input.value).trim();
    if (!text || sending) return;
    sending = true;
    input.value = '';
    
    addMsg(text, 'u');
    history.push({ role: 'user', text });

    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history })
      });

      let data = {};
      try {
        data = await res.json();
      } catch (_) {}

      if (!res.ok || !data.reply) {
        // Roll back pending turn to prevent conversation history desync
        history.pop();
        const errorMsg = res.status === 429
          ? 'Too many messages, please wait a minute and try again.'
          : 'Sorry, the assistant is having trouble right now. Please try again in a moment.';
        addMsg(errorMsg, 'b');
        console.error('Widget server response error:', res.status, data);
      } else {
        addMsg(data.reply, 'b');
        history.push({ role: 'model', text: data.reply });
      }
    } catch (e) {
      history.pop();
      console.error('Widget network exception:', e);
      addMsg('Network connection error. Please check your internet and try again.', 'b');
    } finally {
      sending = false;
    }
  }

  sendBtn.onclick = () => send();
  input.onkeydown = (e) => {
    if (e.key === 'Enter') send();
  };

  win.querySelectorAll('.chip').forEach(btn => {
    btn.onclick = () => send(btn.getAttribute('data-val'));
  });
})();