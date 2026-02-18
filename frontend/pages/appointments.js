import { useState, useEffect } from 'react';
import Layout from '../components/Layout';

export default function Appointments() {
    const [appointments, setAppointments] = useState([]);

    useEffect(() => {
        // Mock data -> Replace with API
        setAppointments([
            { id: 1, lead: 'Tienda Moda', time: '2024-05-21 10:00 AM', status: 'Scheduled', notes: 'Interested in e-commerce site.' }
        ]);
    }, []);

    return (
        <Layout>
            <h1>Appointments</h1>
            <div className="grid">
                {appointments.map(apt => (
                    <div className="card" key={apt.id} style={{ borderLeft: '4px solid var(--success)' }}>
                        <h3>{apt.time}</h3>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '0.5rem 0' }}>{apt.lead}</div>
                        <p style={{ color: 'var(--text-secondary)' }}>{apt.notes}</p>
                        <div style={{ marginTop: '1rem' }}>
                            <span className="badge scheduled">{apt.status}</span>
                        </div>
                    </div>
                ))}
            </div>
        </Layout>
    );
}
