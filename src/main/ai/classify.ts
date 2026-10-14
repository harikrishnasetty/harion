import type { AiStatus, Classification, Settings } from '@shared/types'
import { ruleClassify } from './rules'
import { ollamaClassify, ollamaStatus } from './ollama'
import { createLogger } from '../util/logger'

const log = createLogger('ai')

export interface ClassifyResult {
  classification: Classification
  aiUsed: boolean
}

export async function classifyText(
  text: string,
  settings: Settings
): Promise<ClassifyResult> {
  const fallback = ruleClassify(text)
  if (!settings.aiEnabled) {
    return { classification: fallback, aiUsed: false }
  }
  try {
    const ai = await ollamaClassify(text, settings)
    if (ai) {
      return {
        classification: {
          ...ai,
          title: ai.title || fallback.title,
          summary: ai.summary || fallback.summary,
          dueAt: ai.dueAt ?? fallback.dueAt,
          tags: ai.tags.length ? ai.tags : fallback.tags,
          entities: { ...fallback.entities, ...ai.entities }
        },
        aiUsed: true
      }
    }
  } catch (err) {
    log.warn('AI classification failed, using rules:', (err as Error).message)
  }
  return { classification: fallback, aiUsed: false }
}

export async function getAiStatus(settings: Settings): Promise<AiStatus> {
  if (!settings.aiEnabled) {
    return {
      enabled: false,
      reachable: false,
      model: settings.ollamaModel,
      models: [],
      message: 'AI classification is turned off'
    }
  }
  const status = await ollamaStatus(settings.ollamaUrl)
  const hasModel = status.models.some(
    (m) => m === settings.ollamaModel || m.startsWith(`${settings.ollamaModel}:`)
  )
  if (!status.reachable) {
    return {
      enabled: true,
      reachable: false,
      model: settings.ollamaModel,
      models: status.models,
      message: `Ollama not reachable at ${settings.ollamaUrl} - using rule-based fallback`
    }
  }
  return {
    enabled: true,
    reachable: true,
    model: settings.ollamaModel,
    models: status.models,
    message: hasModel
      ? `Connected to Ollama (${settings.ollamaModel})`
      : `Ollama online but model "${settings.ollamaModel}" is not pulled - run: ollama pull ${settings.ollamaModel}`
  }
}
