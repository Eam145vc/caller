import { useState, useEffect } from 'react';
import Layout from '../components/Layout';

export default function Calls() {
    const [calls, setCalls] = useState([]);

    useEffect(() => {
        // Mock data -> Replace with fetch('/api/calls')
        setCalls([
            { id: 1, lead_name: 'Restaurante El Fogon', outcome: 'Voicemail', start_time: '2024-05-20 14:30', duration: '0:45', transcript: 'Machine detected...' },
            { id: 2, lead_name: 'Tienda Moda', outcome: 'Appointment Set', start_time: '2024-05-20 15:00', duration: '3:20', transcript: 'User: Hello? AI: Hola...' },
        ]);
    }, []);

    return (
        <Layout>
            <h1>Call History</h1>
            <div className="card" style={{ marginTop: '2rem' }}>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Lead</th>
                                <th>Date/Time</th>
                                <th>Duration</th>
                                <th>Outcome</th>
                                <th>Transcript</th>
                            </tr>
                        </thead>
                        <tbody>
                            {calls.map(call => (
                                <tr key={call.id}>
                                    <td>{call.lead_name}</td>
                                    <td>{call.start_time}</td>
                                    <td>{call.duration}</td>
                                    <td><span className="badge">{call.outcome}</span></td>
                                    <td>
                                        <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>
                                            View Transcript
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
}
