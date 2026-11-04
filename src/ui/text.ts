// Text costumes: Mad Dad's numbers, labels and popups were Scratch text, so they are set here with a
// font instead of being drawn as pictures. Mad Dad's "Sans Serif" (Noto Sans Medium) text is now set in
// Baby Rabbit; its "Marker" (Knewave) popups stay as they were. All fonts are bundled, so text looks the
// same on every device.
import type { ArtSlot, TextRun } from 'virtual:art';

const SVG = 'http://www.w3.org/2000/svg';

// A centered run stands in for a glyph Mad Dad drew as a picture (the timer's ∞). Its size is the
// drawing's height, so the font size is scaled until the glyph's ink is that tall. These are Noto Sans
// Medium's ∞: ink height and the height of the ink's middle above the baseline, per em.
const GLYPH_INK_HEIGHT = 0.36;
const GLYPH_INK_MIDDLE = 0.18;

/**
 * `layout` is the font Mad Dad's text was placed for. When a font stands in for it, each run is centered
 * where the original text sat, and shrunk if it would spill out of its box. Baby Rabbit has no ∞, so
 * that falls back to Noto Sans.
 */
// `scale` sizes a stand-in font so its digits and capitals stand as tall as the original's (Baby Rabbit's
// are 0.486 em tall, Noto Sans's 0.724 em).
export const FONTS: Record<string, { family: string; weight: number; layout?: string; scale?: number }> = {
  'Sans Serif': { family: '"Baby Rabbit", "Noto Sans", sans-serif', weight: 400, layout: '500 100px "Noto Sans"', scale: 1.49 },
  Marker: { family: 'Knewave, cursive', weight: 400 },
};

let measure: CanvasRenderingContext2D | null = null;
/** Width of `text` at font size 1 in a CSS font ("<weight> 100px <family>"). */
function widthOf(text: string, font: string) {
  measure ??= document.createElement('canvas').getContext('2d')!;
  measure.font = font;
  return measure.measureText(text).width / 100;
}

type TextSlot = Pick<ArtSlot, 'url' | 'stageW' | 'stageH' | 'textW' | 'textH' | 'fileW' | 'fileH' | 'text'>;

/**
 * An <svg> filling the costume's box (in costume units): the shape image, if any, with its text runs
 * painted under or over it as Mad Dad had them (the pad's big digits sit under the carry bubble).
 */
export function drawText(slot: TextSlot): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  const box = { w: slot.textW ?? slot.stageW, h: slot.textH ?? slot.stageH };
  svg.setAttribute('viewBox', `0 0 ${box.w} ${box.h}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'costume-text');
  svg.setAttribute('aria-hidden', 'true');
  const runs = slot.text ?? [];
  for (const run of runs) if (run.over_base === false) svg.append(textRun(run, box));
  if (slot.url) {
    const img = document.createElementNS(SVG, 'image');
    img.setAttribute('href', slot.url);
    img.setAttribute('width', String(slot.fileW ?? box.w));
    img.setAttribute('height', String(slot.fileH ?? box.h));
    img.setAttribute('preserveAspectRatio', 'none');
    svg.append(img);
  }
  for (const run of runs) if (run.over_base !== false) svg.append(textRun(run, box));
  return svg;
}

function textRun(run: TextRun, box: { w: number; h: number }): SVGTextElement {
  const t = document.createElementNS(SVG, 'text');
  const font = FONTS[run.font] ?? FONTS['Sans Serif'];
  const placed = run.x !== undefined && run.y !== undefined;
  const x = placed ? run.x! : box.w / 2;
  const y = placed ? run.y! : box.h / 2;
  let centered = !placed || run.center;
  let fontSize = run.center ? run.size / GLYPH_INK_HEIGHT : run.size;
  let textX = x;
  if (font.layout && placed && !run.center && (run.anchor ?? 'start') === 'start') {
    // center the stand-in font on where the original text sat, shrinking it to fit the box if needed
    fontSize *= font.scale ?? 1;
    const was = widthOf(run.text, font.layout) * run.size;
    let now = widthOf(run.text, `${font.weight} 100px ${font.family}`) * fontSize;
    const room = box.w * 0.96;
    if (now > room) { fontSize *= room / now; now = room; }
    textX = Math.min(Math.max(x + was / 2, now / 2), box.w - now / 2);
    centered = true;
  }
  t.textContent = run.text;
  t.setAttribute('x', String(textX));
  t.setAttribute('y', String(run.center ? y + GLYPH_INK_MIDDLE * fontSize : y));
  t.setAttribute('font-family', font.family);
  t.setAttribute('font-weight', String(font.weight));
  t.setAttribute('font-size', String(fontSize));
  t.setAttribute('fill', run.color);
  t.setAttribute('text-anchor', centered ? 'middle' : run.anchor ?? 'start');
  if (!placed) t.setAttribute('dominant-baseline', 'central');
  if (run.rotate) t.setAttribute('transform', `rotate(${run.rotate} ${x} ${y})`);
  if (run.stroke && run.stroke_width) {
    t.setAttribute('stroke', run.stroke);
    t.setAttribute('stroke-width', String(run.stroke_width));
    t.setAttribute('stroke-linejoin', 'round');
    t.setAttribute('paint-order', 'stroke');
  }
  return t;
}
