import "./globals.css";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import SecurityLayer from "./components/SecurityLayer"; // İMPORT ETTİK

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "AGILE | Secure Suite",
  description: "Enterprise Agile Tools",
  // ROBOTLARA KARŞI KESİN ENGEL:
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors duration-300 select-none`}> 
        {/* select-none: Metin seçimini CSS ile de engelledik */}
        <Providers>
            <SecurityLayer /> {/* SAVUNMA AKTİF */}
            {children}
        </Providers>
      </body>
    </html>
  );
}
