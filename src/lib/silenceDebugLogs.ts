if (import.meta.env.PROD) {
  const noop = () => undefined;
  console.log = noop;
  console.debug = noop;
  console.info = noop;
  console.warn = noop;
}
