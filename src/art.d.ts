declare module 'virtual:art' {
  /** One costume slot from art/manifest.json, resolved to art/replace/ when a replacement exists. */
  export type ArtSlot = {
    /** '' for a blank costume */
    url: string;
    /** size on the 480×360 stage at 100% */
    stageW: number;
    stageH: number;
    /** rotation center, in stage units from the image's top-left */
    centerX: number;
    centerY: number;
    /** the Scratch costume name */
    name: string;
    /** when set, the image is drawn at this spot inside the box instead of filling it: top-left (x, y),
     *  size w × h, rotated `rotate` degrees clockwise about (x, y), all in costume units */
    place?: { x: number; y: number; w: number; h: number; rotate: number };
    /** text costumes: the image's own size, which the text runs and shape are laid out in
     *  (stretched to the costume's box, as the image was) */
    textW?: number;
    textH?: number;
    /** for a shape under text: its own size (it shares the image's top-left) */
    fileW?: number;
    fileH?: number;
    /** text set in a font over the image, back to front */
    text?: TextRun[];
  };
  /** A run of text, in the image's units (textW × textH); the sprite's size % scales it like the image. */
  export type TextRun = {
    text: string;
    /** Scratch font name: "Sans Serif" or "Marker" */
    font: string;
    color: string;
    size: number;
    /** start of the baseline from the costume's top-left; centered in the box when missing */
    x?: number;
    y?: number;
    rotate?: number;
    anchor?: 'start' | 'middle' | 'end';
    stroke?: string | null;
    stroke_width?: number | null;
    /** for text on a shape: false when it is painted under the shape */
    over_base?: boolean;
    /** a glyph drawn as a picture in Mad Dad (∞): centered on x, y */
    center?: boolean;
  };
  /** Keyed "<Sprite>/<costume index>", e.g. "Logo/1". */
  const slots: Record<string, ArtSlot>;
  export default slots;
  /** Art outside the Scratch costumes (manifest "extras"), by id: art/replace/NNN* wins over the original.
   *  stageW/stageH are the original's size in stage units. */
  export const extras: Record<number, { url: string; stageW: number; stageH: number }>;
}

declare module 'virtual:sounds' {
  /** Sound name (as in the Scratch project) → URL. */
  const sounds: Record<string, string>;
  export default sounds;
}
