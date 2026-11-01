/** Complete source outfits; no body/head mixing and no invented combat clips. */
export const CHIBI_CAST=['merchant','archer','knight','ninja','student'] as const;
export type ChibiCast=typeof CHIBI_CAST[number];
export type ChibiMotion='idle'|'walk'|'run'|'dead'|'jump'|'attack'|'cast';
export function chibiClip(names:string[],motion:ChibiMotion):string|null{
 const terms:Partial<Record<ChibiMotion,RegExp>>={idle:/^(anim_iddle|iddleanim_)$/,walk:/walk/,run:/run/,dead:/dying/,jump:/jump/};
 const term=terms[motion];return term?names.find(n=>term.test(n))??null:null;
}
