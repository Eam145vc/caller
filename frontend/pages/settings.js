import Layout from '../components/Layout';

export default function Settings() {
    return (
        <Layout>
            <h1>Settings</h1>
            <div className="card" style={{ marginTop: '2rem' }}>
                <h3>System Configuration</h3>
                <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Twilio Phone Number</label>
                        <input type="text" value="+1234567890" readOnly />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>OpenAI Model</label>
                        <select>
                            <option>GPT-4o Realtime</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Daily Call Limit</label>
                        <input type="number" value="50" />
                    </div>

                    <button className="btn btn-primary" style={{ width: 'fit-content' }}>Save Changes</button>
                </div>
            </div>
        </Layout>
    );
}
