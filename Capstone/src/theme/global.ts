import { colors, typography } from './tokens'

/**
 * Global CSS Variables and Base Styles
 */
export const globalStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    background-color: ${colors.background};
    color: ${colors.textPrimary};
    font-size: ${typography.body.fontSize}px;
    line-height: ${typography.body.lineHeight};
  }

  #root {
    width: 100%;
    height: 100vh;
    overflow: hidden;
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${colors.backgroundSecondary};
  }

  ::-webkit-scrollbar-thumb {
    background: ${colors.grey300};
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: ${colors.grey400};
  }

  /* Utility classes */
  .text-primary {
    color: ${colors.textPrimary};
  }

  .text-secondary {
    color: ${colors.textSecondary};
  }

  .text-muted {
    color: ${colors.textMuted};
  }

  .bg-primary {
    background-color: ${colors.primary};
  }

  .bg-secondary {
    background-color: ${colors.backgroundSecondary};
  }
`
