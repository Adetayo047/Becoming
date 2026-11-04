// DEMO_PAYMENTS=true lets testers unlock paid tiers through a clearly
// labelled demo checkout — nothing is charged. Ignored once a real payment
// processor (Paystack) is configured.
export function isDemoPayments(): boolean {
  return process.env.DEMO_PAYMENTS === 'true' && !process.env.PAYSTACK_SECRET_KEY;
}
