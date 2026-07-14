import { describe, expect, it } from 'vitest'
import {
  buildPartnerReferralBody,
  buildOrderBody,
  buildReferencedPayoutBody,
  buildRefundBody,
} from './psp-requests'

describe('psp-requests', () => {
  it('partner referral 含 DELAY_FUNDS_DISBURSEMENT 与 tracking/return', () => {
    const b = buildPartnerReferralBody('trk-1', 'https://ret')
    expect(b.tracking_id).toBe('trk-1')
    expect(
      b.operations[0].api_integration_preference.rest_api_integration.third_party_details.features,
    ).toContain('DELAY_FUNDS_DISBURSEMENT')
    expect(b.partner_configuration_override.return_url).toBe('https://ret')
  })
  it('order body 带 payee email、金额、CAPTURE intent', () => {
    const b = buildOrderBody({ amount: '160.00', currency: 'GBP', payeeEmail: 'm@x.com', referenceId: 'psp_GBP' })
    expect(b.intent).toBe('CAPTURE')
    expect(b.purchase_units[0].payee.email_address).toBe('m@x.com')
    expect(b.purchase_units[0].amount.value).toBe('160.00')
    expect(b.purchase_units[0].reference_id).toBe('psp_GBP')
    expect(b.purchase_units[0]).not.toHaveProperty('payment_instruction')
  })
  it('不填 disbursementMode 时不带 payment_instruction', () => {
    const b = buildOrderBody({ amount: '1', currency: 'GBP', payeeEmail: 'm@x.com', referenceId: 'r' })
    expect(b.purchase_units[0]).not.toHaveProperty('payment_instruction')
  })
  it('disbursementMode=DELAYED 时带 payment_instruction.disbursement_mode', () => {
    const b = buildOrderBody({
      amount: '1',
      currency: 'GBP',
      payeeEmail: 'm@x.com',
      referenceId: 'r',
      disbursementMode: 'DELAYED',
    })
    expect(b.purchase_units[0].payment_instruction).toEqual({ disbursement_mode: 'DELAYED' })
  })
  it('referenced payout 用 TRANSACTION_ID + captureId', () => {
    expect(buildReferencedPayoutBody('CAP1')).toEqual({
      reference_type: 'TRANSACTION_ID',
      reference_id: 'CAP1',
    })
  })
  it('refund body 为空对象', () => {
    expect(buildRefundBody()).toEqual({})
  })
})
