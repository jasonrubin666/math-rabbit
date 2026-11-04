// Rabbit rig: landmark config, per-splat joint weights, and the procedural animation.
// All positions are in the rabbit's rest space (y up, z toward the viewer, ~1 unit tall).

export const BONES = { torso: 0, head: 1, earL: 2, earR: 3, jaw: 4 };
export const FLAG = { none: 0, eyeL: 1, eyeR: 2, mouth: 3, wisp: 4, nearEye: 5 };

export const RIG = {
  // The head is a bell from the neck (y~-0.205) up to a dome that tops out at y~0.147 in the middle.
  neckY: -0.205, neckBlend: 0.017,
  headPivot: [0.005, -0.21, -0.02],
  // The two ears are separate lobes from y~0.155 up; keep the blend band above the dome so moving an
  // ear never drags the scalp with it.
  earY0: 0.148, earY1: 0.172,
  earPivotL: [-0.06, 0.158, 0.0], earPivotR: [0.065, 0.158, 0.0],
  // The mouth is the seam where the two cheek pads (with the pink nose between them) meet the round chin:
  // center y -0.126, curving down to ~-0.137 at |x|=0.035.
  mouthY: -0.126, mouthCurve: -9.0,
  jawPivot: [0.005, -0.126, 0.03],
  jawZ: [0.10, 0.14], jawX: [0.04, 0.065],
  // the chin ends close to the neck, so the jaw fades out over a short band above it
  jawNeckBlend: 0.012,
  // the eye whites (the left one is a little bigger); z reaches back to the whites' outer edges
  eyeL: { c: [-0.078, 0.0, 0.1], r: [0.043, 0.045] },
  eyeR: { c: [0.085, 0.006, 0.1], r: [0.038, 0.047] },
  // the eyelid takes its color from the fur this far out (in eye radii, squared), above the light eye-ring
  lidRing: [2.6, 4.0],
};

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const inEye = (eye, x, y, z, grow = 1) => {
  const dx = (x - eye.c[0]) / eye.r[0], dy = (y - eye.c[1]) / eye.r[1];
  return dx * dx + dy * dy < grow * grow && z > eye.c[2] - 0.045;
};

// Returns { bone0, bone1, w0, flag } typed arrays for n splats.
export function computeWeights(pos, n) {
  const bone0 = new Uint8Array(n), bone1 = new Uint8Array(n), w0 = new Float32Array(n), flag = new Uint8Array(n);
  const w = new Float32Array(5);
  for (let i = 0; i < n; i++) {
    const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
    const head = smooth(RIG.neckY - RIG.neckBlend, RIG.neckY + RIG.neckBlend, y);
    const ear = smooth(RIG.earY0, RIG.earY1, y);
    const mouthLine = RIG.mouthY + RIG.mouthCurve * x * x;
    const jaw = smooth(0, 0.006, mouthLine - y) * smooth(RIG.jawZ[0], RIG.jawZ[1], z)
      * (1 - smooth(RIG.jawX[0], RIG.jawX[1], Math.abs(x))) * smooth(RIG.neckY, RIG.neckY + RIG.jawNeckBlend, y);
    w.fill(0);
    w[BONES.torso] = 1 - head;
    w[x < 0 ? BONES.earL : BONES.earR] = head * ear;
    w[BONES.jaw] = head * (1 - ear) * jaw;
    w[BONES.head] = head * (1 - ear) * (1 - jaw);
    // keep the two strongest influences
    let a = 0, b = 1;
    if (w[b] > w[a]) [a, b] = [b, a];
    for (let k = 2; k < 5; k++) {
      if (w[k] > w[a]) { b = a; a = k; } else if (w[k] > w[b]) b = k;
    }
    const s = w[a] + w[b];
    bone0[i] = a; bone1[i] = b; w0[i] = s > 0 ? w[a] / s : 1;
    if (inEye(RIG.eyeL, x, y, z)) flag[i] = FLAG.eyeL;
    else if (inEye(RIG.eyeR, x, y, z)) flag[i] = FLAG.eyeR;
    else if (inEye(RIG.eyeL, x, y, z, 1.8) || inEye(RIG.eyeR, x, y, z, 1.8)) flag[i] = FLAG.nearEye;
  }
  return { bone0, bone1, w0, flag };
}

// Average fur color in a ring around each eye: used to paint the eyelid when blinking.
export function sampleLidColor(pos, rgba, n) {
  const acc = [0, 0, 0]; let count = 0;
  for (let i = 0; i < n; i++) {
    const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
    for (const eye of [RIG.eyeL, RIG.eyeR]) {
      const dx = (x - eye.c[0]) / eye.r[0], dy = (y - eye.c[1]) / eye.r[1], d = dx * dx + dy * dy;
      if (d > RIG.lidRing[0] && d < RIG.lidRing[1] && dy > 0 && z > eye.c[2] - 0.045 && rgba[4 * i + 3] > 128) {
        acc[0] += rgba[4 * i]; acc[1] += rgba[4 * i + 1]; acc[2] += rgba[4 * i + 2]; count++;
      }
    }
  }
  return count ? acc.map(v => v / count / 255) : [0.7, 0.5, 0.3];
}

// Dark mouth interior, placed just behind the lips so it only shows when the jaw opens.
export function buildMouthCavity(pos, rgba, n) {
  const step = 0.003, out = [], near = [];
  for (let i = 0; i < n; i++) {
    const x = pos[3 * i], y = pos[3 * i + 1];
    if (rgba[4 * i + 3] >= 100 && Math.abs(x) < 0.07 && y > RIG.mouthY - 0.07 && y < RIG.mouthY + 0.03) near.push(i);
  }
  for (let x = -0.04; x <= 0.04; x += step) {
    for (let y = RIG.mouthY - 0.035; y <= RIG.mouthY + RIG.mouthCurve * x * x + 0.003; y += step) {
      let zMax = -1;
      for (const i of near) {
        const dx = pos[3 * i] - x, dy = pos[3 * i + 1] - y;
        if (dx * dx + dy * dy < 0.006 * 0.006 && pos[3 * i + 2] > zMax) zMax = pos[3 * i + 2];
      }
      if (zMax > 0.05) out.push([x, y, zMax - 0.02]);
    }
  }
  return out;
}

// ---- tiny column-major mat4 helpers ----
export const M4 = {
  ident: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  translate: (v) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, v[0], v[1], v[2], 1]),
  scale: (v) => new Float32Array([v[0], 0, 0, 0, 0, v[1], 0, 0, 0, 0, v[2], 0, 0, 0, 0, 1]),
  rotX(t) { const c = Math.cos(t), s = Math.sin(t); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); },
  rotY(t) { const c = Math.cos(t), s = Math.sin(t); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); },
  rotZ(t) { const c = Math.cos(t), s = Math.sin(t); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
  about(pivot, m) { return M4.mul(M4.translate(pivot), M4.mul(m, M4.translate([-pivot[0], -pivot[1], -pivot[2]]))); },
};

// ---- procedural animation ----
const rand = (a, b) => a + Math.random() * (b - a);

export class Animator {
  constructor() {
    this.look = [0, 0];          // pointer target, -1..1
    this.lookSmooth = [0, 0];
    this.talking = false; this.talkStart = 0; this.jaw = 0; this.syllableKick = 0;
    this.nextBlink = 1.5; this.blinkStart = -1;
    this.nextTwitch = 2.5; this.twitch = { side: 0, start: -10 };
    this.ear = { L: { a: 0, v: 0 }, R: { a: 0, v: 0 } };
    this.prevYaw = 0;
    this.external = null;        // { jaw: 0..1, lid: 0..1 } when something else (the Scratch game) drives the face
    this.voiceJaw = 0;           // 0..1 loudness of the voice clip playing now
  }
  blink(t) { this.blinkStart = t; }
  wiggle(t) { this.twitch = { side: Math.random() < 0.5 ? -1 : 1, start: t, both: true }; }
  kick() { this.syllableKick = 1; }

  // Returns { bones: Float32Array(16*5), lid: [L, R] closedness 0..1 }
  update(t, dt) {
    const k = 1 - Math.exp(-dt * 4);
    this.lookSmooth[0] += (this.look[0] - this.lookSmooth[0]) * k;
    this.lookSmooth[1] += (this.look[1] - this.lookSmooth[1]) * k;

    // head: idle drift + look-at
    const yaw = 0.07 * Math.sin(0.31 * t) + 0.035 * Math.sin(0.83 * t + 1) + 0.38 * this.lookSmooth[0];
    const pitch = 0.035 * Math.sin(0.47 * t + 2) - 0.22 * this.lookSmooth[1] + (this.talking ? 0.025 * Math.sin(t * 7.3) : 0);
    const roll = 0.03 * Math.sin(0.23 * t + 0.5) - 0.06 * this.lookSmooth[0];

    // breathing (chest swells from the bottom of the bust)
    const breath = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 3.8);
    const torso = M4.about([0, -0.5, -0.02], M4.scale([1 + 0.006 * breath, 1 + 0.01 * breath, 1 + 0.012 * breath]));
    const head = M4.mul(torso, M4.about(RIG.headPivot, M4.mul(M4.rotY(yaw), M4.mul(M4.rotX(pitch), M4.rotZ(roll)))));

    // ears: springy lag behind head turns + random twitches
    const yawVel = (yaw - this.prevYaw) / Math.max(dt, 1e-3); this.prevYaw = yaw;
    if (t > this.nextTwitch) { this.twitch = { side: Math.random() < 0.5 ? -1 : 1, start: t }; this.nextTwitch = t + rand(2.5, 7); }
    const tw = (t - this.twitch.start);
    const twitchAmt = tw < 0.6 ? Math.sin(tw * Math.PI / 0.3) * Math.exp(-tw * 5) * 0.35 : 0;
    for (const [side, sgn] of [['L', -1], ['R', 1]]) {
      const e = this.ear[side];
      const target = -0.25 * yawVel * sgn;
      e.v += ((target - e.a) * 60 - e.v * 7) * dt;
      e.a += e.v * dt;
    }
    const earSwayL = 0.05 * Math.sin(1.1 * t) + this.ear.L.a + ((this.twitch.side < 0 || this.twitch.both) ? twitchAmt : 0);
    const earSwayR = 0.05 * Math.sin(1.1 * t + 1.7) + this.ear.R.a + ((this.twitch.side > 0 || this.twitch.both) ? twitchAmt : 0);
    const earL = M4.mul(head, M4.about(RIG.earPivotL, M4.mul(M4.rotZ(earSwayL), M4.rotX(0.04 * Math.sin(0.7 * t)))));
    const earR = M4.mul(head, M4.about(RIG.earPivotR, M4.mul(M4.rotZ(-earSwayR), M4.rotX(0.04 * Math.sin(0.7 * t + 1)))));

    // jaw: syllable-ish flapping while talking
    let jawTarget = 0;
    if (this.talking) {
      const s = t - this.talkStart;
      jawTarget = Math.max(0, 0.55 + 0.45 * Math.sin(s * 2 * Math.PI * 4.2) * Math.sin(s * 2 * Math.PI * 1.3 + 0.7)) + this.syllableKick * 0.4;
    }
    if (this.external) jawTarget = this.external.jaw;
    jawTarget = Math.max(jawTarget, this.voiceJaw);
    this.syllableKick *= Math.exp(-dt * 10);
    this.jaw += (Math.min(jawTarget, 1) - this.jaw) * (1 - Math.exp(-dt * 25));
    const jaw = M4.mul(head, M4.about(RIG.jawPivot, M4.rotX(0.22 * this.jaw)));

    // blinks
    if (t > this.nextBlink && !this.external) { this.blinkStart = t; this.nextBlink = t + rand(2.2, 6) * (Math.random() < 0.15 ? 0.15 : 1); }
    const b = (t - this.blinkStart) / 0.18;
    const lid = this.external ? this.external.lid : b >= 0 && b <= 1 ? Math.sin(b * Math.PI) : 0;

    const bones = new Float32Array(16 * 5);
    [torso, head, earL, earR, jaw].forEach((m, i) => bones.set(m, i * 16));
    return { bones, lid: [lid, lid] };
  }
}

// Fur fringe: thin, semi-transparent wisps sprouting outward from fur splats (not sweater, eyes or mouth).
// A splat's surface normal is its shortest axis, flipped to point away from the body part it belongs to.
const PART_CENTER = { [BONES.torso]: [0, -0.37, 0], [BONES.head]: [0, -0.03, 0], [BONES.jaw]: [0, -0.14, 0.12] };
export function buildWisps(pos, rgba, axes, rig, n, density = 0.35) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (Math.random() > density || rgba[4 * i + 3] < 140 || rig.flag[i] !== FLAG.none) continue;
    const r = rgba[4 * i], g = rgba[4 * i + 1], b = rgba[4 * i + 2];
    if (b > r + 10) continue;                                   // blue sweater stays smooth
    const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
    if (Math.abs(x) < 0.06 && y < RIG.mouthY + 0.01 && y > RIG.mouthY - 0.05 && z > 0.12) continue; // lips
    let nx = axes[3 * i], ny = axes[3 * i + 1], nz = axes[3 * i + 2];
    const bone = rig.bone0[i];
    let out_ = bone === BONES.earL || bone === BONES.earR ? [0, 0, z] : (c => [x - c[0], y - c[1], z - c[2]])(PART_CENTER[bone]);
    if (nx * out_[0] + ny * out_[1] + nz * out_[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
    // only splats facing outward from the body, i.e. on the visible surface
    const len = Math.hypot(...out_);
    if (bone !== BONES.earL && bone !== BONES.earR && (nx * out_[0] + ny * out_[1] + nz * out_[2]) / len < 0.3) continue;
    const reach = 0.002 + Math.random() * 0.006;
    out.push({ src: i, p: [x + nx * reach, y + ny * reach, z + nz * reach], n: [nx, ny, nz],
      rgba: [Math.min(255, r * 1.12), Math.min(255, g * 1.12), Math.min(255, b * 1.1), 70 + Math.random() * 90] });
  }
  return out;
}
