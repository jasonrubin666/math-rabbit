// WebGL2 Gaussian-splat renderer for the rabbit, with per-splat linear-blend skinning (2 joints/splat).
// Projection math follows standard 3DGS EWA splatting (as in antimatter15/splat).
//
//   const rabbit = await createRabbit(canvas, { cam, tint });
//   rabbit.render(dt);            // advance the animation and draw one frame
//   rabbit.anim.external = {...}  // let something else drive jaw/eyelids
import { BONES, FLAG, RIG, computeWeights, sampleLidColor, buildMouthCavity, buildWisps, Animator } from './rig.js';

const VS = `#version 300 es
precision highp float; precision highp int;
uniform highp sampler2D uA, uB, uC, uD;
uniform mat4 uProj, uView; uniform vec2 uFocal, uViewport;
uniform mat4 uBones[5];
uniform vec4 uEyeL, uEyeR;    // cx, cy, rx, ry (rest space)
uniform vec2 uLid;            // closedness per eye 0..1
uniform vec3 uLidColor;
uniform float uFluff;         // splat size multiplier (softer look)
uniform float uFuzz;          // fur-wisp opacity (fluffy fringe)
uniform vec3 uTint;           // scene lighting match
uniform float uLift;          // brightens mid-tones (a gamma of 1/uLift) without blowing out highlights
in vec2 aPos; in uint aIndex;
out vec4 vColor; out vec2 vPos;
ivec2 tc(uint i) { return ivec2(int(i & 2047u), int(i >> 11u)); }
float lidLine(vec4 eye, float c) { return eye.y + eye.w * (1.0 - 1.25 * c); }
void main() {
  vec4 A = texelFetch(uA, tc(aIndex), 0);
  vec4 B = texelFetch(uB, tc(aIndex), 0);
  vec4 C = texelFetch(uC, tc(aIndex), 0);
  vec4 D = texelFetch(uD, tc(aIndex), 0);
  int b0 = int(C.z + 0.5); int packed = int(C.w + 0.5); int b1 = packed & 15; int flag = packed >> 4;
  float w0 = A.w;
  mat4 M = uBones[b0] * w0 + uBones[b1] * (1.0 - w0);
  vec3 p = (M * vec4(A.xyz, 1.0)).xyz;
  mat3 S = mat3(B.x, B.y, B.z, B.y, B.w, C.x, B.z, C.x, C.y);
  mat3 L = mat3(M);
  mat3 Vrk = L * S * transpose(L);
  // eyes, their surroundings and the mouth keep most of their crispness so the face stays readable
  float fluff = (flag >= 1 && flag <= 3) || flag == 5 ? mix(1.0, uFluff, 0.3) : flag == 4 ? 1.0 : uFluff;
  Vrk *= fluff * fluff;

  vec4 cam = uView * vec4(p, 1.0);
  vec4 pos2d = uProj * cam;
  float clip = 1.2 * pos2d.w;
  if (pos2d.z < -clip || pos2d.x < -clip || pos2d.x > clip || pos2d.y < -clip || pos2d.y > clip) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  mat3 J = mat3(uFocal.x / cam.z, 0., -(uFocal.x * cam.x) / (cam.z * cam.z),
                0., -uFocal.y / cam.z, (uFocal.y * cam.y) / (cam.z * cam.z),
                0., 0., 0.);
  mat3 T = transpose(mat3(uView)) * J;
  mat3 cov2d = transpose(T) * Vrk * T;
  cov2d[0][0] += 0.3; cov2d[1][1] += 0.3;
  float mid = (cov2d[0][0] + cov2d[1][1]) / 2.0;
  float radius = length(vec2((cov2d[0][0] - cov2d[1][1]) / 2.0, cov2d[0][1]));
  float l1 = mid + radius, l2 = mid - radius;
  if (l2 < 0.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  vec2 diag = normalize(vec2(cov2d[0][1], l1 - cov2d[0][0]));
  // axes in pixels at 1 sigma; the quad spans +-3 sigma
  vec2 major = min(sqrt(l1), 512.0) * diag;
  vec2 minor = min(sqrt(l2), 512.0) * vec2(diag.y, -diag.x);

  vec3 col = D.rgb;
  if (flag == 1 || flag == 2) {
    vec4 eye = flag == 1 ? uEyeL : uEyeR;
    float c = flag == 1 ? uLid.x : uLid.y;
    // curved lid edge (lowest at the middle), furry per-splat variation, darker toward the lash line
    float dx = (A.x - eye.x) / eye.z;
    float line = lidLine(eye, c) - 0.35 * eye.w * c * max(0.0, 1.0 - dx * dx);
    if (c > 0.01) {
      float grain = 0.86 + 0.28 * fract(sin(float(aIndex) * 12.9898) * 43758.5453);
      float shade = 0.9 * mix(0.72, 1.0, clamp((A.y - line) / (0.8 * eye.w), 0.0, 1.0));
      if (A.y > line) col = uLidColor * grain * shade;
      else if (A.y > line - 0.0045) col = uLidColor * 0.25;
      else if (c > 0.8) col = uLidColor * 0.8;   // fully shut: cover the sliver under the lash line
    }
  }
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / uLift)) * uTint;
  vColor = vec4(col, flag == 4 ? D.a * uFuzz : D.a);
  vPos = aPos * 1.5;
  vec2 center = pos2d.xy / pos2d.w;
  gl_Position = vec4(center + 2.0 * (vPos.x * major + vPos.y * minor) / uViewport, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec4 vColor; in vec2 vPos; out vec4 fragColor;
void main() {
  float r2 = dot(vPos, vPos);
  if (r2 > 9.0) discard;
  float B = exp(-0.5 * r2) * vColor.a;
  fragColor = vec4(B * vColor.rgb, B);
}`;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a); return a.map(v => v / l); };

// Decode the 32-byte/splat file into positions, colors, 3D covariances and each splat's thinnest axis.
function decodeSplats(buf) {
  const n = buf.byteLength / 32, f32 = new Float32Array(buf), u8 = new Uint8Array(buf);
  const pos = new Float32Array(n * 3), rgba = new Uint8Array(n * 4), cov = new Float32Array(n * 6), shortAxis = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[3 * i] = f32[8 * i]; pos[3 * i + 1] = f32[8 * i + 1]; pos[3 * i + 2] = f32[8 * i + 2];
    const sx = f32[8 * i + 3], sy = f32[8 * i + 4], sz = f32[8 * i + 5];
    for (let k = 0; k < 4; k++) rgba[4 * i + k] = u8[32 * i + 24 + k];
    let q = [0, 1, 2, 3].map(k => (u8[32 * i + 28 + k] - 128) / 128);
    const ql = Math.hypot(...q) || 1; q = q.map(v => v / ql);
    const [w, x, y, z] = q;
    const R = [
      1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y),
      2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x),
      2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y),
    ];
    const M = [sx * R[0], sx * R[1], sx * R[2], sy * R[3], sy * R[4], sy * R[5], sz * R[6], sz * R[7], sz * R[8]];
    const k = sx <= sy && sx <= sz ? 0 : sy <= sz ? 1 : 2;
    shortAxis.set([R[3 * k], R[3 * k + 1], R[3 * k + 2]], 3 * i);
    cov.set([
      M[0] * M[0] + M[3] * M[3] + M[6] * M[6], M[0] * M[1] + M[3] * M[4] + M[6] * M[7], M[0] * M[2] + M[3] * M[5] + M[6] * M[8],
      M[1] * M[1] + M[4] * M[4] + M[7] * M[7], M[1] * M[2] + M[4] * M[5] + M[7] * M[8], M[2] * M[2] + M[5] * M[5] + M[8] * M[8],
    ], 6 * i);
  }
  return { n, pos, rgba, cov, shortAxis };
}

export async function createRabbit(canvas, opts = {}) {
  const {
    splatUrl = new URL('rabbit.splat', import.meta.url),
    cam: camOpts = {}, tint = [1, 1, 1], lift = 1, fluff = 1.3, fuzz = 1,
  } = opts;
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true, alpha: true });
  if (!gl) throw new Error('WebGL2 not available');

  const compile = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const U = (name) => gl.getUniformLocation(prog, name);

  // ---- splat data: file splats + mouth interior + fur wisps ----
  const file = decodeSplats(await (await fetch(splatUrl)).arrayBuffer());
  const nFile = file.n;
  const rig = computeWeights(file.pos, nFile);
  const lidColor = sampleLidColor(file.pos, file.rgba, nFile);
  const cavity = buildMouthCavity(file.pos, file.rgba, nFile);
  const wisps = buildWisps(file.pos, file.rgba, file.shortAxis, rig, nFile);
  const n = nFile + cavity.length + wisps.length;

  const grow = (a, k, C) => { const o = new C(n * k); o.set(a); return o; };
  const pos = grow(file.pos, 3, Float32Array), rgba = grow(file.rgba, 4, Uint8Array), cov = grow(file.cov, 6, Float32Array);
  for (const key of ['bone0', 'bone1', 'flag']) rig[key] = grow(rig[key], 1, Uint8Array);
  rig.w0 = grow(rig.w0, 1, Float32Array);

  const s2 = 0.0042 ** 2;
  cavity.forEach((p, j) => {
    const i = nFile + j;
    pos.set(p, 3 * i);
    const deep = Math.min(1, (RIG.mouthY - p[1]) / 0.035);
    rgba.set([Math.round(70 - 25 * deep), Math.round(18 - 8 * deep), Math.round(22 - 8 * deep), 255], 4 * i);
    cov.set([s2, 0, 0, s2, 0, s2 * 0.5], 6 * i);
    rig.bone0[i] = BONES.head; rig.bone1[i] = BONES.head; rig.w0[i] = 1; rig.flag[i] = FLAG.mouth;
  });
  const sl = 0.0045 ** 2, st = 0.0013 ** 2;   // wisps: long along the surface normal, thin across it
  wisps.forEach((w, j) => {
    const i = nFile + cavity.length + j, [a, b, c] = w.n, d = sl - st;
    pos.set(w.p, 3 * i);
    rgba.set(w.rgba.map(Math.round), 4 * i);
    cov.set([st + d * a * a, d * a * b, d * a * c, st + d * b * b, d * b * c, st + d * c * c], 6 * i);
    rig.bone0[i] = rig.bone0[w.src]; rig.bone1[i] = rig.bone1[w.src]; rig.w0[i] = rig.w0[w.src]; rig.flag[i] = FLAG.wisp;
  });

  // ---- textures (fetched by splat index in the vertex shader) ----
  const TW = 2048, TH = Math.ceil(n / TW);
  const tex = (unit, data, internal, format, type) => {
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, TW, TH, 0, format, type, data);
  };
  {
    const A = new Float32Array(TW * TH * 4), B = new Float32Array(TW * TH * 4), C = new Float32Array(TW * TH * 4), D = new Uint8Array(TW * TH * 4);
    for (let i = 0; i < n; i++) {
      A.set([pos[3 * i], pos[3 * i + 1], pos[3 * i + 2], rig.w0[i]], 4 * i);
      B.set([cov[6 * i], cov[6 * i + 1], cov[6 * i + 2], cov[6 * i + 3]], 4 * i);
      C.set([cov[6 * i + 4], cov[6 * i + 5], rig.bone0[i], rig.bone1[i] | (rig.flag[i] << 4)], 4 * i);
    }
    D.set(rgba);
    tex(0, A, gl.RGBA32F, gl.RGBA, gl.FLOAT);
    tex(1, B, gl.RGBA32F, gl.RGBA, gl.FLOAT);
    tex(2, C, gl.RGBA32F, gl.RGBA, gl.FLOAT);
    tex(3, D, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    gl.uniform1i(U('uA'), 0); gl.uniform1i(U('uB'), 1); gl.uniform1i(U('uC'), 2); gl.uniform1i(U('uD'), 3);
  }

  // ---- geometry: one quad, instanced per splat in sorted order ----
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-2, -2, 2, -2, -2, 2, 2, 2]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const indexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, indexBuf);
  gl.bufferData(gl.ARRAY_BUFFER, n * 4, gl.DYNAMIC_DRAW);
  const aIndex = gl.getAttribLocation(prog, 'aIndex');
  gl.enableVertexAttribArray(aIndex); gl.vertexAttribIPointer(aIndex, 1, gl.UNSIGNED_INT, 0, 0); gl.vertexAttribDivisor(aIndex, 1);

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.ONE_MINUS_DST_ALPHA, gl.ONE, gl.ONE_MINUS_DST_ALPHA, gl.ONE);   // front-to-back

  gl.uniform4fv(U('uEyeL'), [RIG.eyeL.c[0], RIG.eyeL.c[1], RIG.eyeL.r[0], RIG.eyeL.r[1]]);
  gl.uniform4fv(U('uEyeR'), [RIG.eyeR.c[0], RIG.eyeR.c[1], RIG.eyeR.r[0], RIG.eyeR.r[1]]);
  // sampled splat colors read darker than the stacked fur on screen, so lift them
  gl.uniform3fv(U('uLidColor'), lidColor.map(v => Math.min(1, v * 1.6)));

  // ---- camera (OpenCV-style: x right, y down, z forward) ----
  const cam = { yaw: 0, pitch: 0, dist: 1.7, target: [0, 0.02, 0], fov: 35 * Math.PI / 180, ...camOpts };
  function cameraMatrices(w, h) {
    const { yaw, pitch, dist, target } = cam;
    const e = [target[0] + dist * Math.sin(yaw) * Math.cos(pitch), target[1] + dist * Math.sin(pitch), target[2] + dist * Math.cos(yaw) * Math.cos(pitch)];
    const f = norm(sub(target, e)), x = norm(cross(f, [0, 1, 0])), y = cross(f, x);
    const view = new Float32Array([x[0], y[0], f[0], 0, x[1], y[1], f[1], 0, x[2], y[2], f[2], 0, -dot(x, e), -dot(y, e), -dot(f, e), 1]);
    const fy = h / (2 * Math.tan(cam.fov / 2)), fx = fy, zn = 0.05, zf = 50;
    // centerY moves the view's center up or down the canvas (NDC units), for a canvas taller than the view
    const proj = new Float32Array([2 * fx / w, 0, 0, 0, 0, -2 * fy / h, 0, 0, 0, cam.centerY || 0, zf / (zf - zn), 1, 0, 0, -(zf * zn) / (zf - zn), 0]);
    return { view, proj, fx, fy };
  }

  // ---- depth sort: front to back, 16-bit counting sort on skinned depth ----
  const depth = new Float32Array(n), order = new Uint32Array(n), counts = new Uint32Array(65536), depthKey = new Uint16Array(n);
  function sortSplats(view, bones) {
    const rows = [];   // depth of a bone-transformed point = (row 2 of view) * M_b * p
    for (let b = 0; b < 5; b++) {
      const m = bones.subarray(16 * b, 16 * b + 16), r = [0, 0, 0, 0];
      for (let c = 0; c < 4; c++) r[c] = view[2] * m[c * 4] + view[6] * m[c * 4 + 1] + view[10] * m[c * 4 + 2] + view[14] * m[c * 4 + 3];
      rows.push(r);
    }
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
      const r0 = rows[rig.bone0[i]], r1 = rows[rig.bone1[i]], w = rig.w0[i];
      const d = w * (r0[0] * x + r0[1] * y + r0[2] * z + r0[3]) + (1 - w) * (r1[0] * x + r1[1] * y + r1[2] * z + r1[3]);
      depth[i] = d; if (d < lo) lo = d; if (d > hi) hi = d;
    }
    const scale = 65535 / Math.max(hi - lo, 1e-6);
    counts.fill(0);
    for (let i = 0; i < n; i++) { const k = ((depth[i] - lo) * scale) | 0; depthKey[i] = k; counts[k]++; }
    for (let k = 1; k < 65536; k++) counts[k] += counts[k - 1];
    for (let i = n - 1; i >= 0; i--) order[--counts[depthKey[i]]] = i;
  }

  const anim = new Animator();
  const settings = { fluff, fuzz, tint, lift };
  let clock = 0;

  function render(dt) {
    clock += dt;
    const w = canvas.width, h = canvas.height;
    gl.viewport(0, 0, w, h);
    const { bones, lid } = anim.update(clock, dt);
    const m = cameraMatrices(w, h);
    gl.uniformMatrix4fv(U('uProj'), false, m.proj);
    gl.uniformMatrix4fv(U('uView'), false, m.view);
    gl.uniform2f(U('uFocal'), m.fx, m.fy);
    gl.uniform2f(U('uViewport'), w, h);
    gl.uniformMatrix4fv(U('uBones'), false, bones);
    gl.uniform2fv(U('uLid'), lid);
    gl.uniform1f(U('uFluff'), settings.fluff);
    gl.uniform1f(U('uFuzz'), settings.fuzz);
    gl.uniform3fv(U('uTint'), settings.tint);
    gl.uniform1f(U('uLift'), settings.lift);
    sortSplats(m.view, bones);
    gl.bindBuffer(gl.ARRAY_BUFFER, indexBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, order);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
  }

  return { canvas, anim, cam, settings, render, splatCount: n, get clock() { return clock; } };
}
