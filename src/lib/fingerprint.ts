/**
 * Canonical machine fingerprint — the contract both repos must agree on.
 *
 * `slug()` and `machineId()` are a byte-for-byte port of
 * benchmarks/harness/lib/machine_spec.py (Python `_slug` + `current_spec`),
 * so a machine_id regenerated here from the submitted hardware fields must
 * equal the one the macOS app computed. `hardwareClass()` is the fuzzy
 * "machines like mine" bucket used for install-time matching; it is defined
 * here (not in the Python harness) and the Swift app mirrors it.
 */

export interface MachineFields {
  model_name?: string | null
  model_identifier?: string | null
  chip?: string | null
  cpu_cores?: number | null
  memory_gb?: number | null
}

/** Port of machine_spec.py `_slug`. */
export function slug(value: string): string {
  let v = value.toLowerCase().trim()
  v = v.replaceAll('+', ' plus ')
  v = v.replace(/[^a-z0-9]+/g, '-')
  v = v.replace(/-{2,}/g, '-')
  v = v.replace(/^-+|-+$/g, '')
  return v || 'unknown'
}

/**
 * Port of machine_spec.py `current_spec` machine_id derivation. The cores/mem
 * segments are appended only when truthy, exactly like the Python.
 */
export function machineId(fields: MachineFields): string {
  const modelName = fields.model_name || 'Mac'
  const modelIdentifier = fields.model_identifier || 'unknown-model'
  const chip = fields.chip || 'unknown-chip'
  const parts = [modelName, modelIdentifier, chip]
  if (fields.cpu_cores) parts.push(`${fields.cpu_cores}c`)
  if (fields.memory_gb) parts.push(`${fields.memory_gb}gb`)
  return slug(parts.join('-'))
}

/** chip family bucket, e.g. "Apple M4 Max" -> "apple-m4-max". */
export function chipFamily(chip: string | null | undefined): string {
  return slug(chip || 'unknown-chip')
}

/** memory tier bucket. Buckets chosen to group "machines like mine". */
export function memoryTier(memoryGb: number | null | undefined): string {
  const gb = memoryGb ?? 0
  if (gb <= 0) return 'unknown'
  if (gb <= 16) return '16gb'
  if (gb <= 36) return '32gb'
  if (gb <= 72) return '64gb'
  if (gb <= 160) return '128gb'
  return '192gb-plus'
}

/** Composite fuzzy-match key: "${chipFamily}__${memoryTier}". */
export function hardwareClass(
  chip: string | null | undefined,
  memoryGb: number | null | undefined,
): string {
  return `${chipFamily(chip)}__${memoryTier(memoryGb)}`
}
