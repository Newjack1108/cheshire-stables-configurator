import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h1 style={{ fontSize: 32, marginBottom: 20 }}>Stable Configurator</h1>
      <p style={{ fontSize: 18, marginBottom: 30 }}>
        Build your custom stable block configuration
      </p>
      <Link
        href="/configurator"
        style={{
          display: 'inline-block',
          padding: '12px 24px',
          backgroundColor: '#0066cc',
          color: 'white',
          textDecoration: 'none',
          borderRadius: 6,
          fontSize: 16,
          fontWeight: 500,
        }}
      >
        Open Configurator
      </Link>
    </div>
  )
}

