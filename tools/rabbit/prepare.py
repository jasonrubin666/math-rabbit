"""TRELLIS Gaussian .ply -> cleaned web/rabbit.splat (32 B/splat: pos f32x3, scale f32x3, rgba u8x4, quat u8x4).

Cleanup: drops near-transparent splats and the two stray "tails" TRELLIS invented
(one on the back of the neck, one at the bottom of the sweater).
Usage: python prepare.py source/rabbit_brown.ply web/rabbit.splat
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from splatlib import load_ply

d = load_ply(sys.argv[1])
p = d['xyz']
keep = d['opacity'] > 0.02
neck_tail = (np.abs(p[:, 0]) < 0.045) & (p[:, 1] > -0.14) & (p[:, 1] < -0.075) & (p[:, 2] < -0.118)
bottom_tail = (np.abs(p[:, 0]) < 0.065) & (p[:, 1] < -0.38) & (p[:, 2] < -0.128)
keep &= ~neck_tail & ~bottom_tail
print(f'kept {keep.sum()} of {len(p)} (neck tail {neck_tail.sum()}, bottom tail {bottom_tail.sum()})')

n = int(keep.sum())
rec = np.zeros(n, dtype=[('pos', '<f4', 3), ('scale', '<f4', 3), ('rgba', 'u1', 4), ('quat', 'u1', 4)])
rec['pos'] = p[keep]
rec['scale'] = d['scale'][keep]
rgba = np.concatenate([d['rgb'][keep], d['opacity'][keep, None]], 1)
rec['rgba'] = np.round(rgba * 255).clip(0, 255)
rec['quat'] = np.round(d['quat'][keep] * 128 + 128).clip(0, 255)
rec.tofile(sys.argv[2])
print('wrote', sys.argv[2], os.path.getsize(sys.argv[2]), 'bytes')
