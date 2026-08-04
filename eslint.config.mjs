import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // Data-fetch + auth refresh effects legitimately call setState after await;
  // the React Compiler rule flags the call site even when state updates are async.
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "node_modules/**", "data/runtime.json"]),
]);
