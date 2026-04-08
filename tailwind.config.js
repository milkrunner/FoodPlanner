/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Design-system light palette
        'ds-bg':            '#FFFFFF',
        'ds-bg-muted':      '#FAFAFA',
        'ds-bg-subtle':     '#F5F5F5',
        'ds-border':        '#F0F0F0',
        'ds-border-hover':  '#E0E0E0',
        'ds-border-faint':  '#FAFAFA',
        'ds-text':          '#111111',
        'ds-text-body':     '#333333',
        'ds-text-sec':      '#777777',
        'ds-text-muted':    '#999999',
        'ds-text-disabled': '#BBBBBB',
        'ds-accent-bg':     '#F0F7F4',
        'ds-accent':        '#3A8569',
        'ds-danger-bg':     '#FDF5F3',
        'ds-danger':        '#CC6B6B',
        'ds-danger-border': '#F0E0E0',
        'ds-heart':         '#E8A0A0',
        'ds-heart-active':  '#CC6B6B',
        // Near-black — dark mode surfaces (kept for future dark mode)
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
        'ds':     '10px',
        'ds-lg':  '16px',
        'ds-pill': '9999px'
      },
      fontFamily: {
        'ds': ['Inter', 'system-ui', 'sans-serif']
      },
      spacing: {
        'ds-page-x':        '48px',
        'ds-page-y':        '40px',
        'ds-page-x-mobile': '20px',
        'ds-page-y-mobile': '24px',
        'ds-section':       '32px',
        'ds-card-gap':      '24px',
        'ds-card-pad':      '28px',
        'ds-card-pad-mobile': '20px'
      }
    }
  }
}
