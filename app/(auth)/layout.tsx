export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo/logo.png?v=2"
            alt="Finance"
            style={{ height: '28px', width: 'auto', objectFit: 'contain' }}
          />
        </div>
        {children}
      </div>
    </div>
  )
}
