(() => {
  const root = document.documentElement;
  const held = new Set();
  let latched = false;
  let firstInput = null;
  const isTextField = element => element instanceof HTMLTextAreaElement
    || (element instanceof HTMLInputElement && ['text', 'search', 'url', 'email', 'password', 'tel'].includes(element.type));
  function toggle() {
    const clean = root.classList.toggle('presentation-clean');
    const workspace = document.querySelector('.workspace');
    const settings = document.querySelector('.settings');
    const button = document.querySelector('#wave-settings-toggle');
    if (workspace && settings) {
      workspace.classList.toggle('controls-open', !clean);
      settings.inert = clean;
      button?.setAttribute('aria-expanded', String(!clean));
      if (button) button.textContent = clean ? 'Settings' : 'Close settings';
    }
    if (clean) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.closest('[data-site-ui]')) active.blur();
      const colors = document.querySelector('#colors');
      if (colors?.matches(':popover-open')) colors.hidePopover();
    }
    document.dispatchEvent(new CustomEvent('site-ui-change', { detail: { visible: !clean } }));
  }
  function undoChordCharacter() {
    const saved = firstInput;
    if (!saved || !isTextField(saved.target) || saved.start === null || saved.end === null) return;
    const expected = saved.value.slice(0, saved.start) + saved.character + saved.value.slice(saved.end);
    // Remove only the first shortcut character, never unrelated edits or restored content.
    if (saved.target.value !== expected) return;
    saved.target.value = saved.value;
    saved.target.setSelectionRange(saved.start, saved.end);
    saved.target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
  }
  document.addEventListener('keydown', event => {
    if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) { firstInput = null; return; }
    const code = event.code || (event.key.toLowerCase() === 'z' ? 'KeyZ' : event.key.toLowerCase() === 'y' ? 'KeyY' : '');
    if (!['KeyZ', 'KeyY'].includes(code)) { firstInput = null; return; }
    if (event.repeat) return;
    if (held.size === 0 && isTextField(event.target)) {
      firstInput = { target: event.target, value: event.target.value,
        start: event.target.selectionStart, end: event.target.selectionEnd, character: event.key };
    }
    held.add(code);
    if (held.has('KeyZ') && held.has('KeyY') && !latched) {
      event.preventDefault(); event.stopImmediatePropagation();
      undoChordCharacter(); firstInput = null;
      latched = true; toggle();
    }
  }, true);
  document.addEventListener('keyup', event => {
    held.delete(event.code);
    if (held.size < 2) latched = false;
    if (held.size === 0) firstInput = null;
  }, true);
  const reset = () => { held.clear(); latched = false; firstInput = null; };
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
})();
