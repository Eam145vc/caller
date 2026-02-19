import { useState } from 'react';
import Layout from '../components/Layout';

export default function TestCall() {
    const [phone, setPhone] = useState('');
    const [status, setStatus] = useState('');

    const handleTestCall = async (e) => {
        e.preventDefault();
        setStatus('Initiating call...');

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
            const res = await fetch(`${apiUrl}/api/calls/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: phone })
            });

            const data = await res.json();
            if (data.success) {
                setStatus(`Calling ${phone}... check your phone!`);
            } else {
                setStatus(`Error: ${data.error}`);
            }
        } catch (err) {
            setStatus(`Error: ${err.message}`);
        }
    };

    return (
        <Layout>
            <h1>Test Verification</h1>

            <div className="card" style={{ marginTop: '2rem', maxWidth: '500px' }}>
                <h3>Simulate Cold Call</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    Enter your own phone number (with country code, e.g., +57...) to test the AI voice agent.
                </p>

                <form onSubmit={handleTestCall}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Phone Number</label>
                        <input
                            type="tel"
                            placeholder="+57 300 123 4567"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                        📞 Call Me Now
                    </button>
                </form>

                {status && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--surface-hover)', borderRadius: '8px' }}>
                        {status}
                    </div>
                )}
            </div>
        </Layout>
    );
}
