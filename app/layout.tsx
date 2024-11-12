import type { Metadata } from "next";
import localFont from "next/font/local";
import { PrimeReactProvider } from "primereact/api";
import "./globals.css";
import "primereact/resources/themes/saga-blue/theme.css";
import "primeicons/primeicons.css";
import "primeflex/primeflex.css";
import SessionProviderWrapper from "./SessionProviderWrapper";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "法律AI",
  description: "By Leo Qin",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body {
                display: none;
              }
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
                document.addEventListener('DOMContentLoaded', function() {
                    const intervalId = setInterval(() => {
                        const elements = document.querySelectorAll('head > style[data-primereact-style-id]');
                        if (elements.length >= 3) {
                            document.body.style.display = 'block';
                            clearInterval(intervalId);
                        }
                    }, 50);
                });
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProviderWrapper>
          <PrimeReactProvider>{children}</PrimeReactProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
