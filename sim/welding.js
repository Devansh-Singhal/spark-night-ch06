import * as THREE from './vendor/three.module.min.js';

const UP = new THREE.Vector3(0, 1, 0);
const smooth = (t) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const seed = (i) => { const n = Math.sin(i * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const LEAN = [new THREE.Vector3(0.55, 0.8, 0.25), new THREE.Vector3(0.55, 0.8, 0.25), null, new THREE.Vector3(0.1, 0.8, 0.6)];
const PARK_LEAN = new THREE.Vector3(0.3, 0.9, 0.3).normalize();
function torchLean(curves, w, frac) {
  if (w < 0) return PARK_LEAN;
  if (w === 2) return curves[w].getPointAt(frac).sub(new THREE.Vector3(118, -30, 10)).normalize();
  return LEAN[w].clone().normalize();
}

// Every pose and particle uses replay time, so pausing and scrubbing leave no ghosts.
export function positionTorch(curves, timings, sec, park, out, direction) {
  let prev = -1, next = -1;
  for (let w = 0; w < timings.length; w++) {
    const tm = timings[w];
    if (!tm) continue;
    if (sec >= tm.start && sec < tm.end) {
      direction.copy(torchLean(curves, w, (sec - tm.start) / tm.dur));
      return curves[w].getPointAt((sec - tm.start) / tm.dur, out).addScaledVector(UP, 5);
    }
    if (tm.end <= sec) prev = w;
    else if (next < 0) next = w;
  }
  if (prev < 0 && next < 0) { direction.copy(PARK_LEAN); return out.copy(park); }
  const start = prev < 0 ? 0 : timings[prev].end;
  const end = next < 0 ? start + 3 : timings[next].start;
  const t = THREE.MathUtils.clamp((sec - start) / (end - start), 0, 1);
  const from = prev < 0 ? park : curves[prev].getPointAt(1).addScaledVector(UP, 5);
  const to = next < 0 ? park : curves[next].getPointAt(0).addScaledVector(UP, 5);
  direction.lerpVectors(torchLean(curves, prev, 1), torchLean(curves, next, 0), smooth(t)).normalize();
  out.lerpVectors(from, to, smooth((t - 0.22) / 0.56));
  out.y += 115 * smooth(t / 0.22) * (1 - smooth((t - 0.78) / 0.22));
  return out;
}

export function createWeldingEffects(scene, curves, glowTexture) {
  const group = new THREE.Group();
  group.name = 'welding-effects';
  scene.add(group);
  const hot = new THREE.Color(0xffc15c), cold = new THREE.Color(0xd83b08);
  const pool = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshBasicMaterial({ color: 0xffc15c, toneMapped: false }));
  pool.name = 'molten-pool';
  pool.scale.set(7, 1.4, 4.5);
  group.add(pool);
  const plasma = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 2.1, 1, 10), new THREE.MeshBasicMaterial({ color: 0xe4f6ff, toneMapped: false }));
  group.add(plasma);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.7 }));
  halo.scale.set(38, 38, 1);
  group.add(halo);

  const sparks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.95, 1, 5), new THREE.MeshBasicMaterial({ toneMapped: false }), 96);
  sparks.name = 'weld-sparks';
  sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  sparks.frustumCulled = false;
  group.add(sparks);
  const dummy = new THREE.Object3D(), velocity = new THREE.Vector3(), origin = new THREE.Vector3();
  const color = new THREE.Color();

  const pixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const i = (y * 64 + x) * 4;
    const r = Math.hypot((x - 31.5) / 32, (y - 31.5) / 32);
    pixels[i] = pixels[i + 1] = pixels[i + 2] = 130;
    pixels[i + 3] = Math.max(0, 1 - r) ** 2 * (0.75 + seed(i) * 0.25) * 255;
  }
  const smokeTexture = new THREE.DataTexture(pixels, 64, 64);
  smokeTexture.needsUpdate = true;
  smokeTexture.magFilter = THREE.LinearFilter;
  const smoke = Array.from({ length: 14 }, () => {
    const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture, transparent: true, depthWrite: false, toneMapped: false }));
    puff.name = 'weld-smoke';
    group.add(puff);
    return puff;
  });
  group.visible = false;

  function update(st, tip, direction, reducedMotion) {
    group.visible = !!st.live;
    if (!group.visible) return;
    pool.visible = plasma.visible = halo.visible = !!st.arc;
    if (st.arc) {
      curves[st.arc.w].getPointAt(st.arc.frac, origin);
      pool.position.copy(origin).addScaledVector(UP, 3.8);
      curves[st.arc.w].getTangentAt(st.arc.frac, velocity);
      pool.rotation.y = -Math.atan2(velocity.z, velocity.x);
      // A gentle pulse keeps the arc legible without a strobe.
      const pulse = reducedMotion ? 1 : 1 + 0.06 * Math.sin(st.sec * 9);
      pool.scale.set(7 * pulse, 1.4, 4.5 * pulse);
      velocity.copy(tip).addScaledVector(direction, 3).sub(pool.position);
      plasma.position.copy(pool.position).addScaledVector(velocity, 0.5);
      plasma.scale.set(pulse, velocity.length(), pulse);
      plasma.quaternion.setFromUnitVectors(UP, velocity.normalize());
      halo.position.copy(pool.position).addScaledVector(UP, 3);
      halo.material.opacity = 0.65 * pulse;
    }

    const w = st.timings.findIndex((tm) => tm && st.sec >= tm.start && st.sec < tm.end + 2.5);
    const tm = st.timings[w];
    sparks.visible = false;
    smoke.forEach((puff) => { puff.visible = false; });
    if (!tm || reducedMotion) return;
    const elapsed = st.sec - tm.start;
    sparks.visible = true;
    for (let i = 0; i < sparks.count; i++) {
      const birth = (Math.floor((elapsed * 90 - i) / sparks.count) * sparks.count + i) / 90;
      const age = elapsed - birth, life = 0.35 + seed(i + 2) * 0.5;
      const alive = birth >= 0 && birth < tm.dur && age < life;
      dummy.position.set(0, 0, 0);
      dummy.quaternion.identity();
      dummy.scale.setScalar(0);
      if (alive) {
        curves[w].getPointAt(birth / tm.dur, origin);
        const angle = seed(i) * Math.PI * 2;
        const speed = 45 + seed(i + 1) * 125, vy = 40 + seed(i + 3) * 110;
        const vx = Math.cos(angle) * speed, vz = Math.sin(angle) * speed;
        dummy.position.copy(origin).addScaledVector(UP, 4);
        dummy.position.x += vx * age;
        dummy.position.z += vz * age;
        dummy.position.y += vy * age - 180 * age * age;
        velocity.set(vx, vy - 360 * age, vz);
        // shortcut: sparks bounce on horizontal surfaces only; add mesh collisions for a physics demo.
        const surface = Math.abs(dummy.position.x) < 160 && Math.abs(dummy.position.z) < 85 ? 9 : 1;
        if (dummy.position.y < surface) {
          dummy.position.y = surface + (surface - dummy.position.y) * 0.18;
          velocity.y = Math.abs(velocity.y) * 0.18;
        }
        dummy.quaternion.setFromUnitVectors(UP, velocity.normalize());
        dummy.scale.setScalar((1 - age / life) * 0.9);
        dummy.scale.y = 4 + speed * 0.045;
        color.copy(hot).lerp(cold, age / life);
        sparks.setColorAt(i, color);
      }
      dummy.updateMatrix();
      sparks.setMatrixAt(i, dummy.matrix);
    }
    sparks.instanceMatrix.needsUpdate = true;
    if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true;
    smoke.forEach((puff, i) => {
      const birth = (Math.floor((elapsed / 0.18 - i) / smoke.length) * smoke.length + i) * 0.18;
      const age = elapsed - birth;
      puff.visible = birth >= 0 && birth < tm.dur && age < 2.4;
      if (!puff.visible) return;
      curves[w].getPointAt(birth / tm.dur, puff.position);
      puff.position.x += age * (10 + seed(i) * 8);
      puff.position.y += 13 + age * 38;
      puff.position.z += Math.sin(age * 2 + i) * age * 6;
      puff.scale.setScalar(16 + age * 24);
      puff.material.rotation = seed(i) * 6 + age * 0.15;
      puff.material.opacity = Math.sin(Math.PI * age / 2.4) * 0.22;
    });
  }

  return { update };
}
