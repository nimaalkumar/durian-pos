import './globals.css'
import ClientLayout from './ClientLayout'

// This metadata tells iPhones, iPads, and Windows that this is a real installable app!
export const metadata = {
  title: 'Ah Wei 33 Durian',
  description: 'POS & Inventory System',
  manifest: '/manifest.json',
  themeColor: '#166534',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AW33 Durian',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className="bg-gray-50 text-gray-900 min-h-screen font-sans">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}