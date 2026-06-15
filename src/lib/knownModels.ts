/**
 * Known-model allow-list from the suite config. An unknown model tag is FLAGGED
 * (so new models still surface and can be reviewed), never hard-rejected.
 * Tags ending ":latest" are moving — params/quant pin the actual size.
 */
import suite from '../data/suite.json' with { type: 'json' }

const known = new Set<string>((suite as { models: string[] }).models)

export function isKnownModel(tag: string): boolean {
  if (known.has(tag)) return true
  // tolerate a registry-qualified or differently-quantized variant of a known base
  const base = tag.split(':')[0]
  for (const k of known) {
    if (k.split(':')[0] === base) return true
  }
  return false
}

export const categoryWeights: Record<string, number> = (
  suite as { category_weights: Record<string, number> }
).category_weights
