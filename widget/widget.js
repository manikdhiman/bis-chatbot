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
    .bubble { position: fixed; bottom: 20px; right: 20px; width: 56px; height: 56px; border-radius: 50%; background: ${theme}; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 999999; }
    .bubble svg { width: 28px; height: 28px; fill: #FFF; }
    .window { position: fixed; bottom: 86px; right: 20px; width: 360px; height: 500px; background: #FFF; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); display: none; flex-direction: column; overflow: hidden; z-index: 999999; font-family: sans-serif; }
    .window.open { display: flex; }
    .top { background: ${theme}; color: #FFF; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; }
    .top h3 { margin: 0; font-size: 0.95rem; }
    .close { background: none; border: none; color: #FFF; font-size: 1.2rem; cursor: pointer; }
    .body { flex: 1; padding: 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; font-size: 0.88rem; background: #F8FAFC; }
    .m { padding: 8px 12px; border-radius: 10px; max-width: 82%; line-height: 1.4; word-wrap: break-word; }
    .m.b { background: #E2E8F0; color: #0F172A; align-self: flex-start; }
    .m.u { background: ${theme}; color: #FFF; align-self: flex-end; }
    .bar { display: flex; padding: 8px; border-top: 1px solid #E2E8F0; background: #FFF; }
    .bar input { flex: 1; border: 1px solid #CBD5E1; border-radius: 16px; padding: 6px 12px; outline: none; font-size: 0.85rem; }
    .bar button { background: ${theme}; border: none; color: #FFF; border-radius: 16px; padding: 6px 12px; margin-left: 6px; cursor: pointer; }
    @media(max-width: 440px) { .window { width: 100vw; height: 100vh; bottom: 0; right: 0; border-radius: 0; } }
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
    </div>
    <div class="bar">
      <input type="text" placeholder="Type a message..." />
      <button>Send</button>
    </div>
  `;

  shadow.appendChild(bubble);
  shadow.appendChild(win);

  let history = [{ role: 'model', text: 'Hello! How can I assist you with BIS, FMCS, or EPR certifications today?' }];
  const body = win.querySelector('#wMsgs');
  const input = win.querySelector('input');
  const sendBtn = win.querySelector('.bar button');

  bubble.onclick = () => win.classList.toggle('open');
  win.querySelector('.close').onclick = () => win.classList.remove('open');

  function addMsg(text, type) {
    const el = document.createElement('div');
    el.className = `m ${type}`;
    el.innerText = text;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
  }

  async function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMsg(text, 'u');
    history.push({ role: 'user', text });

    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history })
      });
      const data = await res.json();
      const reply = data.reply || "Could not reach server.";
      addMsg(reply, 'b');
      history.push({ role: 'model', text: reply });
    } catch (e) {
      addMsg("Connection error.", 'b');
    }
  }

  sendBtn.onclick = send;
  input.onkeydown = (e) => { if (e.key === 'Enter') send(); };
})();