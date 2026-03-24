// content.js

function getPromptText() {
  const selectors = [
    '#prompt-textarea',
    'textarea[placeholder="Message ChatGPT"]',
    'textarea[placeholder="Send a message"]',
    '.ProseMirror',
    '.ql-editor',
    'div[contenteditable="true"]',
    'textarea'
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = (el.value || el.innerText || '').trim();
      if (text) return text;
    }
  }
  return '';
}

function injectPrompt(text) {
  const selectors = [
    '#prompt-textarea',
    '.ProseMirror',
    '.ql-editor',
    'div[contenteditable="true"]',
    'textarea'
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      el.focus();
      if (el.tagName === 'TEXTAREA') {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        setter.call(el, text);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        el.innerText = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel2 = window.getSelection();
        sel2.removeAllRanges();
        sel2.addRange(range);
      }
      return true;
    }
  }
  return false;
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === 'getPrompt') sendResponse({ prompt: getPromptText() });
  if (req.action === 'injectPrompt') sendResponse({ success: injectPrompt(req.prompt) });
  return true;
});
