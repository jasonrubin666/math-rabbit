import '@fontsource/noto-sans/500.css';
import '@fontsource/knewave/400.css';
import './style.css';
import { STAGE_W } from './ui/stage';
import { createHost } from './rabbit/host';
import { unlock } from './audio';
import { loadSettings } from './settings';
import { titleScreen } from './screens/title';
import { cardsScreen, type GameResult } from './screens/cards';
import { reportScreen } from './screens/report';

type Screen = { update(t: number): void; destroy(): void };

const stage = document.getElementById('stage')!;
// stage pixels per stage unit, for poses (see ui/pose.ts)
const setStageUnit = () => stage.style.setProperty('--u', `${stage.clientWidth / STAGE_W}px`);
new ResizeObserver(setStageUnit).observe(stage);
setStageUnit();

const host = await createHost();
const settings = loadSettings();
let screen: Screen | null = null;

function show(next: () => Screen) {
  screen?.destroy();
  screen = next();
}
const toTitle = () => show(() => titleScreen(stage, host, settings, () => show(() => cardsScreen(stage, settings, toReport))));
const toReport = (r: GameResult) => show(() => reportScreen(stage, host, r, toTitle));

// fetch the text fonts now, so numbers and labels never show in a fallback font mid-game
void Promise.all(['500 16px "Noto Sans"', '16px Knewave'].map(f => document.fonts.load(f, '0123456789%+-∞ABCabc!')));

// iPad Safari only plays sound after a tap, so the game starts from one (Mad Dad's green flag)
const tapToStart = document.getElementById('tap-to-start')!;
tapToStart.addEventListener('pointerdown', () => {
  unlock();
  tapToStart.remove();
  toTitle();
}, { once: true });
document.addEventListener('pointerdown', unlock);

let last = performance.now(), t = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now; t += dt;
  screen?.update(t);
  if (host.el.isConnected) host.render(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// debugging and testing hooks
Object.assign(window, { mathRabbit: { host, settings, get screen() { return screen; } } });
