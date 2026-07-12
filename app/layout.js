import "./globals.css";

export const metadata = {
  title: "Morphling Studio",
  description: "A two-stage OpenAI image pipeline: mascot generation and scene composition.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
