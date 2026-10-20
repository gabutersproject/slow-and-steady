import { describe, expect, it } from 'vitest'

import type { AIStatus } from '../types'
import { deriveStatus } from './StatusBadge'

function status(overrides: Partial<AIStatus> = {}): AIStatus {
  return {
    provider: 'demo',
    state: 'demo',
    selected_model: null,
    model_available: false,
    message: 'Demo Mode: replies are scripted.',
    ollama: { available: false, base_url: 'http://127.0.0.1:11434', version: null, model_count: 0, error: 'offline' },
    suggested_model: 'qwen2.5:1.5b',
    ...overrides,
  }
}

describe('deriveStatus', () => {
  it('never reports Local AI Ready until the backend verified Ollama', () => {
    expect(deriveStatus(null, 'idle', true, true).label).not.toBe('Local AI Ready')
    expect(deriveStatus(status(), 'idle', true, false).label).toBe('Demo Mode')
    expect(deriveStatus(status({ provider: 'ollama', state: 'offline' }), 'idle', true, false).label).toBe('Ollama Offline')
    expect(deriveStatus(status({ provider: 'ollama', state: 'no_models' }), 'idle', true, false).label).toBe('No Models Installed')
    expect(deriveStatus(status({ provider: 'ollama', state: 'model_not_found' }), 'idle', true, false).label).toBe('Model Not Found')
    expect(deriveStatus(status({ provider: 'ollama', state: 'ready', model_available: true, selected_model: 'qwen2.5:1.5b' }), 'idle', true, false).label).toBe(
      'Local AI Ready',
    )
  })

  it('surfaces generation and backend-unavailable states', () => {
    expect(deriveStatus(status(), 'waiting', true, false).state).toBe('model_loading')
    expect(deriveStatus(status(), 'streaming', true, false)).toMatchObject({ state: 'generating', label: 'Generating Response' })
    expect(deriveStatus(status({ state: 'ready' }), 'idle', false, false).state).toBe('backend_unavailable')
  })
})
