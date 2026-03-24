// popup.js v2 — Gemini powered

const GEMINI_API_KEY = 'AIzaSyARnJLwSH0fUPOHEMh72qa2TkTnArRRs1U';

let improvedPrompt = '';
let activeTab = 'detect';

document.addEventListener('DOMContentLoaded', async () => {

  // ── DOM refs ──────────────────────────────────────────────────────────
  const detectedPromptEl = document.getElementById('detectedPrompt');
  const writePromptEl    = document.getElementById('writePrompt');
  const improveBtn       = document.getElementById('improveBtn');
  const clearBtn         = document.getElementById('clearBtn');
  const injectBtn        = document.getElementById('injectBtn');
  const copyBtn          = document.getElementById('copyBtn');
  const loader           = document.getElementById('loader');
  const errorMsg         = document.getElementById('errorMsg');
  const resultWrap       = document.getElementById('resultWrap');
  const resultBox        = document.getElementById('resultBox');
  const toast            = document.getElementById('toast');
  const tabs             = document.querySelectorAll('.tab');
  const tabContents      = document.querySelectorAll('.tab-content');

  const fields = {
    intent:      document.getElementById('intent'),
    persona:     document.getElementById('persona'),
    audience:    document.getElementById('audience'),
    context:     document.getElementById('context'),
    tone:        document.getElementById('tone'),
    constraints: document.getElementById('constraints'),
  };

  // ── Tab switching ─────────────────────────────────────────────────────
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${activeTab}`).classList.add('active');
    });
  });

  // ── Auto-detect prompt from page ──────────────────────────────────────
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await chrome.tabs.sendMessage(tab.id, { action: 'getPrompt' });

    if (res && res.prompt && res.prompt.length > 0) {
      detectedPromptEl.textContent = res.prompt;
      detectedPromptEl.classList.remove('empty');
      fields.intent.value = res.prompt;
    } else {
      detectedPromptEl.textContent = 'No prompt detected. Type a prompt in the chat box first, then reopen this extension.';
      detectedPromptEl.classList.add('empty');
    }
  } catch (e) {
    detectedPromptEl.textContent = 'Could not connect. Make sure you are on ChatGPT, Claude, or Gemini and refresh the page.';
    detectedPromptEl.classList.add('empty');
  }

  // Load saved fields
  chrome.storage.local.get(['persona', 'tone'], (data) => {
    if (data.persona) fields.persona.value = data.persona;
    if (data.tone)    fields.tone.value    = data.tone;
  });

  // ── Get the base prompt depending on active tab ───────────────────────
  function getBasePrompt() {
    if (activeTab === 'write') {
      return writePromptEl.value.trim();
    } else {
      return fields.intent.value.trim() || detectedPromptEl.textContent.trim();
    }
  }

  // ── Improve Button ────────────────────────────────────────────────────
  improveBtn.addEventListener('click', async () => {
    const basePrompt = getBasePrompt();

    if (!basePrompt || detectedPromptEl.classList.contains('empty') && activeTab === 'detect' && !fields.intent.value.trim()) {
      showError('No prompt found. Either type in the chat box or use the Write Prompt tab.');
      return;
    }

    if (!basePrompt) {
      showError('Please enter a prompt first.');
      return;
    }

    hideError();
    loader.classList.add('visible');
    improveBtn.disabled = true;
    resultWrap.classList.remove('visible');

    // Save persona + tone
    chrome.storage.local.set({
      persona: fields.persona.value,
      tone: fields.tone.value,
    });

    const systemInstruction = `You are an expert prompt engineer. Rewrite the user's basic prompt into a single powerful, clear, and effective prompt that will get the best possible output from an AI.

Rules:
- Output ONLY the improved prompt. No preamble, no explanation, no labels.
- Naturally incorporate the persona, audience, tone, context, and constraints provided.
- Write it as one coherent, flowing prompt — no headers or bullet points inside it.
- Be specific, detailed, and actionable.`;

    const userMessage = `Base Prompt: ${basePrompt}
${fields.persona.value    ? `\nWho I am: ${fields.persona.value}` : ''}
${fields.audience.value   ? `\nTarget Audience: ${fields.audience.value}` : ''}
${fields.context.value    ? `\nWhat to Include: ${fields.context.value}` : ''}
${fields.tone.value       ? `\nTone: ${fields.tone.value}` : ''}
${fields.constraints.value ? `\nConstraints: ${fields.constraints.value}` : ''}

Rewrite into a single powerful prompt.`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: [{ parts: [{ text: userMessage }] }]
          })
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Gemini API error');
      }

      const data = await response.json();
      improvedPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!improvedPrompt) throw new Error('Empty response from Gemini. Check your API key.');

      resultBox.textContent = improvedPrompt;
      resultWrap.classList.add('visible');
      showToast('✨ Prompt lifted!');

    } catch (err) {
      showError(`${err.message}`);
    } finally {
      loader.classList.remove('visible');
      improveBtn.disabled = false;
    }
  });

  // ── Inject into chat box ──────────────────────────────────────────────
  injectBtn.addEventListener('click', async () => {
    if (!improvedPrompt) return;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const res = await chrome.tabs.sendMessage(tab.id, { action: 'injectPrompt', prompt: improvedPrompt });
      if (res && res.success) {
        showToast('⚡ Injected into chat!');
        setTimeout(() => window.close(), 1200);
      } else {
        await navigator.clipboard.writeText(improvedPrompt);
        showToast('📋 Copied — paste manually!');
      }
    } catch (e) {
      await navigator.clipboard.writeText(improvedPrompt);
      showToast('📋 Copied — paste manually!');
    }
  });

  // ── Copy ──────────────────────────────────────────────────────────────
  copyBtn.addEventListener('click', async () => {
    if (!improvedPrompt) return;
    await navigator.clipboard.writeText(improvedPrompt);
    showToast('📋 Copied to clipboard!');
  });

  // ── Clear ─────────────────────────────────────────────────────────────
  clearBtn.addEventListener('click', () => {
    Object.values(fields).forEach(f => f.value = '');
    writePromptEl.value = '';
    resultWrap.classList.remove('visible');
    improvedPrompt = '';
    hideError();
    showToast('Cleared!');
  });

  // ── Helpers ───────────────────────────────────────────────────────────
  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.add('visible');
  }

  function hideError() {
    errorMsg.classList.remove('visible');
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

});
