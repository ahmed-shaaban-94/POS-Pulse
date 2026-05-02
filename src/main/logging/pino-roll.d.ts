/**
 * Ambient declaration for `pino-roll` v4 — the upstream package ships
 * pure JS without TypeScript types. Only the surface our `createLogger`
 * actually uses is typed here; broaden as needed.
 */
declare module 'pino-roll' {
  interface PinoRollOptions {
    file: string;
    frequency?: 'daily' | number;
    dateFormat?: string;
    extension?: string;
    limit?: { count?: number; size?: string };
    mkdir?: boolean;
    size?: string;
  }
  function pinoRoll(options: PinoRollOptions): Promise<NodeJS.WritableStream>;
  export default pinoRoll;
}
