/**
 * Secretariat's S mark, drawn as its deck and its app draw it: copied from
 * the app's public/secretariat-mark-final.svg, with currentColor in place of
 * black so it takes the logo's accent (see `.logo-mark` in globals.css).
 *
 * It stands in for the word's first letter: "[mark]ecretariat". An undrawn
 * "S" goes with it (`.logo-letter`), so screen readers, search and copied
 * text still get "Secretariat".
 */
export function SecretariatMark() {
  return (
    <>
      <svg
        className="logo-mark"
        viewBox="36 26 218 437"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M230.2 110.5 C230.2 74.6 200 50 156.3 50 C104.8 50 60 80.2 60 128.4 C60 181 104.8 209 144 244.9 C185.4 281.8 225.8 309.8 225.8 363.6 C225.8 410.6 188.8 438.6 149.6 438.6 C104.8 438.6 73.4 412.9 62.2 365.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="40"
          strokeLinecap="round"
        />
        <path
          d="M84.6 265 L64.5 305.4 Q60 317.7 73.4 318.8 L93.6 318.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M125 140.7 a23.5 31.4 0 1 0 47 0 a23.5 31.4 0 1 0 -47 0 Z M148.9 128.2 a6.3 8.4 0 1 0 12.6 0 a6.3 8.4 0 1 0 -12.6 0 Z"
          fill="currentColor"
          fillRule="evenodd"
        />
      </svg>
      <span className="logo-letter">S</span>
    </>
  )
}
