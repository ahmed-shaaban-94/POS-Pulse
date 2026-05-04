export const connectionState = {
  online: 'online',
  degraded: 'degraded',
  offline: 'offline',
  syncing: 'syncing',
} as const;

export type ConnectionState = (typeof connectionState)[keyof typeof connectionState];
