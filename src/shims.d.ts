// Minimal shims to compile without @types/node
declare var process: any;

declare module 'http' {
  export type IncomingMessage = any;
  export type ServerResponse = any;
  export function createServer(...args: any[]): any;
}

declare module 'crypto' {
  export function randomUUID(): string;
}

