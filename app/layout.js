import "./globals.css";

export const metadata = {
  title: "WILDLANDS: After the Fall",
  description: "A top-down pixel-art survival game."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
