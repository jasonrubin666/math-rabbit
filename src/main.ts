import './style.css';
import { STAGE_W } from './ui/stage';
import { setStageUnit } from './ui/pose';
import { createHost } from './rabbit/host';
import { titleScreen } from './screens/title';

const stage = document.getElementById('stage')!;
new ResizeObserver(() => setStageUnit(stage.clientWidth / STAGE_W)).observe(stage);
setStageUnit(stage.clientWidth / STAGE_W);

const host = await createHost();
const screen = titleScreen(stage, host);

let last = performance.now(), t = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now; t += dt;
  screen.update(t);
  host.render(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
