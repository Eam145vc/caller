import { useState, useEffect } from 'react';
import Layout from '../components/Layout';

export default function Leads() {
    const [city, setCity] = useState('');
    const [businessType, setBusinessType] = useState('');
    const [loading, setLoading] = useState(false);
    const [leads, setLeads] = useState([]);

    const fetchLeads = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/leads');
            const data = await res.json();
            setLeads(data.leads || []);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchLeads();
    }, []);

    const handleScrape = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('http://localhost:3000/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ city, businessType, maxResults: 20 })
            });
            const data = await res.json();
            alert(`Scrape finished! Found ${data.total_leads} leads.`);
            fetchLeads();
        } catch (err) {
            alert('Error scraping: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const startCall = async (leadId) => {
        if (!confirm('Start call with this lead?')) return;
        try {
            const res = await fetch('http://localhost:3000/api/calls/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId })
            });
            const data = await res.json();
            if (data.success) {
                alert('Call initiated! Check call history.');
            } else {
                alert('Failed: ' + data.error);
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    return (
        <Layout>
            <h1>Leads & Scraping</h1>

            <div className="card" style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
                <h3>Find New Businesses</h3>
                <form onSubmit={handleScrape} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', marginTop: '1rem' }}>
                    <input
                        placeholder="City (e.g. Bogotá, Medellín)"
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        required
                    />
                    <input
                        placeholder="Business Type (e.g. Restaurantes, Contadores)"
                        value={businessType}
                        onChange={e => setBusinessType(e.target.value)}
                        required
                    />
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Scraping...' : 'Search Google Maps'}
                    </button>
                </form>
            </div>

            <div className="card">
                <h3>Leads Database ({leads.length})</h3>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>City</th>
                                <th>Type</th>
                                <th>Phone</th>
                                <th>Website</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leads.map(lead => (
                                <tr key={lead.id}>
                                    <td>{lead.name}</td>
                                    <td>{lead.city}</td>
                                    <td>{lead.business_type}</td>
                                    <td>{lead.phone || 'N/A'}</td>
                                    <td>
                                        {lead.has_website ?
                                            <span style={{ color: 'var(--success)' }}>Yes</span> :
                                            <span style={{ color: 'var(--error)' }}>No (Target)</span>
                                        }
                                    </td>
                                    <td><span className={`badge ${lead.status || 'new'}`}>{lead.status || 'New'}</span></td>
                                    <td>
                                        {lead.phone && (
                                            <button onClick={() => startCall(lead.id)} className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                                                📞 Call
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {leads.length === 0 && (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No leads found. Scrape some!</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
}
