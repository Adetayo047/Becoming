import { Share } from 'react-native';

// Opens the native share sheet (WhatsApp, SMS, email…) with an invite to join
// Becoming. Passing the inviter's email lets the friend add them back as an
// accountability partner after signing up.
export async function shareAppInvite(inviterEmail?: string | null) {
  const partnerLine = inviterEmail
    ? `\n\nOnce you're in, add me as your accountability partner: ${inviterEmail}`
    : '';
  try {
    await Share.share({
      message:
        "I'm using Becoming to set goals, take daily action and stay accountable. Join me — sign up with your email." +
        partnerLine,
    });
  } catch {
    // User dismissed the share sheet or no share target is available
  }
}
