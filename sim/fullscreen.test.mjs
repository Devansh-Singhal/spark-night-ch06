import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindFullscreen } from './fullscreen.js';

function controls(enabled = true) {
  const doc = Object.assign(new EventTarget(), { fullscreenEnabled: enabled, fullscreenElement: null });
  const change = (element) => { doc.fullscreenElement = element; doc.dispatchEvent(new Event('fullscreenchange')); };
  const view = { ownerDocument: doc, requestFullscreen: async () => change(view) };
  doc.exitFullscreen = async () => change(null);
  const button = { textContent: 'Full screen', setAttribute: (key, value) => { button[key] = value; }, focus: () => { button.focused = true; } };
  const status = { hidden: true };
  bindFullscreen(view, button, status);
  return { doc, view, button, status, change };
}

test('full screen enters, exits and follows an external Escape exit', async () => {
  const { doc, view, button, change } = controls();
  await button.onclick();
  assert.equal(doc.fullscreenElement, view);
  assert.equal(button.textContent, 'Exit full screen');
  assert.equal(button['aria-pressed'], 'true');
  await button.onclick();
  assert.equal(doc.fullscreenElement, null);
  assert.equal(button['aria-pressed'], 'false');
  assert.ok(button.focused);
  await button.onclick();
  change(null);
  assert.equal(button.textContent, 'Full screen');
});

test('a rejected request shows a message and allows retrying', async () => {
  const { view, button, status } = controls();
  const request = view.requestFullscreen;
  view.requestFullscreen = async () => { throw new Error('Denied'); };
  await button.onclick();
  assert.equal(status.hidden, false);
  assert.match(status.textContent, /Could not switch full screen/);
  assert.equal(button.textContent, 'Full screen');
  view.requestFullscreen = request;
  await button.onclick();
  assert.equal(status.hidden, true);
});

test('unsupported browsers disable the control with an explanation', () => {
  const { button } = controls(false);
  assert.equal(button.disabled, true);
  assert.match(button.title, /unavailable/);
});
