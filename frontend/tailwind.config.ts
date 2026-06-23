import type { Config } from 'tailwindcss';

// Tempica デザイントークン（frontend/design/Tempica.dc.html から抽出）
// ティール系プライマリ + 温かいペーパー背景 + 状態色。
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ブランド／プライマリ（ティール）
        brand: {
          DEFAULT: '#0D9488',
          600: '#0F766E',
          900: '#134E4A',
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
        },
        // ペーパー（背景・面）
        paper: {
          DEFAULT: '#E7E5DF', // アプリ地
          surface: '#FAF8F4', // パネル地
          card: '#FCFBF8', // 入力など
          white: '#FFFFFF',
        },
        line: {
          DEFAULT: '#ECE7DE',
          strong: '#E0D9CD',
          soft: '#F4EFE7',
        },
        ink: {
          DEFAULT: '#44403C', // 標準テキスト
          strong: '#1C1A17',
          900: '#134E4A',
          muted: '#857C70',
          faint: '#A8A096',
          label: '#5C5750',
        },
        // 状態色
        ok: { DEFAULT: '#15803D', bright: '#10B981', bg: '#F0FDF4', border: '#BBF7D0' },
        warn: { DEFAULT: '#B45309', bright: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
        danger: { DEFAULT: '#B91C1C', bright: '#EF4444', alt: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
        accent: { purple: '#7C3AED', cyan: '#0891B2' },
      },
      fontFamily: {
        sans: ['var(--font-noto)', 'Noto Sans JP', 'sans-serif'],
        rounded: ['var(--font-rounded)', 'M PLUS Rounded 1c', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card: '16px',
        panel: '14px',
        control: '11px',
      },
      boxShadow: {
        card: '0 2px 14px rgba(13,148,136,.05)',
        float: '0 12px 40px rgba(31,28,24,.13)',
        brand: '0 4px 12px rgba(13,148,136,.28)',
      },
      maxWidth: {
        content: '1000px',
      },
    },
  },
  plugins: [],
};
export default config;
