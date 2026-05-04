export const density = {
  comfortable: 'comfortable',
  compact: 'compact',
} as const;

export type Density = (typeof density)[keyof typeof density];
