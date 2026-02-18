import Layout from '../components/Layout';

export default function Campaigns() {
    return (
        <Layout>
            <h1>Campaigns</h1>
            <div className="card" style={{ marginTop: '2rem', textAlign: 'center', padding: '3rem' }}>
                <h3 style={{ color: 'var(--text-secondary)' }}>Campaign Management Coming Soon</h3>
                <p>For now, use the Leads page to initiate individual calls.</p>
            </div>
        </Layout>
    );
}
