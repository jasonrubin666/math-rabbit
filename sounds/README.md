# Math Rabbit sounds

**61 voice lines to record** (plus 2 short "Go" clips that may be voice; listen to them), 18 effects and music that can be swapped the same way, and 6 lines the game asks for that were never recorded.

## Files

- `originals/voice|effects|music/<name>.<ext>`: every sound the game plays, named exactly as the game asks for it.
- `replace/`: put a recording here with the **same name** (`replace/Wrong3.m4a` replaces `Wrong3`). Any of `.wav`, `.mp3`, `.m4a`, `.ogg`; when one name has several files, `.wav` wins, then `.m4a`, `.mp3`, `.ogg`. Subfolders are ignored, so takes you're not using yet can sit in `replace/takes/`.
- Names are case-sensitive and keep their spaces (`Good You Are On Role.m4a`).

The rewrite (`npm run dev`) picks up `replace/` on reload. To hear new lines in the Scratch build:

```bash
python3 tools/art/apply.py MadDad.sb3 art MathRabbit.sb3
python3 tools/sounds/apply.py MathRabbit.sb3 sounds MathRabbit.sb3
node tools/build.js MathRabbit.sb3 docs
```

Lengths don't have to match: the game waits a fixed time after each line, not for it to finish.

Same recording under several names today (one take can be copied to each): `Correct4` = `Good Fantastic`; `Gunshot1` = `Gunshot2`.

## Voice

| Name | Length | When it plays |
|---|---|---|
| `MadDad` | 2.6s | Title screen, with the music |
| `Family1` | 1.3s | Tapping a title card (one of 5 at random) |
| `Family2` | 1.8s | Tapping a title card |
| `Family3` | 2.0s | Tapping a title card |
| `Family4` | 5.7s | Tapping a title card |
| `Family5` | 4.2s | Tapping a title card |
| `SettingsOperatorAddition` | 0.8s | Settings: mode changed to Simple or 2-digit Addition |
| `SettingsOperatorSubtraction` | 1.1s | Settings: mode changed to Simple or 2-digit Subtraction |
| `SettingsOperatorMultiplication` | 1.5s | Settings: mode changed to Multiplication |
| `SettingsOperatorDivision` | 0.9s | Settings: mode changed to Division |
| `SettingsOperatorClock` | 0.8s | Settings: mode changed to Clock |
| `Start1` | 1.5s | Game start (one of 4 at random), before the shuffle |
| `Start2` | 1.0s | Game start |
| `Start3` | 1.0s | Game start |
| `Start4` | 1.9s | Game start |
| `Go0` | 1.7s | Cards dealt onto the desk, just before "Go"; may be a voice or an effect, listen to it |
| `Go1` | 1.3s | "Go" at game start, before the starter pistol; may be a voice or an effect, listen to it |
| `WhatTime1` | 2.1s | Clock mode: each new clock question |
| `Correct1` | 1.1s | Right answer, about half the time (one of 5 at random) |
| `Correct2` | 1.2s | Right answer |
| `Correct3` | 0.9s | Right answer |
| `Correct4` | 1.1s | Right answer (same recording as "Good Fantastic") |
| `Correct5` | 1.0s | Right answer |
| `Good Three In A Row` | 1.3s | Streak of 3 |
| `Good You Are On Role` | 1.5s | Streak of 10 |
| `Good Fantastic` | 1.1s | Streak of 20 |
| `Card30` | 1.5s | Right answer with 30 cards left (card modes) |
| `Card20` | 1.8s | Right answer with 20 cards left |
| `Card10` | 2.0s | Right answer with 10 cards left |
| `Card1` | 1.7s | Right answer with 1 card left |
| `Clock30` | 1.1s | Right answer with 30 clocks left (clock mode) |
| `Clock20` | 1.5s | Right answer with 20 clocks left |
| `Clock10` | 1.6s | Right answer with 10 clocks left |
| `Clock5` | 1.4s | Right answer with 5 clocks left |
| `Clock1` | 2.6s | Right answer with 1 clock left |
| `Wrong1` | 0.9s | Wrong answer with time left, about 1 in 3 (one of 6 at random) |
| `Wrong2` | 0.6s | Wrong answer |
| `Wrong3` | 0.9s | Wrong answer |
| `Wrong4` | 1.1s | Wrong answer |
| `Wrong5` | 0.9s | Wrong answer |
| `Wrong6` | 1.2s | Wrong answer |
| `Slow1` | 1.2s | Ran out of time, about half the time (one of 8 at random) |
| `Slow2` | 1.1s | Ran out of time |
| `Slow3` | 1.3s | Ran out of time |
| `Slow4` | 1.1s | Ran out of time |
| `Slow5` | 1.4s | Ran out of time |
| `Slow6` | 2.0s | Ran out of time |
| `Slow7` | 1.3s | Ran out of time |
| `Slow8` | 1.2s | Ran out of time |
| `Clock3Wrong1` | 2.7s | Clock mode: wrong answer (one of 5 at random) |
| `Clock3Wrong2` | 2.2s | Clock mode: wrong answer; also every wrong answer in Pad mode |
| `Clock3Wrong3` | 1.7s | Clock mode: wrong answer |
| `Clock3Wrong4` | 2.7s | Clock mode: wrong answer |
| `Clock3Wrong5` | 1.3s | Clock mode: wrong answer |
| `GameOver1` | 2.7s | Report card appears (one of 3 at random) |
| `GameOver2` | 2.5s | Report card appears |
| `GameOver3` | 3.4s | Report card appears |
| `100-1` | 2.6s | Perfect score, after the report card (one of 6 at random) |
| `100-2` | 2.3s | Perfect score |
| `100-3` | 1.4s | Perfect score |
| `100-4` | 1.1s | Perfect score |
| `100-5` | 1.5s | Perfect score |
| `100-6` | 1.7s | Perfect score |

## Never recorded

The game asks for these but they don't exist, so it stays quiet there. Drop a file with this name into `replace/` to add it.

| Name | When it would play |
|---|---|
| `Card5` | Right answer with 5 cards left (card modes) |
| `Pad30` | Pad mode: 30 left (Pad mode has no countdown voice at all) |
| `Pad20` | Pad mode: 20 left |
| `Pad10` | Pad mode: 10 left |
| `Pad5` | Pad mode: 5 left |
| `Pad1` | Pad mode: 1 left |

## Effects

| Name | Length | When it plays |
|---|---|---|
| `Shuffle` | 0.8s | Game start: card shuffle |
| `CardHitsTable1` | 0.2s | Each card dealt onto the desk (one of 3 at random) |
| `CardHitsTable2` | 0.2s | Each card dealt onto the desk |
| `CardHitsTable3` | 0.1s | Each card dealt onto the desk |
| `Gunshot1` | 0.7s | Starter pistol after "Go" (one of 4 at random) |
| `Gunshot2` | 0.7s | Starter pistol |
| `Gunshot3` | 0.8s | Starter pistol |
| `Gunshot4` | 0.7s | Starter pistol |
| `Calculator` | 1.0s | Calculator slides in |
| `CalcButton` | 0.4s | Calculator key pressed |
| `Pop` | 0.0s | Digit typed or deleted |
| `Enter` | 0.9s | Answer entered |
| `Correct` | 0.9s | Right-answer chime (before any voice line) |
| `Wrong` | 0.6s | Wrong-answer buzzer |
| `Timer` | 23.6s | Each question: timer start |
| `TicTok` | 38.5s | Each question: tick-tock loop |
| `3SecondBleep` | 0.4s | Each of the last 3 seconds |

## Music

| Name | Length | When it plays |
|---|---|---|
| `music_zapsplat_game_music_action_agressive_pounding_tense_electro_synth_028` | 125.0s | Title screen and report card |

## Regenerating

```bash
python3 tools/sounds/extract.py MadDad.sb3 sounds
```

Rewrites `originals/` and this README; `replace/` is left alone. The list of sounds and when they play is in `tools/sounds/extract.py`.
