// Text costumes: Mad Dad's numbers, labels and popups were Scratch text, so they are set here in the
// same fonts instead of being drawn as pictures. Scratch's "Sans Serif" is Noto Sans Medium and its
// "Marker" is Knewave; both are bundled (see main.ts), so text looks the same on every device.
import type { ArtSlot, TextRun } from 'virtual:art';

const SVG = 'http://www.w3.org/2000/svg';

// A centered run stands in for a glyph Mad Dad drew as a picture (the timer's ∞). Its size is the
// drawing's height, so the font size is scaled until the glyph's ink is that tall. These are Noto Sans
// Medium's ∞: ink height and the height of the ink's middle above the baseline, per em.
const GLYPH_INK_HEIGHT = 0.36;
const GLYPH_INK_MIDDLE = 0.18;

export const FONTS: Record<string, { family: string; weight: number }> = {
  'Sans Serif': { family: '"Noto Sans", sans-serif', weight: 500 },
  Marker: { family: 'Knewave, cursive', weight: 400 },
};

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
  const centered = !placed || run.center;
  const fontSize = run.center ? run.size / GLYPH_INK_HEIGHT : run.size;
  t.textContent = run.text;
  t.setAttribute('x', String(x));
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
