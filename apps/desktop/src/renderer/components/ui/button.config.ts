export const BUTTON_VARIANTS = {
  accentGhost: 'accent-ghost',
  danger: 'danger',
  ghost: 'ghost',
  primary: 'primary',
  secondary: 'secondary',
  secondaryAccent: 'secondary-accent',
  success: 'success',
} as const;

export type ButtonVariant = (typeof BUTTON_VARIANTS)[keyof typeof BUTTON_VARIANTS];
