import {defineConfig} from 'vitest/config';
export default defineConfig({
 test:{include:['shared/tests/**/*.vitest.ts','server/tests/**/*.vitest.ts','client/tests/**/*.vitest.ts'],
  environment:'node',coverage:{provider:'v8',reporter:['text','html','json-summary'],include:['shared/{sim,codec}/**/*.ts','shared/protocol.ts'],
   thresholds:{lines:85,functions:85,statements:85,branches:85}}}
});
