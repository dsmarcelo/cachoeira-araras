import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		colors: {
  			'light-blue': {
  				'50': '#eefffc',
  				'100': '#c6fff7',
  				'200': '#8efff0',
  				'300': '#4dfbe8',
  				'400': '#19e8d7',
  				'500': '#00c6b9',
  				'600': '#00a49d',
  				'700': '#02837f',
  				'800': '#086765',
  				'900': '#0c5553',
  				'950': '#003334'
  			},
  			alert: 'rgb(255 111 0)',
  			'alert-light': 'rgba(255, 193, 7, .2)',
  			'dark-blue': '#00516D',
  			'bg-blue': '#00182D',
  			dark: '#00182D',
  			light: '#ecf7fa',
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			'primary-50': '#ecf7fa',
  			'primary-100': '#c3e5ee',
  			'primary-200': '#a6d8e6',
  			'primary-300': '#7dc6db',
  			'primary-400': '#64bbd4',
  			'primary-500': '#3daac9',
  			'primary-600': '#389bb7',
  			'primary-700': '#2b798f',
  			'primary-800': '#225e6f',
  			'primary-900': '#1a4754',
  			'blue-50': '#ecf7fa',
  			'blue-100': '#c3e5ee',
  			'blue-200': '#a6d8e6',
  			'blue-300': '#7dc6db',
  			'blue-400': '#64bbd4',
  			'blue-500': '#3daac9',
  			'blue-600': '#389bb7',
  			'blue-700': '#2b798f',
  			'blue-800': '#225e6f',
  			'blue-900': '#1a4754',
  			'1primaryg-50': '#ecedea',
  			'1primaryg-100': '#c3c6bd',
  			'1primaryg-200': '#a6ab9d',
  			'1primaryg-300': '#7e8470',
  			'1primaryg-400': '#656d55',
  			'1primaryg-500': '#3e482a',
  			'1primaryg-600': '#384226',
  			'1primaryg-700': '#2c331e',
  			'1primaryg-800': '#222817',
  			'1primaryg-900': '#1a1e12',
  			'1light-green-50': '#f9f9f7',
  			'1light-green-100': '#ecede5',
  			'1light-green-200': '#e3e4d8',
  			'1light-green-300': '#d6d8c6',
  			'1light-green-400': '#ced1bb',
  			'1light-green-500': '#c2c5aa',
  			'1light-green-600': '#b1b39b',
  			'1light-green-700': '#8a8c79',
  			'1light-green-800': '#6b6c5e',
  			'1light-green-900': '#515347',
  			'1secondary-g-50': '#f2f2ed',
  			'1secondary-g-100': '#d5d8c8',
  			'1secondary-g-200': '#c1c5ad',
  			'1secondary-g-300': '#a5aa88',
  			'1secondary-g-400': '#949971',
  			'1secondary-g-500': '#79804d',
  			'1secondary-g-600': '#6e7446',
  			'1secondary-g-700': '#565b37',
  			'1secondary-g-800': '#43462a',
  			'1secondary-g-900': '#333620',
  			'1tertiary-g-50': '#eaeae9',
  			'1tertiary-g-100': '#bebdba',
  			'1tertiary-g-200': '#9e9d98',
  			'1tertiary-g-300': '#72706a',
  			'1tertiary-g-400': '#57544d',
  			'1tertiary-g-500': '#2d2920',
  			'1tertiary-g-600': '#29251d',
  			'1tertiary-g-700': '#201d17',
  			'1tertiary-g-800': '#191712',
  			'1tertiary-g-900': '#13110d',
  			'bpds/1light-green': '#c2c5aa',
  			'bpds/primary': '#3e482a',
  			'bpds/secondary': '#79804d',
  			'bpds/tertiary': '#2d2920',
  			'bpds/brown': '#69573b',
  			'positive-green': '#14AE5C',
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		},
  		screens: {
  			xs: {
  				raw: '(min-width: 480px)'
  			},
  			'max-md': {
  				raw: '(max-width: 768px)'
  			},
  			'max-sm': {
  				raw: '(max-width: 640px)'
  			},
  			tall: {
  				raw: '(min-height: 800px)'
  			},
  			'max-tall': {
  				raw: '(max-height: 800px)'
  			},
  			medium: {
  				raw: '(min-height: 400px)'
  			},
  			'max-medium': {
  				raw: '(max-height: 400px)'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
