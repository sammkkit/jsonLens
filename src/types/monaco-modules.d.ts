// Monaco ships hand-written types only for its public API surface. The feature
// contributions we import for their side effects are plain, untyped .js
// modules, so declare them as such.
declare module 'monaco-editor/esm/vs/*.js'
declare module 'monaco-editor/esm/vs/*.css'

// The JSON language entry point is a bare re-export with no adjacent .d.ts;
// point it at the declarations that do exist one directory down.
declare module 'monaco-editor/esm/vs/language/json/monaco.contribution' {
  export * from 'monaco-editor/esm/vs/languages/features/json/register'
}
