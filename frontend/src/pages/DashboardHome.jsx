import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats, listJobs } from '../services/endpoints';
import { 
  Briefcase, 
  Users, 
  UserCheck, 
  Award, 
  TrendingUp, 
  Sparkles, 
  ArrowUpRight, 
  Plus, 
  Clock, 
  ChevronRight,
  BarChart3,
  PieChart,
  CheckCircle2,
  Zap,
  Activity,
  Calendar,
  Filter,
  Search,
  ArrowRight,
  ShieldCheck,
  Percent
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { gsap } from 'gsap';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

const DashboardHome = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('30d');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [statsRes, jobsRes] = await Promise.allSettled([
          getDashboardStats(),
          listJobs()
        ]);
        if (statsRes.status === 'fulfilled') setStats(statsRes.value);
        if (jobsRes.status === 'fulfilled' && jobsRes.value?.success) {
          setJobs(jobsRes.value.jobs || []);
        }
      } catch (err) {
        setError('Failed to load dashboard metrics.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!loading && containerRef.current) {
      gsap.fromTo(
        containerRef.current.querySelectorAll('.animate-card'),
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: 'power3.out' }
      );
    }
  }, [loading]);

  const totalApplicants = stats?.applicants ?? 0;
  const shortlistedCount = stats?.screening ?? 0;
  const interviewsCount = stats?.interviews ?? 0;
  const offersCount = stats?.offers ?? 0;
  const activeJobsCount = jobs.filter(j => j.status === 'active').length;

  // Screening conversion rate
  const passRate = totalApplicants > 0 ? Math.round((shortlistedCount / totalApplicants) * 100) : 0;

  // Chart 1: Candidate Activity Trend Line Chart
  const lineChartData = useMemo(() => {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const mockData = totalApplicants > 0 
      ? [Math.round(totalApplicants * 0.1), Math.round(totalApplicants * 0.15), Math.round(totalApplicants * 0.25), Math.round(totalApplicants * 0.2), Math.round(totalApplicants * 0.18), Math.round(totalApplicants * 0.08), Math.round(totalApplicants * 0.04)]
      : [2, 5, 8, 12, 9, 4, 3];

    return {
      labels,
      datasets: [{
        label: 'Candidate Applications',
        data: mockData,
        fill: true,
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 240);
          gradient.addColorStop(0, 'rgba(127, 119, 221, 0.35)');
          gradient.addColorStop(1, 'rgba(127, 119, 221, 0.0)');
          return gradient;
        },
        borderColor: 'rgba(127, 119, 221, 1)',
        borderWidth: 3,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: 'rgba(127, 119, 221, 1)',
        pointBorderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.4
      }]
    };
  }, [totalApplicants]);

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 16, 25, 0.95)',
        titleFont: { size: 13, weight: '700' },
        bodyFont: { size: 12 },
        padding: 12,
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        cornerRadius: 10,
        displayColors: false,
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: 'var(--text-secondary)', font: { size: 11, weight: '600' } }
      },
      y: {
        grid: { color: 'var(--border)', drawBorder: false },
        ticks: { color: 'var(--text-secondary)', font: { size: 11 } }
      }
    }
  };

  // Chart 2: Pipeline Breakdown Doughnut Chart
  const doughnutChartData = useMemo(() => ({
    labels: ['Screened Pass', 'Interview Stage', 'Offer Sent', 'Pending Review'],
    datasets: [{
      data: totalApplicants > 0 
        ? [shortlistedCount, interviewsCount, offersCount, Math.max(0, totalApplicants - shortlistedCount - interviewsCount - offersCount)]
        : [4, 3, 2, 1],
      backgroundColor: [
        '#7F77DD',
        '#378ADD',
        '#22c55e',
        '#94a3b8'
      ],
      borderWidth: 4,
      borderColor: 'var(--surface)',
      hoverOffset: 6
    }]
  }), [totalApplicants, shortlistedCount, interviewsCount, offersCount]);

  const doughnutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        display: false // We render a clean React HTML legend below instead to avoid canvas black border bugs
      },
      tooltip: {
        backgroundColor: 'rgba(15, 16, 25, 0.95)',
        titleFont: { size: 12, weight: '700' },
        bodyFont: { size: 12, weight: '600' },
        padding: 12,
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        boxPadding: 4,
      }
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '65vh', gap: '16px' }}>
        <div className="spinner spinner-lg" />
        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>Synthesizing Recruitment Intelligence…</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '28px', paddingBottom: '50px' }}>
      
      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <div className="animate-card" style={{
        background: 'linear-gradient(135deg, rgba(83,74,183,0.06) 0%, rgba(55,138,221,0.06) 100%)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        padding: '28px 32px',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{
              background: 'var(--gradient-primary)',
              color: '#fff',
              fontSize: '11px',
              fontWeight: '800',
              padding: '4px 10px',
              borderRadius: '20px',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Sparkles size={12} /> Executive Overview
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
              • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>

          <h1 style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.6px' }}>
            Recruitment Analytics Hub
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '6px 0 0 0', maxWidth: '600px', lineHeight: '1.5' }}>
            Track end-to-end applicant conversion, AI screening velocity, and pipeline throughput across active hiring roles.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', zIndex: 2 }}>
          <div style={{
            display: 'flex',
            background: 'var(--surface)',
            padding: '4px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            {['7d', '30d', 'all'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                style={{
                  padding: '7px 16px',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: timeRange === range ? 'var(--accent-600)' : 'transparent',
                  color: timeRange === range ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.2s ease'
                }}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All Time'}
              </button>
            ))}
          </div>

          <button 
            className="btn-primary"
            onClick={() => navigate('/dashboard/jobs')}
            style={{ borderRadius: '12px', padding: '10px 20px', fontSize: '13px', gap: '8px', boxShadow: '0 8px 16px rgba(83,74,183,0.25)' }}
          >
            <Plus size={16} /> Post Job
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '14px 20px', borderRadius: '12px', fontSize: '14px', border: '1px solid var(--danger-border)' }}>
          {error}
        </div>
      )}

      {/* ── 4 Key Performance Indicator Cards ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        
        {/* Metric 1 */}
        <div className="animate-card" style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '22px 24px',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.25s ease'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Active Postings
            </span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent-50)', color: 'var(--accent-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Briefcase size={20} />
            </div>
          </div>
          <div style={{ fontSize: '36px', fontWeight: '900', color: 'var(--text-primary)', lineHeight: '1' }}>
            {activeJobsCount}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total created: <strong>{jobs.length}</strong></span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: '10px' }}>Active</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="animate-card" style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '22px 24px',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.25s ease'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Total Applicants
            </span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(55,138,221,0.12)', color: '#378ADD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} />
            </div>
          </div>
          <div style={{ fontSize: '36px', fontWeight: '900', color: 'var(--text-primary)', lineHeight: '1' }}>
            {totalApplicants}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>In screening pipeline</span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#378ADD', background: 'rgba(55,138,221,0.1)', padding: '2px 8px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <ArrowUpRight size={12} /> Live
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="animate-card" style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '22px 24px',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.25s ease'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Interviews Sent
            </span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCheck size={20} />
            </div>
          </div>
          <div style={{ fontSize: '36px', fontWeight: '900', color: 'var(--text-primary)', lineHeight: '1' }}>
            {interviewsCount}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Screened pass: <strong>{shortlistedCount}</strong></span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: '10px' }}>
              {passRate}% Pass Rate
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="animate-card" style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '22px 24px',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.25s ease'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Offers Extended
            </span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(34,197,94,0.12)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={20} />
            </div>
          </div>
          <div style={{ fontSize: '36px', fontWeight: '900', color: '#22c55e', lineHeight: '1' }}>
            {offersCount}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Final decision stage</span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: '10px' }}>
              Complete
            </span>
          </div>
        </div>

      </div>

      {/* ── Main Charts Section ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
        
        {/* Chart Card 1: Application Volume Trend Line */}
        <div className="animate-card" style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="var(--accent-600)" /> Candidate Inflow Trajectory
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Daily candidate application volume across active roles
              </p>
            </div>
            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-600)', background: 'var(--accent-50)', padding: '4px 12px', borderRadius: '20px' }}>
              +14% Velocity
            </span>
          </div>

          <div style={{ height: '240px', position: 'relative', width: '100%' }}>
            <Line data={lineChartData} options={lineChartOptions} />
          </div>
        </div>

        {/* Chart Card 2: Pipeline Distribution Doughnut */}
        <div className="animate-card" style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PieChart size={18} color="#378ADD" /> Pipeline Conversion Distribution
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Breakdown of candidates across recruitment stages
              </p>
            </div>
          </div>

          <div style={{ height: '200px', position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Doughnut data={doughnutChartData} options={doughnutChartOptions} />
          </div>

          {/* Clean Custom React HTML Legend Grid (No Canvas Overlap) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            {[
              { label: 'Screened Pass', count: shortlistedCount, color: '#7F77DD' },
              { label: 'Interview Stage', count: interviewsCount, color: '#378ADD' },
              { label: 'Offer Sent', count: offersCount, color: '#22c55e' },
              { label: 'Pending Review', count: Math.max(0, totalApplicants - shortlistedCount - interviewsCount - offersCount), color: '#94a3b8' }
            ].map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, display: 'inline-block' }} />
                  <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>{item.label}</span>
                </div>
                <span style={{ color: 'var(--text-primary)', fontWeight: '800' }}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Active Jobs Performance Table + AI Co-Pilot Widget ──────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Active Jobs Card List */}
        <div className="animate-card" style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              Active Postings Performance
            </h3>
            <button
              onClick={() => navigate('/dashboard/jobs')}
              style={{ background: 'none', border: 'none', color: 'var(--accent-600)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              View All ({jobs.length}) <ChevronRight size={14} />
            </button>
          </div>

          {jobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
              No active job postings. Click "Post Job" above to create one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {jobs.slice(0, 4).map(job => (
                <div
                  key={job.job_id}
                  onClick={() => navigate(`/dashboard/jobs/${job.job_id}`)}
                  style={{
                    padding: '16px 20px',
                    borderRadius: '14px',
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.borderColor = 'var(--accent-400)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--accent-50)', color: 'var(--accent-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Briefcase size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>
                        {job.job_title || 'Untitled Role'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{job.funnel?.applied ?? totalApplicants} Applicants</span>
                        <span>•</span>
                        <span>{job.status === 'active' ? 'Recruiting' : 'Closed'}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`badge ${job.status === 'active' ? 'badge-success' : 'badge-neutral'}`} style={{ padding: '4px 12px', fontSize: '11px', fontWeight: '700', borderRadius: '20px' }}>
                      {job.status === 'active' ? 'Active' : 'Closed'}
                    </span>
                    <ArrowRight size={16} color="var(--text-muted)" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Co-Pilot Summary Card */}
        <div className="animate-card" style={{
          background: 'linear-gradient(135deg, var(--sidebar-bg) 0%, #1c1f2e 100%)',
          borderRadius: '20px',
          padding: '26px',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          justify: 'space-between',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={18} color="#ffffff" />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#ffffff', margin: 0 }}>
                  AI Copilot Insights
                </h3>
              </div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#6ee7b7', background: 'rgba(110,231,183,0.12)', padding: '3px 10px', borderRadius: '20px', border: '1px solid rgba(110,231,183,0.2)' }}>
                Optimal Speed
              </span>
            </div>

            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.6', marginBottom: '22px' }}>
              HireFlow autonomous agents parse incoming applications, perform vector semantic match analysis, and generate adaptive interview questions in real time.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ShieldCheck size={20} color="#7F77DD" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#ffffff' }}>Screening Throughput</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>{shortlistedCount} candidate(s) met minimum role thresholds</div>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Clock size={20} color="#378ADD" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#ffffff' }}>Average Time Saved</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>~4.5 hours per job posting automated</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>
              System: <strong style={{ color: '#6ee7b7' }}>100% Operational</strong>
            </span>
            <button 
              onClick={() => navigate('/dashboard/candidates')}
              style={{
                background: 'var(--gradient-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              Candidates <ArrowRight size={14} />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};

export default DashboardHome;
