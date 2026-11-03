# Math Rabbit: gameplay spec

What the game does, taken from the Mad Dad Math Lab Scratch project (`MadDad.sb3`). This is the checklist for the rewrite: reach parity first (with new art), then add the rabbit host features and voice.

Mark items **keep / change / drop** as we go. Notes in *italics* are observations, not decisions.

---

## 1. Screens and flow

```
Title ──Start──▶ Play (Cards | Clock | Pad) ──last question──▶ Report card ──tap──▶ Title
  └─ Settings sheet (slides out from the left edge)
```

### Title
- The host sits behind the desk on the chalkboard backdrop. Logo at the top.
- After the green flag the host "talks" for about 1.8 s (intro voice clip).
- About 10 small playing cards float and spin around the screen; cards near the edge fade out.
- **Easter egg:** tapping a floating card plays one of 5 family voice clips (`Family1-5`). The host's mouth moves for the clip's length and the card grows and fades away.
- The whole scene bobs, zooms and tilts gently on a slow sine wave (already calmed in Math Rabbit: zoom 100–109%, tilt ±¾°).
- The **Start** button slides up from the bottom-right 3 s after load and flickers slightly.
- The **Settings** tab peeks in from the left edge 3 s after load. Tapping it slides the sheet out; tapping again tucks it away. The start button hides while settings are open.
- Pressing Start: the logo floats up and fades, the host shrinks and darkens, and the title cards vanish.

### Settings sheet
Three rows, each with ◀ ▶ arrows that wrap around:

| Setting | Options | Default |
|---|---|---|
| Mode | Multiplication, Simple Addition, 2-Digit Addition, Simple Subtraction, 2-Digit Subtraction, Division, Clock (Minutes), Clock (Hours), Clock (Hard), 4-Digit Addition, 4-Digit Subtraction | Multiplication |
| Cards (questions per game) | 5, 10, 25, 50, 100 | 5 |
| Timer (seconds per question) | 3, 5, 10, 15, 20, 30, 60, ∞ | 20 |

Changing mode plays a voice clip naming the operation (addition / subtraction / multiplication / division / clock).

### Report card (game over)
- The game-over backdrop matches the mode (card desk / clock / pad), with the host at a desk on the left.
- Voice: one of 3 game-over clips, plus game-over music. The host's mouth moves for 2.5 s.
- A paper "report card" fades in from dark: **Your Score** (3 digits) and **Percentage Correct**.
- **Percentage** = questions ÷ attempts × 100 (attempts include wrong answers and time-outs).
- **100%:** confetti rains continuously, the report card cycles colors, and after 5 s a special "100%" voice clip plays (6 variants).
- After 4 s the paper starts blinking between two versions (a "tap me" hint). Tapping the report card goes back to the title.

---

## 2. Answer entry (all modes)

- On-screen calculator keypad: **0–9**, **Delete**, **Enter (✓)**. Each key hides briefly when pressed, and the keys flicker slightly (a "buzzing calculator" effect).
- Keyboard: `0–9`, `Space` = Enter, `←` = Delete.
- Input is ignored while an animation plays (between cards, during feedback).
- Every key press plays a click sound; Enter plays its own sound; Delete plays a pop.

---

## 3. Card modes (the six arithmetic modes)

### Problem generation (per card)
| Mode | Top | Bottom | Answer |
|---|---|---|---|
| Multiplication | 1–11 | 1–11 | top × bottom (1–121) |
| Simple Addition | 1–12 | 1–12 | top + bottom |
| 2-Digit Addition | 10–99 | 1–9 | top + bottom |
| Simple Subtraction | bottom + (1–10) | 1–9 | 1–10, never negative |
| 2-Digit Subtraction | 10–99 | 1–9 | top − bottom |
| Division | bottom × (1–10) | 1–9 | 1–10, always whole |

All ranges are inclusive and uniformly random. The whole deck is generated when the game starts.

### Deck behavior
- The deck holds N cards (the Cards setting). Cards are dealt face-down onto the desk one by one, each landing with a slight random offset and tilt and a "card hits table" sound.
- The top card flips face-up with a zoom, then floats gently (bobs and tilts) while it waits.
- **Correct:** the card glows, spins and flies off to the right, and is removed from the deck.
- **Wrong or time-out:** the card slides away and goes back into the deck (it will come up again). The next card flips.
- **The game ends when every card has been answered correctly.** Wrong answers make the game longer; they never end it.

### Entry rules
- Up to 3 digits, entered calculator-style: each digit pushes the previous ones left. A 4th digit clears the entry (with a pop).
- The answer is compared as a number.

---

## 4. Clock modes (Clock Minutes / Hours / Hard)

The three modes are identical except for the clock face:

| Mode | Face |
|---|---|
| Clock (Minutes) | hour numerals **and** small minute labels (5, 10, 15, …) — easiest |
| Clock (Hours) | hour numerals only |
| Clock (Hard) | tick marks only |

- Each question picks a random time: hour 1–12, minute 0–59.
- **Time-lapse animation:** the hour hand sweeps forward in 30° jumps to the new hour, while the minute and second hands flicker randomly and the face flashes colors. Then the minute hand snaps to the minute. The second hand ticks once per second the whole time.
- Opening voice: "What time is it?"
- **Entry:** up to 4 digits as H:MM or HH:MM (calculator-style shifting).
- **Correct when** the hour matches exactly **and** the minutes are within **±1** of the true minute.
- **Wrong:** the face briefly flashes the minute-label version as a hint, −5 points, and the same time stays up for another try.
- **3 wrong in a row:** a special "let's try another" voice clip and a new time.
- The game ends after N correct answers (N = the Cards setting).

---

## 5. Pad modes (4-Digit Addition / Subtraction)

- A sheet of paper on the desk shows a column problem: two numbers stacked, with `+` (or `−`) and a line.
- **4-Digit Addition:** both numbers random 100–9999. The answer can have up to 5 digits.
- **Answer entry goes right to left, like on paper:** the first digit typed is the ones place, then tens, hundreds, and so on. Unfilled answer boxes shimmer.
- **Carry marks:** tapping a digit in the top number toggles a small "1" bubble above it, so the player can note a carry. This is just a scratch-pad aid; it isn't checked.
- **Correct:** the page brightens and flies off, a new problem appears, and there's a score popup.
- **Wrong:** a red ✗ page swipes across, −5 points, and the same problem stays. **3 wrong in a row:** a new problem and a special voice clip.
- The first page is an intro sheet that flies away when the timer starts.

### Bugs in the original (fix in the rewrite)
- **4-Digit Subtraction never worked.** The answer for subtraction is never computed, and Enter checks the *sum* of the two numbers. The bottom number is also drawn from 1 up to the *previous* bottom number, not a fixed range. Rewrite: top 1000–9999, bottom 1–top, answer = top − bottom.
- **Off by one:** pad games end on the (N+1)th correct answer, because the "cards left" check happens before the count goes down.

---

## 6. Timer

- Starts at the Timer setting when each question appears. Counts down in whole seconds.
- Tick-tock sound loop. A beep each second when 3 or fewer seconds are left.
- **At 0:** counts as a wrong answer (−5; the card goes back to the deck, or the clock/pad question stays).
- **∞ (999)** effectively means no timer.

---

## 7. Scoring

- **Correct:** `points = 5 + 5 × (time left ÷ full time) + round(streak ÷ 3)`. So 5–10 points for speed, plus a bonus that grows with the streak. With ∞ timer the speed part is always the full +5.
  - *The streak used is the one before this answer is counted (Scratch's broadcast order).*
- **Wrong or time-out:** −5. The score never goes below 0.
- **Streak:** +1 per correct answer, reset to 0 on a wrong one. (Clock and pad modes track negative streaks to detect "3 wrong in a row".)
- **Score popup** rises from the top of the screen: the points number for 5–9, **"HUGE"** for 10–12, **"WOW"** for 13+, **"−5"** for wrong.
- **Wrong flash:** the background flashes red briefly on a wrong answer.

---

## 8. Voice and sound cues

| Moment | Sound |
|---|---|
| Game start | one of 4 "start" voice clips, card shuffle, then "Go!" and a starter-pistol shot |
| Each question | timer start + tick-tock loop |
| Correct | correct chime, then usually a voice clip (see next row) |
| Correct voice | streak of 3 / 10 / 20: "three in a row" / "you're on a roll" / "fantastic". Questions left = 30 / 20 / 10 / 5 / 1: a countdown clip (separate sets for cards and clock). Otherwise a 50% chance of one of 5 "correct" clips. |
| Wrong | buzzer. After a time-out, 50% chance of one of 8 "too slow" clips; otherwise 30% chance of one of 6 "wrong" clips. |
| Clock: 3 wrong in a row | one of 5 "let's try another" clips |
| Game over | one of 3 game-over clips + music. 100%: one of 6 "perfect" clips after 5 s. |
| Settings | the operation name when the mode changes |

The current clips are Mad Dad's voice. *The rabbit will need its own voice: recorded clips, or TTS in stage 5.*

---

## 9. Host (rabbit) behavior at parity

- **Title:** sits behind the desk, idle animation (breathing, head sway, ear twitches, blinks). Talks during the intro clip and the family easter-egg clips.
- **Game over:** sits at the desk beside the report card. Talks during the game-over and 100% clips.
- **During play:** off screen (the original scientist only appears on the title and game-over screens).
- **Lip sync at parity:** the jaw opens and closes in rhythm while a voice clip plays. *Stage 4 can drive it from the audio's actual loudness instead.*

---

## 9b. Deliberate changes in the rewrite

Small fixes to things the original did by accident:

- **Empty Enter is ignored.** Mad Dad counted Enter with nothing typed as a wrong answer (−5).
- **Points are whole numbers.** Mad Dad's speed bonus produced fractions like 9.5, and its digit display then rounded each digit separately (sometimes wrongly).
- **Zeros show on the calculator score.** Mad Dad showed every 0 as a blank, so 20 read "2 ". Now only leading zeros are blank.
- **Input locks while a card leaves.** In the rewrite's first version a fast second tap could answer the same card twice; answers are now accepted only while a card is settled face up.
- **Floating title cards keep Mad Dad's original spread.** In the Scratch build, calming the title zoom also pulled them toward the center, because they read the same zoom value.

## 10. Art the rewrite needs (slots for the new art)

Each of these is a separate image today. The new art can replace them one at a time.

- **Backdrops:** title chalkboard lab, card desk, clock wall, pad desk, game-over versions of each, "win" backdrop
- **Host desk:** desk front (with or without legs underneath)
- **Logo** ("Math Rabbit")
- **Buttons:** Start, Settings tab, settings sheet, ◀ ▶ arrows
- **Settings labels:** 11 mode names, 5 card counts, 8 timer values
- **Cards:** card back, 6 face designs (one per arithmetic mode, showing the operator), correct-glow version, ~10 small title cards
- **Numbers:** card numerals (1–99), answer digits, score digits, percentage digits. *Could become a font instead of images.*
- **Calculator:** body (4 flicker frames), keys 0–9, Delete, Enter
- **Clock:** 3 faces (minutes / hours / hard), a "correct" face, hour / minute / second hands
- **Pad:** problem sheet (+ and −), intro sheet, wrong ✗ sheet, digits with and without the carry bubble
- **Feedback:** score popups (5–9, HUGE, WOW, −5), confetti pieces (8)
- **Report card:** paper (2 blink frames)

---

## 11. Rewrite architecture

- **Language and tools:** TypeScript, built with Vite.
- **Screen:** ordinary web page elements styled with CSS for everything 2D (cards, keypad, settings, report card), which stays sharp at any size and works well with touch. The 3D rabbit sits on its own WebGL layer, reusing `rabbit-renderer.js` and `rig.js`.
- **Layout:** a fixed 4:3 stage scaled to fit the screen, like the original. iPad first, with large touch targets.
- **Motion:** smooth CSS / requestAnimationFrame animation, not tied to a 30-frames-per-second step.
- **Game logic:** plain TypeScript modules with no screen code: problem generation, deck, scoring, timer, clock, pad. That makes them unit-testable.
- **Audio:** Web Audio, with clips preloaded and unlocked on the first tap (an iPad requirement).
- **Assets:** the Mad Dad art serves as placeholders until the new art lands. Each art slot is a single file path, so it can be swapped without code changes.
