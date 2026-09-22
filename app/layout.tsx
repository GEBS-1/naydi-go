import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "НайдиGo — товары рядом",
  description: "Найдите товар в магазинах Казани или управляйте своим магазином.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
