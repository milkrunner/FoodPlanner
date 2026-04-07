/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Sage green — single primary accent (like paceguard's sage)
        'ac-mint': {
          50:  '#F0F7F4',
          100: '#DCF0E7',
          200: '#B5DCCB',
          300: '#7DC2A7',
          400: '#4EA083',
          500: '#3A8569',
          600: '#2C6952',
          700: '#1F4E3B',
          800: '#143526',
          900: '#0A1F17'
        },
        // Muted rose — used very sparingly, mostly at low opacity
        'ac-peach': {
          50:  '#FDF5F3',
          100: '#FAE8E4',
          200: '#F5CECA',
          300: '#ECACAA',
          400: '#DE8888',
          500: '#CC6B6B',
          600: '#B35252'
        },
        // Cool neutral gray — page backgrounds, surfaces, borders
        'ac-cream': {
          50:  '#F8F9FA',
          100: '#F1F3F5',
          200: '#E9ECEF',
          300: '#DEE2E6',
          400: '#CED4DA',
          500: '#ADB5BD'
        },
        // Slate dark — text hierarchy (cool, not warm)
        'ac-brown': {
          400: '#868E96',
          500: '#495057',
          600: '#343A40',
          700: '#212529',
          800: '#141A1F',
          900: '#0F1316'
        },
        // Subtle green — secondary tints
        'ac-leaf': {
          100: '#EDFBF0',
          200: '#D4F3DB',
          300: '#A8E5B4',
          400: '#74CF87',
          500: '#4DB562',
          600: '#369D4A',
          700: '#257A36'
        },
        // Cool blue — neutral accent
        'ac-blue': {
          100: '#EFF6FF',
          200: '#DBEAFE',
          300: '#BFDBFE',
          400: '#93C5FD',
          500: '#60A5FA',
          600: '#3B82F6'
        },
        // Amber — warnings/highlights
        'ac-yellow': {
          100: '#FFFBEB',
          200: '#FEF3C7',
          300: '#FDE68A',
          400: '#FCD34D',
          500: '#FBBF24'
        },
        // Near-black — dark mode surfaces
        'ac-night': {
          50:  '#1E2024',
          100: '#18191D',
          200: '#131417',
          300: '#0E0F11',
          400: '#09090B',
          500: '#050506'
        }
      },
      borderRadius: {
        'ac-sm':   '0.25rem',
        'ac':      '0.375rem',
        'ac-lg':   '0.5rem',
        'ac-xl':   '0.75rem',
        'ac-2xl':  '1rem',
        'ac-pill': '9999px'
      },
      boxShadow: {
        'ac-sm':      '0 1px 2px rgba(0,0,0,0.04)',
        'ac':         '0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'ac-lg':      '0 4px 12px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        'ac-glow':    '0 0 0 3px rgba(58,133,105,0.18)',
        'ac-dark-sm': '0 1px 2px rgba(0,0,0,0.3)',
        'ac-dark-md': '0 2px 8px rgba(0,0,0,0.4)',
        'ac-dark-lg': '0 4px 16px rgba(0,0,0,0.5)'
      },
      fontFamily: {
        'ac': ['Inter', 'system-ui', 'sans-serif']
      }
    }
  }
}
