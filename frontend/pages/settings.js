import { useState, useEffect } from 'react';
import Layout from '../components/Layout';

export default function Settings() {
    const [config, setConfig] = useState({
        twilioPhoneNumber: 'Loading...',
        openaiModel: 'GPT-4o Realtime',
        dailyCallLimit: 50
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
                const res = await fetch(`${apiUrl}/api/settings`);
                const data = await res.json();
                if (data.twilioPhoneNumber) {
                    setConfig(prev => ({ ...prev, ...data }));
                }
            } catch (err) {
                console.error('Failed to fetch settings:', err);
                setConfig(prev => ({ ...prev, twilioPhoneNumber: 'Error loading' }));
            }
        };
        fetchSettings();
    }, []);

    return (
        <Layout>
            <h1>Settings</h1>
            <div className="card" style={{ marginTop: '2rem' }}>
                <h3>System Configuration</h3>
                <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Twilio Phone Number</label>
                        <input type="text" value={config.twilioPhoneNumber} readOnly />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>OpenAI Model</label>
                        <select disabled>
                            <option>{config.openaiModel}</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Daily Call Limit</label>
                        <input type="number" value={config.dailyCallLimit} readOnly />
                    </div>

                    <button className="btn btn-primary" style={{ width: 'fit-content' }}>Save Changes</button>
                </div>
            </div>
        </Layout>
    );
}
