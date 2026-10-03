// bwip-js publishes its types only under runtime-specific export
// conditions that TypeScript's "bundler" resolution doesn't pick; the one
// call the app makes is declared here.
declare module 'bwip-js' {
  const bwipjs: { toSVG(options: Record<string, unknown>): string };
  export default bwipjs;
}
