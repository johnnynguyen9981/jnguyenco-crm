import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy:        "#083a4f",
          sand:        "#a58d66",
          teal:        "#407e8c",
          "pale-blue": "#c0d5d6",
          cream:       "#e5e1dd",
          "navy-800":  "#0a4d68",
          "navy-950":  "#051f2a",
          "sand-100":  "#f3ede5",
          "sand-600":  "#8c7554",
          "teal-100":  "#d8eaec",
          "teal-700":  "#305f6a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(8 58 79 / 0.08), 0 1px 2px -1px rgb(8 58 79 / 0.06)",
        "card-hover": "0 4px 12px 0 rgb(8 58 79 / 0.12), 0 2px 4px -1px rgb(8 58 79 / 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
