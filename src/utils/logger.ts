const DEFAULT_PREFIX = "[Settings]";

function withPrefix(prefix: string, args: unknown[]) {
  if (args.length === 0) {
    return [prefix];
  }

  const [first, ...rest] = args;
  if (typeof first === "string") {
    return [`${prefix} ${first}`, ...rest];
  }

  return [prefix, first, ...rest];
}

export function createLogger(prefix: string = DEFAULT_PREFIX) {
  return {
    log: (message?: unknown, ...optionalParams: unknown[]) => {
      if (!import.meta.env.DEV) return;
      console.log(...withPrefix(prefix, [message, ...optionalParams].filter((v) => v !== undefined)));
    },
    warn: (message?: unknown, ...optionalParams: unknown[]) => {
      if (!import.meta.env.DEV) return;
      console.warn(...withPrefix(prefix, [message, ...optionalParams].filter((v) => v !== undefined)));
    },
    error: (message?: unknown, ...optionalParams: unknown[]) => {
      console.error(...withPrefix(prefix, [message, ...optionalParams].filter((v) => v !== undefined)));
    },
  };
}

export const logger = createLogger();
