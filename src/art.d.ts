declare module 'virtual:art' {
  /** One costume slot from art/manifest.csv, resolved to art/replace/ when a replacement exists. */
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
  };
  /** Keyed "<Sprite>/<costume index>", e.g. "Logo/1". */
  const slots: Record<string, ArtSlot>;
  export default slots;
}

declare module 'virtual:sounds' {
  /** Sound name (as in the Scratch project) → URL. */
  const sounds: Record<string, string>;
  export default sounds;
}
