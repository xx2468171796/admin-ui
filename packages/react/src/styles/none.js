// Node / SSR: a module's "#aui-css/<chunk>.css" import resolves here (package.json "imports", condition "node"),
// so tests and server code can import components without a CSS loader. Bundlers get the real CSS.
export {};
