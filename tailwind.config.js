/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.{html,js}"],
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/container-queries")],
};
