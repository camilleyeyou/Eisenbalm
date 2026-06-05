// TODO(Andrew): voice sign-off required on all 8 subject lines before live sending.
// These are working drafts in Jesse's deadpan register — dry, precise, no winking.
// CAN-SPAM: subjects are factual and non-deceptive. Step 3 avoids "arrived"/"delivered"
// because it's a delivery estimate, not a confirmed delivery.
export const SUBJECTS: Record<number, string> = {
  // E1: Order confirmation — transactional
  1: 'Your order is confirmed.',

  // E2: Shipping notice — transactional
  2: 'Your lip balm has shipped.',

  // E3: Delivery estimate — transactional. MUST NOT contain "arrived" or "delivered".
  3: 'It should reach you any day now.',

  // E4: The ritual — first marketing email
  4: 'A brief word about what you bought.',

  // E5: Charity receipt — the anchor
  5: 'Your purchase funded something real.',

  // E6: Review ask
  6: 'A question, if you have a moment.',

  // E7: Newsletter opt-in — the hinge
  7: 'There are more charities. You could know about them.',

  // E8: Replenishment + last call
  8: 'You are probably running low.',
}
