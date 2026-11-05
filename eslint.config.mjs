import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Keep the starter on the flat config export that actually runs under the pinned ESLint/Next toolchain.
  ...nextCoreWebVitals,
  {
    rules: {
      // L'interface est en français : les apostrophes y sont omniprésentes et
      // React les échappe de toute façon (règle pensée pour l'anglais).
      "react/no-unescaped-entities": "off",
      // Règle expérimentale (react-hooks v6) qui interdit le pattern de polling
      // utilisé partout dans la console (load() au montage + intervalle).
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "tests/**", "scripts/**"]),
]);
