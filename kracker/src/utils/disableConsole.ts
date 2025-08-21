// Disable all console outputs in the client at runtime
const noop = () => {};

try {
  if (typeof console !== "undefined") {
    ["log", "warn", "error", "info", "debug"].forEach((k) => {
      try {
        (console as any)[k] = noop;
      } catch {}
    });
  }
} catch {}

export {};


