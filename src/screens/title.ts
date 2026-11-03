// Title screen: chalkboard lab, the rabbit at his desk, the logo. (SPEC.md §1 "Title")
// Motion follows Mad Dad's title loop, driven by continuous time instead of 30 steps/sec.
// `spin` is Mad Dad's CardSpinner: +1 per Scratch frame, i.e. 30 (degrees) per second.
import { sprite } from '../ui/stage';
import { applyPose } from '../ui/pose';
import type { Host } from '../rabbit/host';

const sin = (deg: number) => Math.sin((deg * Math.PI) / 180);
const cos = (deg: number) => Math.cos((deg * Math.PI) / 180);

export function titleScreen(stage: HTMLElement, host: Host) {
  const backdrop = sprite('Stage/2');
  const lab = sprite('TitleScreenSprite5/1');
  const logo = sprite('Logo/1');
  stage.append(backdrop, lab, host.el, logo);

  return {
    update(t: number) {
      const spin = 30 * t;
      // whole scene: zoom 100–101.5%, gentle bob, tilt ±¾° (calmed from Mad Dad)
      const sceneSize = 100.75 + 0.75 * sin(spin);
      const sceneY = -10 * sin(spin);
      const sceneDir = 90 + 0.75 * sin(spin / 2);
      applyPose(lab, { y: sceneY, size: sceneSize, direction: sceneDir });
      applyPose(host.el, {
        y: sceneY + 0.8 + 0.8 * sin(spin),
        size: sceneSize + 1.5 * (2.5 + 2.5 * sin(spin)),
        direction: sceneDir,
      });
      applyPose(logo, {
        y: 150 + 20 * sin(spin),
        size: 70 + 12 * sin(spin) + (sin(spin) + 1) * cos(10 * spin),
        direction: 90 + 6 * cos(spin),
      });
    },
    destroy() { backdrop.remove(); lab.remove(); logo.remove(); host.el.remove(); },
  };
}
