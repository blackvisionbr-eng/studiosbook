function isPlainObject(value) {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function sanitizeFirestorePayload(value) {
  if (value === undefined) return undefined;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeFirestorePayload(item) ?? null);
  }

  if (!isPlainObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, sanitizeFirestorePayload(item)])
      .filter(([, item]) => item !== undefined)
  );
}
