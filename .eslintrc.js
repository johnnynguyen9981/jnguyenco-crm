/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: "next/core-web-vitals",
  overrides: [
    {
      // These render <Image> via @react-pdf/renderer (server-side PDF
      // generation, not the DOM), so the DOM-accessibility alt-text rule
      // doesn't apply, and that component has no `alt` prop to satisfy it.
      files: [
        "lib/generate-contract.tsx",
        "lib/generate-contractor-agreement.tsx",
        "lib/generate-quote.tsx",
        "lib/pdf/*.tsx",
      ],
      rules: {
        "jsx-a11y/alt-text": "off",
      },
    },
  ],
};
