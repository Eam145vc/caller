import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Layout({ children }) {
    const router = useRouter();

    const isActive = (path) => router.pathname === path ? 'active' : '';

    return (
        <div className="layout">
            <aside className="sidebar">
                <div className="brand">
                    WebBoost<span style={{ color: 'white' }}>AI</span>
                </div>

                <nav className="nav">
                    <Link href="/" className={`nav-item ${isActive('/')}`}>
                        Dashboard
                    </Link>
                    <Link href="/leads" className={`nav-item ${isActive('/leads')}`}>
                        Leads & Scraping
                    </Link>
                    <Link href="/campaigns" className={`nav-item ${isActive('/campaigns')}`}>
                        Campaigns
                    </Link>
                    <Link href="/appointments" className={`nav-item ${isActive('/appointments')}`}>
                        Appointments
                    </Link>
                    <Link href="/calls" className={`nav-item ${isActive('/calls')}`}>
                        Call History
                    </Link>
                    <Link href="/test" className={`nav-item ${isActive('/test')}`} style={{ color: '#fbbf24' }}>
                        🧪 Test AI Voice
                    </Link>
                    <Link href="/settings" className={`nav-item ${isActive('/settings')}`}>
                        Settings
                    </Link>
                </nav>

                <div style={{ marginTop: 'auto', padding: '1rem', background: '#22262e', borderRadius: '8px', fontSize: '0.8rem', color: '#6b7280' }}>
                    <div style={{ fontWeight: 'bold', color: 'white', marginBottom: '0.25rem' }}>Status: Online</div>
                    <div>Twilio: Connected</div>
                    <div>OpenAI: Ready</div>
                </div>
            </aside>

            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
