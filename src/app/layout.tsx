import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

/**
 * Two families, two jobs.
 *
 * Playfair Display carries the brand: it is the closest widely available match
 * to the logo's high-contrast serif, and it gives headings the editorial,
 * travel-magazine voice the identity asks for. Inter does everything a person
 * has to read carefully — forms, times, prices, itinerary rows — because
 * setting a departure time in a display serif is a legibility problem dressed
 * up as personality.
 */
const sans = Inter({
  variable: '--font-sans-stack',
  subsets: ['latin'],
  display: 'swap',
});

const serif = Playfair_Display({
  variable: '--font-serif-stack',
  subsets: ['latin'],
  display: 'swap',
  weight: ['600', '700', '800'],
});

export const metadata: Metadata = {
  title: {
    default: 'Trip-Ease-ium — Plan the whole journey',
    template: '%s · Trip-Ease-ium',
  },
  description:
    'Plan the whole journey. Not just the destination. From getting there to getting ready, Trip-Ease-ium brings your entire trip together in one intelligent plan.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
