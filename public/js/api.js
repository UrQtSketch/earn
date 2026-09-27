function getAuthHeaders(extra = {}) {
  const headers = { ...extra };
  const token = localStorage.getItem('earnradar_token');
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request(url, options = {}) {
  const opts = { ...options };
  opts.credentials = 'include';
  opts.headers = getAuthHeaders(opts.headers || {});
  
  const res = await fetch(url, opts);
  return res.json();
}

export const API = {
  // Authentication & Session
  async getSession() {
    return request('/api/auth/me');
  },

  async requestOTP(email, purpose = 'SIGNUP') {
    return request('/api/auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, purpose })
    });
  },

  async register(data) {
    const res = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.success && res.token) {
      localStorage.setItem('earnradar_token', res.token);
    }
    return res;
  },

  async login(email, password) {
    const res = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (res.success && res.token) {
      localStorage.setItem('earnradar_token', res.token);
    }
    return res;
  },

  async resetPassword(email, otp, newPassword) {
    return request('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, newPassword })
    });
  },

  async logout() {
    localStorage.removeItem('earnradar_token');
    return request('/api/auth/logout', { method: 'POST' });
  },

  // User Profiles & Activity
  async getProfile() {
    return request('/api/users/profile');
  },

  async updateProfile(data) {
    return request('/api/users/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  async completeOnboarding(data) {
    return request('/api/users/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  async getPublicProfile(username) {
    return request(`/api/users/${username}`);
  },

  // Opportunities & Categories
  async getCategories() {
    return request('/api/opportunities/categories');
  },

  async getOpportunities(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/api/opportunities?${query}`);
  },

  async getOpportunity(idOrSlug) {
    return request(`/api/opportunities/${idOrSlug}`);
  },

  async joinOpportunity(id) {
    return request(`/api/opportunities/${id}/join`, { method: 'POST' });
  },

  async leaveOpportunity(id) {
    return request(`/api/opportunities/${id}/leave`, { method: 'POST' });
  },

  async saveOpportunity(id) {
    return request(`/api/opportunities/${id}/save`, { method: 'POST' });
  },

  async compareOpportunities(ids) {
    const idList = Array.isArray(ids) ? ids.join(',') : ids;
    return request(`/api/opportunities/compare?ids=${encodeURIComponent(idList)}`);
  },

  async submitExperience(opportunityId, data) {
    return request(`/api/opportunities/${opportunityId}/experience`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  async postComment(opportunityId, content, parentId = null) {
    return request(`/api/discussions/opportunity/${opportunityId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, parentId })
    });
  },

  async deleteComment(commentId) {
    return request(`/api/discussions/${commentId}`, { method: 'DELETE' });
  },

  async matchOpportunities(answers) {
    return request('/api/opportunities/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers)
    });
  },

  // 9-Step Submissions
  async getMySubmissions() {
    return request('/api/submissions/my');
  },

  async getSubmission(id) {
    return request(`/api/submissions/${id}`);
  },

  async submitMethod(formData, isDraft = false) {
    return request('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formData, isDraft })
    });
  },

  async updateSubmission(id, formData, isDraft = false) {
    return request(`/api/submissions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formData, isDraft })
    });
  },

  async uploadProofFiles(formData) {
    return request('/api/submissions/upload-proof', {
      method: 'POST',
      body: formData
    });
  },

  // Collaborations & Messaging
  async getCollaborations() {
    return request('/api/collaborations');
  },

  async sendCollaborationRequest(receiverId, opportunityId, message) {
    return request('/api/collaborations/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverId, opportunityId, message })
    });
  },

  async respondCollaboration(requestId, action) {
    return request(`/api/collaborations/respond/${requestId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
  },

  async getConversations() {
    return request('/api/messages/conversations');
  },

  async getMessages(conversationId) {
    return request(`/api/messages/conversations/${conversationId}`);
  },

  async sendMessage(conversationId, recipientId, content) {
    return request('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, recipientId, content })
    });
  },

  // Notifications
  async getNotifications() {
    return request('/api/notifications');
  },

  async markNotificationRead(id) {
    return request(`/api/notifications/${id}/read`, { method: 'PATCH' });
  },

  async markAllNotificationsRead() {
    return request('/api/notifications/read-all', { method: 'POST' });
  },

  async blockUser(targetUserId, action = 'BLOCK') {
    return request('/api/messages/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, action })
    });
  },

  // Reports
  async submitReport(targetType, targetId, reason, details, evidenceUrl = null) {
    return request('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType, targetId, reason, details, evidenceUrl })
    });
  },

  // Admin APIs
  async getAdminMetrics() {
    return request('/api/admin/metrics');
  },

  async getAdminUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/api/admin/users?${query}`);
  },

  async updateAdminUserStatus(userId, data) {
    return request(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  async getAdminSubmissions(status = '') {
    return request(`/api/admin/submissions?status=${status}`);
  },

  async reviewAdminSubmission(id, action, adminFeedback = '', categoryId = '') {
    return request(`/api/admin/submissions/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, adminFeedback, categoryId })
    });
  },

  async getAdminClaims() {
    return request('/api/admin/claims');
  },

  async updateAdminClaim(claimId, status, adminNote = '') {
    return request(`/api/admin/claims/${claimId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, adminNote })
    });
  },

  async getAdminReports(status = '') {
    return request(`/api/admin/reports?status=${status}`);
  },

  async resolveAdminReport(reportId, status, resolution = '') {
    return request(`/api/admin/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, resolution })
    });
  },

  async getAdminOpportunities(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/api/admin/opportunities?${query}`);
  },

  async updateAdminOpportunityHealth(opportunityId, data) {
    return request(`/api/admin/opportunities/${opportunityId}/health`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  async getAdminEvidence(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/api/admin/evidence?${query}`);
  },

  async updateAdminEvidence(evidenceId, data) {
    return request(`/api/admin/evidence/${evidenceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  async getAdminAuditLogs() {
    return request('/api/admin/audit-logs');
  },

  async getAnalytics() {
    return request('/api/analytics/overview');
  },

  async getDevOutbox() {
    return request('/api/auth/dev-outbox');
  }
};
