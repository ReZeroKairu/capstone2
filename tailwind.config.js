/** @type {import('tailwindcss').Config} */
import defaultTheme from "tailwindcss/defaultTheme";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Poppins", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        maroon: "#7B2E19",
        grayBg: "#e0e0e0",
        greenAccent: "#4CC97B",
        darkGray: "#6B6B6B",
      },
      fontSize: {
        base: "1rem", // 16px default
        md: "1.05rem", // buttons
        lg: "1.15rem", // italic labels
        xl: "1.35rem", // form title input
        "2xl": "2rem", // section headers
      },
      borderRadius: {
        pill: "36px", // round inputs/buttons
        md: "16px", // question cards
        sm: "7px", // small buttons
        lg: "11px", // footer buttons
      },
      spacing: {
        7: "7px", // for padding
        18: "18px", // for input horizontal padding
        22: "22px", // for footer button padding
        43: "43px", // input/button height
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: 0, transform: "translateY(2px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out forwards",
      },
    },
  },
  plugins: [],
};
