import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { slug, machineId, chipFamily, memoryTier, hardwareClass } from '../src/lib/fingerprint'

const machine = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/machine.json', import.meta.url)), 'utf8'),
)

describe('fingerprint parity with machine_spec.py', () => {
  it('regenerates the canonical machine_id from hardware fields', () => {
    expect(machineId(machine)).toBe(machine.id)
    expect(machineId(machine)).toBe('macbook-pro-mac16-5-apple-m4-max-16c-128gb')
  })

  it('slug matches the Python _slug semantics', () => {
    expect(slug('Mac16,5')).toBe('mac16-5')
    expect(slug('Apple M4 Max')).toBe('apple-m4-max')
    expect(slug('  Hello+World!! ')).toBe('hello-plus-world')
    expect(slug('---')).toBe('unknown')
    expect(slug('')).toBe('unknown')
  })

  it('omits cores/memory segments when missing, like the Python', () => {
    expect(machineId({ model_name: 'Mac mini', model_identifier: 'Mac16,10', chip: 'Apple M4' })).toBe(
      'mac-mini-mac16-10-apple-m4',
    )
  })

  it('derives the fuzzy hardware class', () => {
    expect(chipFamily('Apple M4 Max')).toBe('apple-m4-max')
    expect(memoryTier(128)).toBe('128gb')
    expect(memoryTier(64)).toBe('64gb')
    expect(memoryTier(16)).toBe('16gb')
    expect(memoryTier(192)).toBe('192gb-plus')
    expect(hardwareClass('Apple M4 Max', 128)).toBe('apple-m4-max__128gb')
  })
})
