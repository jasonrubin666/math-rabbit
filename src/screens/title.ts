// Title screen (SPEC.md §1 "Title", "Settings sheet"). Motion follows Mad Dad's title loop on
// continuous time: `spin` is Mad Dad's CardSpinner, +1 per Scratch frame = 30 (degrees) per second.
import { Sprite } from '../ui/sprite';
import { applyPose } from '../ui/pose';
import { Scope, FPS, rand, randInt, sinD, cosD } from '../ui/time';
import { play, pick, stopAll } from '../audio';
import { kindOf, type Mode } from '../game/modes';
import { CARD_OPTIONS, PLAYABLE_MODES, TIMER_OPTIONS, saveSettings, step, type Settings } from '../settings';
import type { Host } from '../rabbit/host';

const MODE_VOICE: Record<string, string> = {
  Multiplication: 'SettingsOperatorMultiplication', Division: 'SettingsOperatorDivision',
  SimpleAddition: 'SettingsOperatorAddition', '2DigitAddition': 'SettingsOperatorAddition', '4DigitAddition': 'SettingsOperatorAddition',
  SimpleSubtraction: 'SettingsOperatorSubtraction', '2DigitSubtraction': 'SettingsOperatorSubtraction', '4DigitSubtraction': 'SettingsOperatorSubtraction',
};
const modeVoice = (m: Mode) => (kindOf(m) === 'clock' ? 'SettingsOperatorClock' : MODE_VOICE[m]);
const timerCostume = (s: number) => (Number.isFinite(s) ? String(s) : '999');

type TitleCard = { sprite: Sprite; x: number; y: number; size: number; spin: number; dir: number; gone: boolean };

export function titleScreen(stage: HTMLElement, host: Host, settings: Settings, onStart: (s: Settings) => void) {
  const scope = new Scope();
  const backdrop = new Sprite('Stage', 'TitleScreen', 0).addTo(stage);
  const lab = new Sprite('TitleScreenSprite5', 1, 1).addTo(stage);
  stage.append(host.el);
  host.el.style.zIndex = '2';
  host.setEffects({});
  const logo = new Sprite('Logo', 1, 60).addTo(stage);
  const start = new Sprite('StartButton', 1, 59).addTo(stage).show(false);

  // floating cards: 5 on the left (any of 10 designs), 5 on the right (2 designs)
  const cards: TitleCard[] = [];
  for (const [n, designs, x0, x1] of [[5, 10, -300, -50], [5, 2, 50, 300]] as const) {
    for (let i = 0; i < n; i++) {
      const card: TitleCard = {
        sprite: new Sprite('TitleCard', randInt(1, designs), 56).addTo(stage),
        x: randInt(x0, x1), y: randInt(-150, 125), size: randInt(20, 30), spin: randInt(-5, 5), dir: randInt(0, 360), gone: false,
      };
      card.sprite.onTap(() => scope.run(() => familyClip(card)));
      cards.push(card);
    }
  }

  // settings sheet with its labels and arrows (shown only while the sheet is out)
  const sheet = new Sprite('SettingsSheet', 1, 70).addTo(stage).show(false);
  const modeLabel = new Sprite('Mode', settings.mode, 75);
  const cardsLabel = new Sprite('Cards', String(settings.cards), 75);
  const timerLabel = new Sprite('Timer', timerCostume(settings.seconds), 75);
  const arrows = ([
    ['ModeDown', -210, -9, () => changeMode(-1)], ['ModeUp', 10, -9, () => changeMode(1)],
    ['CardsDown', -210, -99, () => changeCards(-1)], ['CardsUp', -120, -99, () => changeCards(1)],
    ['TimerDown', -83, -99, () => changeTimer(-1)], ['TimerUp', 10, -99, () => changeTimer(1)],
  ] as const).map(([name, x, y, action]) => {
    const a = new Sprite(name, 1, 76).setPose({ x, y });
    a.onTap(() => scope.run(async () => {
      a.setPose({ size: 110 });
      action();
      await scope.wait(0.1);
      a.setPose({ size: 100 });
    }));
    return a;
  });
  modeLabel.setPose({ x: -98, y: -10 });
  cardsLabel.setPose({ x: -165, y: -102 });
  timerLabel.setPose({ x: -35, y: -102 });
  const sheetParts = [modeLabel, cardsLabel, timerLabel, ...arrows];
  for (const p of sheetParts) p.addTo(stage).show(false);

  let sheetOut = false, ready = false, starting = false;
  const setSheet = (out: boolean) => {
    sheetOut = out;
    sheet.setPose({ x: out ? -100 : -367, y: -63, size: 97.9 });
    for (const p of sheetParts) p.show(out);
    start.show(ready && !out);
  };
  sheet.onTap(() => setSheet(!sheetOut));

  function changeMode(by: 1 | -1) {
    settings.mode = step(PLAYABLE_MODES, settings.mode, by);
    modeLabel.setCostume(settings.mode);
    saveSettings(settings);
    stopAll();
    void play(modeVoice(settings.mode));
  }
  function changeCards(by: 1 | -1) {
    settings.cards = step(CARD_OPTIONS, settings.cards as (typeof CARD_OPTIONS)[number], by);
    cardsLabel.setCostume(String(settings.cards));
    saveSettings(settings);
  }
  function changeTimer(by: 1 | -1) {
    settings.seconds = step(TIMER_OPTIONS, settings.seconds as (typeof TIMER_OPTIONS)[number], by);
    timerLabel.setCostume(timerCostume(settings.seconds));
    saveSettings(settings);
  }

  async function familyClip(card: TitleCard) {
    if (card.gone || starting) return;
    card.gone = true;
    void play(pick('Family', 1, 5));
    const base = card.sprite.getPose().size;
    await scope.tween(5 / FPS, p => card.sprite.setPose({ size: base + 100 * p }).setEffects({ ghost: 100 * p }));
    card.sprite.show(false);
  }

  start.onTap(() => {
    if (starting || sheetOut) return;
    starting = true;
    scope.run(async () => {
      // logo floats up and fades, the rabbit shrinks and darkens, the cards vanish (5 Scratch frames)
      const l = logo.getPose();
      for (const c of cards) c.sprite.show(false);
      start.show(false);
      sheet.show(false);
      await scope.tween(5 / FPS, p => {
        logo.setPose({ y: l.y + 150 * p, size: l.size + 100 * p }).setEffects({ ghost: 100 * p });
        hostShrink = 25 * p;
        host.setEffects({ brightness: -100 * p });
      });
      onStart(settings);
    });
  });

  // timeline: intro voice after 0.5 s, start button and settings tab after 3 s
  scope.run(async () => {
    await scope.wait(0.5);
    void play('MadDad');
    void play('music_zapsplat_game_music_action_agressive_pounding_tense_electro_synth_028');
    await scope.wait(2.5);
    ready = true;
    sheet.show(true);
    setSheet(false);
    await scope.tween(0.05, p => start.setPose({ x: 150, y: -200 + 55 * p, size: 80 }));
  });

  let hostSize = 100, hostShrink = 0, flicker = 0;

  return {
    update(t: number) {
      const spin = 30 * t;
      // whole scene: zoom 100–101.5%, gentle bob, tilt ±¾° (calmed from Mad Dad)
      const sceneSize = 100.75 + 0.75 * sinD(spin);
      const sceneY = -10 * sinD(spin);
      const sceneDir = 90 + 0.75 * sinD(spin / 2);
      lab.setPose({ y: sceneY, size: sceneSize, direction: sceneDir });
      hostSize = sceneSize + 1.5 * (2.5 + 2.5 * sinD(spin));
      host.setPose('title', { y: sceneY + 0.8 + 0.8 * sinD(spin), size: hostSize - hostShrink, direction: sceneDir });
      if (!starting) {
        logo.setPose({
          y: 150 + 20 * sinD(spin),
          size: 70 + 12 * sinD(spin) + (sinD(spin) + 1) * cosD(10 * spin),
          direction: 90 + 6 * cosD(spin),
        });
      }
      // floating cards breathe out from the center and bob as they spin (Mad Dad's original spread)
      for (const c of cards) {
        if (c.gone) continue;
        const dir = c.dir + c.spin * FPS * t;
        const x = c.x + (c.x / 10) * 3 * sinD(spin);
        c.sprite.setPose({ x, y: c.y + 10 * sinD(dir), size: c.size + 4 * (5 + 3 * sinD(spin)), direction: dir });
        c.sprite.setEffects({ ghost: Math.abs(x) > 220 ? (Math.abs(x) - 220) * 5 : 0 });
      }
      // the start button shimmers a little, 30 times a second
      if (Math.floor(t * FPS) !== flicker) {
        flicker = Math.floor(t * FPS);
        start.setEffects({ color: rand(-3, 3), brightness: rand(0, 10) });
      }
    },
    destroy() {
      scope.cancel();
      for (const s of [backdrop, lab, logo, start, sheet, ...sheetParts, ...cards.map(c => c.sprite)]) s.remove();
      host.el.remove();
      applyPose(host.el, {});
    },
  };
}
