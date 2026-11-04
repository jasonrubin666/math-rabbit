"""TRELLIS Gaussian .ply -> cleaned web/rabbit.splat (32 B/splat: pos f32x3, scale f32x3, rgba u8x4, quat u8x4).

Cleanup: drops near-transparent splats. (The first rabbit, rabbit_brown.ply in git history, also needed
two stray "tails" TRELLIS invented cut away; the current one has only its real cotton tail, on its back.)
A new rabbit also needs its landmarks re-measured in src/rabbit/rig.js (RIG).
Usage: python tools/rabbit/prepare.py rabbit-source/rabbit.ply src/rabbit/rabbit.splat
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from splatlib import load_ply

d = load_ply(sys.argv[1])
p = d['xyz']
keep = d['opacity'] > 0.02
print(f'kept {keep.sum()} of {len(p)}')

n = int(keep.sum())
rec = np.zeros(n, dtype=[('pos', '<f4', 3), ('scale', '<f4', 3), ('rgba', 'u1', 4), ('quat', 'u1', 4)])
rec['pos'] = p[keep]
rec['scale'] = d['scale'][keep]
rgba = np.concatenate([d['rgb'][keep], d['opacity'][keep, None]], 1)
rec['rgba'] = np.round(rgba * 255).clip(0, 255)
rec['quat'] = np.round(d['quat'][keep] * 128 + 128).clip(0, 255)
rec.tofile(sys.argv[2])
print('wrote', sys.argv[2], os.path.getsize(sys.argv[2]), 'bytes')
