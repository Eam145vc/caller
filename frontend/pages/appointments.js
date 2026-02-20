import { useState, useEffect } from 'react';
import Layout from '../components/Layout';

export default function Appointments() {
    const [appointments, setAppointments] = useState([]);

    useEffect(() => {
        const fetchAppointments = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
                const res = await fetch(`${apiUrl}/api/appointments`);
                const data = await res.json();
                setAppointments(data);
            } catch (err) {
                console.error("Error loading appointments:", err);
            }
        };
        fetchAppointments();
    }, []);

    return (
        <Layout>
            <h1>Appointments</h1>
            <div className="grid">
                {appointments.length === 0 ? <p>No appointments yet.</p> : null}
                {appointments.map(apt => (
                    <div className="card" key={apt.id} style={{ borderLeft: '4px solid var(--success)' }}>
                        <h3>{apt.scheduled_at}</h3>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '0.5rem 0' }}>{apt.lead_name}</div>
                        <p style={{ color: 'var(--text-secondary)' }}>{apt.notes}</p>
                        <div style={{ marginTop: '1rem' }}>
                            <span className="badge scheduled" style={{ textTransform: 'uppercase' }}>{apt.apt_status || 'SCHEDULED'}</span>
                        </div>
                    </div>
                ))}
            </div>
        </Layout>
    );
}
