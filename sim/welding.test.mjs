import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.min.js';
import { JOB } from './engine.js';
import { createWeldingEffects, positionTorch } from './welding.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const curves = [
  new THREE.LineCurve3(V(-93, 10.6, -12), V(-93, 10.6, 39)),
  new THREE.LineCurve3(V(47, 10.6, -12), V(47, 10.6, 39)),
  new THREE.CubicBezierCurve3(V(90, 10.6, 10), V(90, 10.6, 60), V(150, 10.6, 60), V(150, 10.6, 10)),
  new THREE.LineCurve3(V(-58, 10.6, 29), V(-2, 10.6, 29)),
];
const timings = JOB.welds.map((w) => ({ start: w.start, end: w.start + w.dur, dur: w.dur }));
const park = V(10, 150, 60);
const pose = (sec, times = timings) => positionTorch(curves, times, sec, park, V(0, 0, 0), V(0, 0, 0));
const state = (sec, times = timings) => {
  const w = times.findIndex((tm) => tm && sec >= tm.start && sec < tm.end);
  return { sec, timings: times, live: true, arc: w < 0 ? null : { w, frac: (sec - times[w].start) / times[w].dur } };
};
const rig = () => {
  const scene = new THREE.Scene();
  const effects = createWeldingEffects(scene, curves, new THREE.Texture());
  const group = scene.getObjectByName('welding-effects');
  const update = (sec, times = timings, reduced = false, live = true) => effects.update({ ...state(sec, times), live }, pose(sec, times), V(0.4, 0.8, 0.3).normalize(), reduced);
  return { group, update, sparks: group.getObjectByName('weld-sparks'), pool: group.getObjectByName('molten-pool') };
};

test('torch tracks all four seams exactly and approaches without a jump', () => {
  timings.forEach((tm, w) => {
    for (const f of [0, 0.25, 0.5, 0.99]) {
      const expected = curves[w].getPointAt(f).add(V(0, 5, 0));
      assert.ok(pose(tm.start + tm.dur * f).distanceTo(expected) < 1e-8);
    }
    for (const boundary of [tm.start, tm.end]) {
      assert.ok(pose(boundary - 1e-5).distanceTo(pose(boundary + 1e-5)) < 0.01);
      const before = V(0, 0, 0), after = V(0, 0, 0);
      positionTorch(curves, timings, boundary - 1e-5, park, V(0, 0, 0), before);
      positionTorch(curves, timings, boundary + 1e-5, park, V(0, 0, 0), after);
      assert.ok(before.distanceTo(after) < 0.001, 'torch lean stays continuous at arc boundaries');
    }
  });
  assert.ok(pose(13.5).y > 120, 'torch lifts clear of the bracket between seams');
  assert.deepEqual(pose(48), park);
  assert.deepEqual(pose(12, [null, null, null, null]), park);
});

test('arc, sparks and smoke follow every weld and freeze at the playhead', () => {
  const { group, update, sparks, pool } = rig();
  timings.forEach((tm, w) => {
    const sec = tm.start + tm.dur * 0.5;
    update(sec);
    assert.ok(group.visible && pool.visible && sparks.visible);
    assert.ok(group.children.some((p) => p.name === 'weld-smoke' && p.visible));
    assert.ok(pool.position.distanceTo(curves[w].getPointAt(0.5).add(V(0, 3.8, 0))) < 1e-8);
    const frozen = Array.from(sparks.instanceMatrix.array);
    update(sec);
    assert.deepEqual(Array.from(sparks.instanceMatrix.array), frozen);
    assert.ok(frozen.every(Number.isFinite));
    assert.ok(frozen.some((n, i) => i % 16 === 0 && n !== 0), 'particles were emitted');
  });
});

test('rewinding reconstructs effects and clears them at a new part', () => {
  const { group, update, sparks, pool } = rig();
  update(10);
  const first = Array.from(sparks.instanceMatrix.array);
  update(31.5);
  update(10);
  assert.deepEqual(Array.from(sparks.instanceMatrix.array), first);
  update(0);
  assert.equal(pool.visible, false);
  assert.equal(sparks.visible, false);
  assert.ok(group.children.filter((p) => p.name === 'weld-smoke').every((p) => !p.visible));
});

test('skipped welds have no arc or particles; reduced motion retains the weld', () => {
  const { group, update, sparks, pool } = rig();
  update(16, [timings[0], null, timings[2], timings[3]]);
  assert.equal(pool.visible, false);
  assert.equal(sparks.visible, false);
  update(16, timings, true);
  assert.equal(pool.visible, true);
  assert.equal(sparks.visible, false);
  assert.ok(group.children.filter((p) => p.name === 'weld-smoke').every((p) => !p.visible));
  update(16, timings, false, false);
  assert.equal(group.visible, false, 'time-lapse has no ghost arc');
});
