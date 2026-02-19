import { useState } from 'react';
import Layout from '../components/Layout';

export default function TestCall() {
    const [phone, setPhone] = useState('');
    const [businessName, setBusinessName] = useState('Mi Negocio Test');
    const [businessType, setBusinessType] = useState('Restaurante');
    const [status, setStatus] = useState('');

    const businessTypes = [
        "Restaurante",
        "Peluquería",
        "Clínica Veterinaria",
        "Odontología",
        "Taller Mecánico",
        "Inmobiliaria",
        "Ferretería",
        "Gimnasio",
        "Panadería",
        "Consultorio Médico"
    ];

    const handleTestCall = async (e) => {
        e.preventDefault();
        setStatus('Initiating call...');

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
            const res = await fetch(`${apiUrl}/api/calls/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phoneNumber: phone,
                    businessName: businessName,
                    businessType: businessType
                })
            });

            const data = await res.json();
            if (data.success) {
                setStatus(`Calling ${phone}... check your phone! simulating ${businessName} (${businessType})`);
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
                    Configure the business details and enter your phone number to test Sofía.
                </p>

                <form onSubmit={handleTestCall}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Business Name</label>
                        <input
                            type="text"
                            placeholder="Ej: Pizzería Roma"
                            value={businessName}
                            onChange={e => setBusinessName(e.target.value)}
                            required
                        />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Business Type</label>
                        <select
                            value={businessType}
                            onChange={e => setBusinessType(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                        >
                            {businessTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Your Phone Number</label>
                        <input
                            type="tel"
                            placeholder="+57 300 123 4567"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: '1.1rem' }}>
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
