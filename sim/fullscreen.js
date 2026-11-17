export function bindFullscreen(view, button, status) {
  const doc = view.ownerDocument;
  button.disabled = !doc.fullscreenEnabled;
  button.title = button.disabled ? 'Full screen is unavailable in this browser' : 'Expand the simulation';
  doc.addEventListener('fullscreenchange', () => {
    const active = doc.fullscreenElement === view;
    button.textContent = active ? 'Exit full screen' : 'Full screen';
    button.setAttribute('aria-pressed', String(active));
    button.title = active ? 'Exit full screen (Esc)' : 'Expand the simulation';
    if (!active) button.focus({ preventScroll: true });
  });
  button.onclick = async () => {
    status.hidden = true;
    try {
      if (doc.fullscreenElement === view) await doc.exitFullscreen();
      else await view.requestFullscreen();
    } catch {
      status.textContent = 'Could not switch full screen. Please try again in a browser tab.';
      status.hidden = false;
    }
  };
}
