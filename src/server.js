import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { PORT, NODE_ENV } from './config/constants.js';
import { authenticate } from './middleware/authMiddleware.js';

// Route imports
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import opportunityRoutes from './routes/opportunities.js';
import submissionRoutes from './routes/submissions.js';
import discussionRoutes from './routes/discussions.js';
import collaborationRoutes from './routes/collaborations.js';
import messageRoutes from './routes/messages.js';
import reportRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import analyticsRoutes from './routes/analytics.js';
import notificationRoutes from './routes/notifications.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security Headers
app.use(helmet({
  contentSecurityPolicy: false, // Allows inline scripts & external fonts
  crossOriginEmbedderPolicy: false
}));

// CORS Configuration
app.use(cors({
  origin: true,
  credentials: true
}));

// Body & Cookie Parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Global Authentication Context
app.use(authenticate);

// Static Asset Directories
app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')));
app.use(express.static(path.resolve(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/collaborations', collaborationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);

// HTML Page Route Helpers
const publicDir = path.resolve(__dirname, '../public');

app.get('/login', (req, res) => res.sendFile(path.join(publicDir, 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(publicDir, 'signup.html')));
app.get('/verify-email', (req, res) => res.sendFile(path.join(publicDir, 'verify-email.html')));
app.get('/forgot-password', (req, res) => res.sendFile(path.join(publicDir, 'forgot-password.html')));
app.get('/onboarding', (req, res) => res.sendFile(path.join(publicDir, 'onboarding.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(publicDir, 'dashboard.html')));
app.get('/opportunities', (req, res) => res.sendFile(path.join(publicDir, 'opportunities.html')));
app.get('/opportunities/:slug', (req, res) => res.sendFile(path.join(publicDir, 'opportunity-detail.html')));
app.get('/share-method', (req, res) => res.sendFile(path.join(publicDir, 'share-method.html')));
app.get('/my-submissions', (req, res) => res.sendFile(path.join(publicDir, 'my-submissions.html')));
app.get('/my-opportunities', (req, res) => res.sendFile(path.join(publicDir, 'my-opportunities.html')));
app.get('/collaborations', (req, res) => res.sendFile(path.join(publicDir, 'collaborations.html')));
app.get('/messages', (req, res) => res.sendFile(path.join(publicDir, 'messages.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(publicDir, 'profile.html')));
app.get('/profile/:username', (req, res) => res.sendFile(path.join(publicDir, 'profile.html')));
app.get('/settings', (req, res) => res.sendFile(path.join(publicDir, 'settings.html')));

// Admin UI Routes
app.get('/admin', (req, res) => res.sendFile(path.join(publicDir, 'admin/index.html')));
app.get('/admin/users', (req, res) => res.sendFile(path.join(publicDir, 'admin/users.html')));
app.get('/admin/submissions', (req, res) => res.sendFile(path.join(publicDir, 'admin/submissions.html')));
app.get('/admin/claims', (req, res) => res.sendFile(path.join(publicDir, 'admin/claims.html')));
app.get('/admin/reports', (req, res) => res.sendFile(path.join(publicDir, 'admin/reports.html')));
app.get('/admin/analytics', (req, res) => res.sendFile(path.join(publicDir, 'admin/analytics.html')));
app.get('/admin/audit-log', (req, res) => res.sendFile(path.join(publicDir, 'admin/audit-log.html')));

// Global Fallback to Index
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'API endpoint not found' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Central Error Handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================================`);
  console.log(`🚀 EarnRadar Server running at http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`========================================================\n`);
});
