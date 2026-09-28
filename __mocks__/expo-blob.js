// Jest mock for expo-blob.
// expo-blob provides a native Blob implementation via expo modules.
// In the Jest (Node.js) environment there is no native module, so we re-export
// the Node.js global Blob so that `expect.any(Blob)` assertions and the
// `new Blob(...)` constructor in beta-video-service.ts work correctly under test.
module.exports = {
  Blob: globalThis.Blob,
};
