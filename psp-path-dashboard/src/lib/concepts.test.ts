import { describe, it, expect } from 'vitest'
import { CONCEPTS, getConceptsByStep, getRelatedConcepts } from '@/lib/concepts'

describe('concepts.ts', () => {
  it('should have all concepts defined', () => {
    expect(Object.keys(CONCEPTS).length).toBeGreaterThan(5)
    expect(CONCEPTS.psa).toBeDefined()
    expect(CONCEPTS.bnCode).toBeDefined()
    expect(CONCEPTS.sweep).toBeDefined()
  })

  it('should have correct structure for each concept', () => {
    Object.values(CONCEPTS).forEach((concept) => {
      expect(concept.id).toBeTruthy()
      expect(concept.title).toBeTruthy()
      expect(concept.description).toBeTruthy()
      expect(Array.isArray(concept.relatedSteps)).toBe(true)
      expect(Array.isArray(concept.docReferences)).toBe(true)
      expect(Array.isArray(concept.relatedConcepts)).toBe(true)
    })
  })

  it('should return correct concepts for a step', () => {
    // Step disburse 应该相关 PSA、BN code、Consent 等
    const disburseConceptIds = getConceptsByStep('disburse').map((c) => c.id)
    expect(disburseConceptIds).toContain('psa')
    expect(disburseConceptIds).toContain('consent')
  })

  it('should return related concepts for a concept', () => {
    const relatedToPSA = getRelatedConcepts('psa')
    const relatedIds = relatedToPSA.map((c) => c.id)
    expect(relatedIds).toContain('bnCode')
    expect(relatedIds).toContain('sweep')
  })

  it('should handle non-existent concept', () => {
    const result = getRelatedConcepts('nonexistent')
    expect(result).toEqual([])
  })

  it('should have valid document references', () => {
    Object.values(CONCEPTS).forEach((concept) => {
      concept.docReferences.forEach((ref) => {
        expect(ref).toMatch(/^§\d+(\.\d+)?$/)
      })
    })
  })

  it('should have valid FAQ structure for concepts with FAQs', () => {
    Object.values(CONCEPTS).forEach((concept) => {
      if (concept.faqs) {
        concept.faqs.forEach((faq) => {
          expect(faq.question).toBeTruthy()
          expect(faq.answer).toBeTruthy()
        })
      }
    })
  })

  it('should not have circular related concepts', () => {
    Object.values(CONCEPTS).forEach((concept) => {
      concept.relatedConcepts.forEach((relatedId) => {
        const relatedConcept = CONCEPTS[relatedId]
        expect(relatedConcept).toBeDefined()
      })
    })
  })
})
