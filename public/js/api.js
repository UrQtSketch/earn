/**
 * EarnRadar Unified API Client
 */

export const API = {
  // Authentication & Session
  async getSession() {
    const res = await fetch('/api/auth/me');
    return res.json();
  },

  async requestOTP(email, purpose = 'SIGNUP') {
    const res = await fetch('/api/auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, purpose })
    });
    return res.json();
  },

  async register(data) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return res.json();
  },

  async resetPassword(email, otp, newPassword) {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, newPassword })
    });
    return res.json();
  },

  async logout() {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    return res.json();
  },

  // User Profiles & Activity
  async getProfile() {
    const res = await fetch('/api/users/profile');
    return res.json();
  },

  async updateProfile(data) {
    const res = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async completeOnboarding(data) {
    const res = await fetch('/api/users/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async getPublicProfile(username) {
    const res = await fetch(`/api/users/${username}`);
    return res.json();
  },

  // Opportunities & Categories
  async getCategories() {
    const res = await fetch('/api/opportunities/categories');
    return res.json();
  },

  async getOpportunities(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/opportunities?${query}`);
    return res.json();
  },

  async getOpportunity(idOrSlug) {
    const res = await fetch(`/api/opportunities/${idOrSlug}`);
    return res.json();
  },

  async joinOpportunity(id) {
    const res = await fetch(`/api/opportunities/${id}/join`, { method: 'POST' });
    return res.json();
  },

  async leaveOpportunity(id) {
    const res = await fetch(`/api/opportunities/${id}/leave`, { method: 'POST' });
    return res.json();
  },

  async saveOpportunity(id) {
    const res = await fetch(`/api/opportunities/${id}/save`, { method: 'POST' });
    return res.json();
  },

  async compareOpportunities(ids) {
    const idList = Array.isArray(ids) ? ids.join(',') : ids;
    const res = await fetch(`/api/opportunities/compare?ids=${encodeURIComponent(idList)}`);
    return res.json();
  },

  async submitExperience(opportunityId, data) {
    const res = await fetch(`/api/opportunities/${opportunityId}/experience`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // 9-Step Submissions
  async getMySubmissions() {
    const res = await fetch('/api/submissions/my');
    return res.json();
  },

  async getSubmission(id) {
    const res = await fetch(`/api/submissions/${id}`);
    return res.json();
  },

  async submitMethod(formData, isDraft = false) {
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formData, isDraft })
    });
    return res.json();
  },

  async updateSubmission(id, formData, isDraft = false) {
    const res = await fetch(`/api/submissions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formData, isDraft })
    });
    return res.json();
  },

  async uploadProofFiles(formData) {
    const res = await fetch('/api/submissions/upload-proof', {
      method: 'POST',
      body: formData
    });
    return res.json();
  },

  // Discussions & Comments
  async postComment(opportunityId, content, parentId = null) {
    const res = await fetch(`/api/discussions/opportunity/${opportunityId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, parentId })
    });
    return res.json();
  },

  async deleteComment(commentId) {
    const res = await fetch(`/api/discussions/${commentId}`, { method: 'DELETE' });
    return res.json();
  },

  // Collaborations & Messaging
  async getCollaborations() {
    const res = await fetch('/api/collaborations');
    return res.json();
  },

  async sendCollaborationRequest(receiverId, opportunityId, message) {
    const res = await fetch('/api/collaborations/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverId, opportunityId, message })
    });
    return res.json();
  },

  async respondCollaboration(requestId, action) {
    const res = await fetch(`/api/collaborations/respond/${requestId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    return res.json();
  },

  async getConversations() {
    const res = await fetch('/api/messages/conversations');
    return res.json();
  },

  async getMessages(conversationId) {
    const res = await fetch(`/api/messages/conversations/${conversationId}`);
    return res.json();
  },

  async sendMessage(conversationId, recipientId, content) {
    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, recipientId, content })
    });
    return res.json();
  },

  // Notifications
  async getNotifications() {
    const res = await fetch('/api/notifications');
    return res.json();
  },

  async markNotificationRead(id) {
    const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    return res.json();
  },

  async markAllNotificationsRead() {
    const res = await fetch('/api/notifications/read-all', { method: 'POST' });
    return res.json();
  },

  async blockUser(targetUserId, action = 'BLOCK') {
    const res = await fetch('/api/messages/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, action })
    });
    return res.json();
  },

  // Reports
  async submitReport(targetType, targetId, reason, details) {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType, targetId, reason, details })
    });
    return res.json();
  },

  // Admin APIs
  async getAdminMetrics() {
    const res = await fetch('/api/admin/metrics');
    return res.json();
  },

  async getAdminUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/admin/users?${query}`);
    return res.json();
  },

  async updateAdminUserStatus(userId, data) {
    const res = await fetch(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async getAdminSubmissions(status = '') {
    const res = await fetch(`/api/admin/submissions?status=${status}`);
    return res.json();
  },

  async reviewAdminSubmission(id, action, adminFeedback = '', categoryId = '') {
    const res = await fetch(`/api/admin/submissions/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, adminFeedback, categoryId })
    });
    return res.json();
  },

  async getAdminClaims() {
    const res = await fetch('/api/admin/claims');
    return res.json();
  },

  async updateAdminClaim(claimId, status, adminNote = '') {
    const res = await fetch(`/api/admin/claims/${claimId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, adminNote })
    });
    return res.json();
  },

  async getAdminReports(status = '') {
    const res = await fetch(`/api/admin/reports?status=${status}`);
    return res.json();
  },

  async resolveAdminReport(reportId, status, resolution = '') {
    const res = await fetch(`/api/admin/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, resolution })
    });
    return res.json();
  },

  async getAdminAuditLogs() {
    const res = await fetch('/api/admin/audit-logs');
    return res.json();
  },

  async getAnalytics() {
    const res = await fetch('/api/analytics/overview');
    return res.json();
  },

  async getDevOutbox() {
    const res = await fetch('/api/auth/dev-outbox');
    return res.json();
  }
};
