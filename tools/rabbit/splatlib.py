"""Shared helpers: load a TRELLIS Gaussian .ply into y-up, z-forward numpy arrays."""
import numpy as np

SH_C0 = 0.28209479177387814


def load_ply(path):
    raw = open(path, 'rb').read()
    head_end = raw.index(b'end_header\n') + len(b'end_header\n')
    props = [l.split()[-1].decode() for l in raw[:head_end].split(b'\n') if l.startswith(b'property')]
    a = np.frombuffer(raw[head_end:], dtype='<f4').reshape(-1, len(props))
    col = {p: a[:, i] for i, p in enumerate(props)}
    # TRELLIS exports y-down / z-back relative to our viewer: rotate 180 deg about X.
    xyz = np.stack([col['x'], -col['y'], -col['z']], 1).astype(np.float32)
    quat = np.stack([col['rot_0'], col['rot_1'], col['rot_2'], col['rot_3']], 1)
    quat /= np.linalg.norm(quat, axis=1, keepdims=True)
    # Same 180-deg X rotation applied to orientation: q' = (0,1,0,0) * q  (w,x,y,z)
    w, x, y, z = quat.T
    quat = np.stack([-x, w, -z, y], 1).astype(np.float32)
    scale = np.exp(np.stack([col['scale_0'], col['scale_1'], col['scale_2']], 1)).astype(np.float32)
    rgb = np.clip(0.5 + SH_C0 * np.stack([col['f_dc_0'], col['f_dc_1'], col['f_dc_2']], 1), 0, 1).astype(np.float32)
    opacity = (1 / (1 + np.exp(-col['opacity']))).astype(np.float32)
    return dict(xyz=xyz, quat=quat, scale=scale, rgb=rgb, opacity=opacity)


def project(d, mask=None, axes=(0, 1), depth_axis=2, size=600, lo=None, hi=None, front_is_max=True):
    """Cheap orthographic point render (nearest splat wins) for inspecting geometry."""
    from PIL import Image
    xyz, rgb = d['xyz'], d['rgb']
    keep = d['opacity'] > 0.3
    if mask is not None:
        keep &= mask
    p, c = xyz[keep], rgb[keep]
    lo = np.array(lo if lo is not None else xyz.min(0)); hi = np.array(hi if hi is not None else xyz.max(0))
    span = (hi - lo)[list(axes)].max()
    u = ((p[:, axes[0]] - lo[axes[0]]) / span * (size - 1)).astype(int)
    v = ((hi[axes[1]] - p[:, axes[1]]) / span * (size - 1)).astype(int)
    order = np.argsort(p[:, depth_axis] if front_is_max else -p[:, depth_axis])
    img = np.full((size, size, 3), 200, np.uint8)
    ok = (u >= 0) & (u < size) & (v >= 0) & (v < size)
    for i in order[ok[order]]:
        img[v[i], u[i]] = (c[i] * 255).astype(np.uint8)
    return Image.fromarray(img)
