const defaultTheme = require("tailwindcss/defaultTheme");

const appFontFamily = [
  '"Droid Sans Mono"',
  '"SF Mono"',
  "monospace",
  ...defaultTheme.fontFamily.sans,
];

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"], // ts와 tsx 사이의 공백 제거
  theme: {
    extend: {
      colors: {
        layer: {
          bg: "#eee",
        },
        component: {
          positive: "#8b956d",
          negative: "#d95763",
        },
      },
      fontFamily: {
        sans: appFontFamily,
        display: appFontFamily,
        dialog: appFontFamily,
      },
    },
  },
  plugins: [],
};
