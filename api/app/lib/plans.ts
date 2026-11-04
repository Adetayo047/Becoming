import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

export type Tier = 'free' | 'pro' | 'plus';

// What each plan unlocks. This is the single source of truth: the API
// enforces it and the billing screen shows the benefits listed in PLANS.
export const LIMITS = {
  free: { goals: 3, partners: 1, premiumAi: false, trends: false, createGroups: false, insights: false },
  pro: { goals: Infinity, partners: 3, premiumAi: true, trends: true, createGroups: false, insights: false },
  plus: { goals: Infinity, partners: Infinity, premiumAi: true, trends: true, createGroups: true, insights: true },
} as const;

export const PLANS = {
  free: {
    label: 'Free',
    priceNaira: 0,
    benefits: ['Up to 3 active goals', 'Cascading planner & alignment score', '1 accountability partner', 'AI task & milestone suggestions'],
  },
  pro: {
    label: 'Pro',
    priceNaira: 2500,
    benefits: ['Unlimited goals', 'AI Goal Architect & Plan My Day', 'Voice wake-up calls', 'Growth trends & insights', 'Up to 3 accountability partners'],
  },
  plus: {
    label: 'Plus',
    priceNaira: 5000,
    benefits: ['Everything in Pro', 'Create group accountability circles', 'Unlimited accountability partners', 'Premium Insights: peak hours, resilience & AI habit patterns', 'Coach templates (coming soon)'],
  },
} as const;

export async function getTier(userId: string): Promise<Tier> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } });
  return (user?.tier as Tier) ?? 'free';
}

export async function getLimits(userId: string) {
  return LIMITS[await getTier(userId)];
}

/** 402 response the app turns into an "Upgrade" prompt that links to Billing. */
export function upgradeRequired(message: string, upgradeTier: 'pro' | 'plus' = 'pro') {
  return NextResponse.json({ success: false, error: message, upgradeTier }, { status: 402 });
}

/** Number of partnerships (pending or active, either direction) a user is in. */
export function countPartnerships(userId: string) {
  return prisma.accountabilityPartner.count({
    where: { OR: [{ userId }, { partnerUserId: userId }] },
  });
}
