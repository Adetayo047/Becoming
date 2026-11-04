export const Colors = {
  purple: '#6C5CE7',
  purpleLight: '#A29BFE',
  purpleDark: '#4834D4',
  orange: '#FFB020',
  orangeLight: '#FDCB6E',
  orangeDark: '#E17055',
  cream: '#FDF8F2',
  white: '#FFFFFF',
  black: '#1A1A2E',
  grey: {
    50: '#F8F9FA',
    100: '#F1F3F5',
    200: '#E9ECEF',
    300: '#DEE2E6',
    400: '#CED4DA',
    500: '#ADB5BD',
    600: '#868E96',
    700: '#495057',
    800: '#343A40',
    900: '#212529',
  },
  success: '#00B894',
  error: '#D63031',
  warning: '#FDCB6E',

  // Semantic
  background: '#FDF8F2',
  surface: '#FFFFFF',
  border: '#E9ECEF',

  // M3-ish surface layers, added for the Community screens (see the Stitch
  // wireframe export) — additive only, nothing above was renamed.
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F6F2FE',
  surfaceContainer: '#F0ECF8',
  surfaceContainerHigh: '#EBE6F2',
  onSurfaceVariant: '#474554',
  outline: '#787586',
  outlineVariant: '#C8C4D7',
  text: {
    primary: '#1A1A2E',
    secondary: '#495057',
    muted: '#ADB5BD',
    inverse: '#FFFFFF',
  },

  // Category colors for goal dimensions
  career: '#6C5CE7',
  skills: '#00B894',
  health: '#FF7675',
  money: '#FFB020',
  relationships: '#FD79A8',
};

export const Fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
};

export const CATEGORY_META = {
  career: { label: 'Career', emoji: '💼', color: Colors.career },
  skills: { label: 'Skills', emoji: '🧠', color: Colors.skills },
  health: { label: 'Health', emoji: '💪', color: Colors.health },
  money: { label: 'Money', emoji: '💰', color: Colors.money },
  relationships: { label: 'Relationships', emoji: '❤️', color: Colors.relationships },
} as const;

export type Category = keyof typeof CATEGORY_META;

// Generic voice-line samples describing each AI tone — not AI output, not
// attributed to any real user, just static preview copy for the Settings
// screen's persona picker (mirrors api/app/lib/openai.ts's PERSONALITY_TONE,
// which is what actually shifts the AI's real responses).
export const PERSONALITY_META = {
  encouraging: {
    label: 'Encouraging',
    emoji: '❤️',
    preview: "You're making incredible strides today! Every small win is a building block for the future version of you.",
  },
  stoic: {
    label: 'Stoic',
    emoji: '🛡️',
    preview: 'Focus on what you can control. The obstacle is the way. Your discipline is your freedom.',
  },
  visionary: {
    label: 'Visionary',
    emoji: '🚀',
    preview: 'See the version of yourself years from now. Every action today is a pixel in that masterpiece.',
  },
  direct: {
    label: 'Direct',
    emoji: '⚡',
    preview: 'Focus dipped today. Recalibrate — start your next block now.',
  },
  analytical: {
    label: 'Analytical',
    emoji: '📊',
    preview: 'Your current alignment is trending up. Shifting deep work earlier could optimize for peak output.',
  },
} as const;

export type AiPersonalityKey = keyof typeof PERSONALITY_META;
