import Head from 'next/head';
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Link from 'next/link';

export default function Home() {
    const [stats, setStats] = useState({
        totalLeads: 0,
        totalCalls: 0,
        appointments: 0
    });

    useEffect(() => {
        // Mock data for now, replace with API call
        // fetch('http://localhost:3000/api/dashboard/stats').then...
        setStats({
            totalLeads: 124,
            totalCalls: 45,
            appointments: 3
        });
    }, []);

    return (
        <Layout>
            <Head>
                <title>Dashboard | Cold Caller AI</title>
            </Head>

            <div style={{ marginBottom: '2rem' }}>
                <h1>Dashboard Overview</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Welcome back, ready to close some deals?</p>
            </div>

            <div className="grid">
                <div className="card">
                    <div className="stat-label">Total Leads Scraped</div>
                    <div className="stat-value">{stats.totalLeads}</div>
                </div>
                <div className="card">
                    <div className="stat-label">Calls Made</div>
                    <div className="stat-value">{stats.totalCalls}</div>
                </div>
                <div className="card">
                    <div className="stat-label">Appointments Scheduled</div>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.appointments}</div>
                </div>
                <div className="card">
                    <div className="stat-label">Conversion Rate</div>
                    <div className="stat-value">{(stats.appointments / (stats.totalCalls || 1) * 100).toFixed(1)}%</div>
                </div>
            </div>

            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3>Recent Activity</h3>
                    <Link href="/calls" className="btn btn-outline">View All History</Link>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Business</th>
                            <th>Status</th>
                            <th>Time</th>
                            <th>Outcome</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Restaurante El Fogon</td>
                            <td><span className="badge contacted">Contacted</span></td>
                            <td>2 mins ago</td>
                            <td>Voicemail</td>
                        </tr>
                        <tr>
                            <td>Tienda de Ropa Moda</td>
                            <td><span className="badge scheduled">Scheduled</span></td>
                            <td>1 hour ago</td>
                            <td>Appointment set for tomorrow</td>
                        </tr>
                        <tr>
                            <td>Panaderia Central</td>
                            <td><span className="badge not_interested">Not Interested</span></td>
                            <td>3 hours ago</td>
                            <td>Hangup</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}
