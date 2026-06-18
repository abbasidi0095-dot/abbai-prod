var API_BASE = window.location.origin + '/api';

function getToken() {
  return localStorage.getItem('abbai_token') || sessionStorage.getItem('abbai_token');
}

function setToken(token, remember) {
  var storage = remember ? localStorage : sessionStorage;
  storage.setItem('abbai_token', token);
}

function clearToken() {
  localStorage.removeItem('abbai_token');
  sessionStorage.removeItem('abbai_token');
}

function getHeaders(contentType) {
  var headers = {};
  if (contentType !== false) headers['Content-Type'] = 'application/json';
  var token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return headers;
}

function api(path, options) {
  options = options || {};
  var url = API_BASE + path;
  var isFormData = options.body instanceof FormData;
  var headers;
  if (isFormData) {
    headers = { Authorization: getHeaders(false).Authorization };
  } else {
    headers = Object.assign({}, getHeaders(options.body ? true : false), options.headers || {});
  }

  return fetch(url, Object.assign({}, options, { headers: headers })).then(function (res) {
    if (res.status === 401) {
      clearToken();
      window.location.href = '/login.html';
      return;
    }

    var contentTypeHeader = res.headers.get('content-type') || '';
    var isJson = contentTypeHeader.indexOf('application/json') !== -1;
    return (isJson ? res.json() : Promise.resolve(null)).then(function (data) {
      if (!res.ok) {
        var err = new Error((data && data.message) || res.statusText);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    });
  });
}

function login(email, password, remember) {
  return api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email, password: password }),
  }).then(function (data) {
    setToken(data.access_token, remember);
    return data;
  });
}

function signup(email, password, fullName) {
  return api('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email: email, password: password, fullName: fullName }),
  }).then(function (data) {
    if (data.access_token) setToken(data.access_token, false);
    return data;
  });
}

function getMe() {
  return api('/auth/me');
}

function logout() {
  clearToken();
  window.location.href = '/login.html';
}

function getConversations() {
  return api('/history');
}

function getConversation(id) {
  return api('/conversation/' + id);
}

function createConversation(title) {
  return api('/conversation', {
    method: 'POST',
    body: JSON.stringify({ title: title }),
  });
}

function deleteConversation(id) {
  return api('/conversation/' + id, { method: 'DELETE' });
}

function patchConversation(id, data) {
  return api('/conversation/' + id, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

function sendChat(payload) {
  return api('/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function uploadFile(file, conversationId) {
  var formData = new FormData();
  formData.append('file', file);
  var url = conversationId ? '/attachments?conversationId=' + conversationId : '/attachments';
  return api(url, {
    method: 'POST',
    body: formData,
    headers: {},
  });
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTimestamp(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderMarkdown(text) {
  var html = escapeHtml(text);
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="font-mono-code text-mono-code bg-black/30 px-1.5 py-0.5 rounded text-primary-fixed-dim">$1</code>')
    .replace(/```([\s\S]*?)```/g, function (_, code) {
      return '<pre class="p-4 overflow-x-auto bg-surface-container/30 backdrop-blur-md rounded-xl border border-white/10 my-4"><code class="font-mono-code text-mono-code text-on-surface">' + code.replace(/^\n/, '') + '</code></pre>';
    })
    .replace(/^### (.*$)/gim, '<h3 class="font-headline-md text-headline-md text-primary mt-6 mb-3">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="font-headline-md text-headline-md text-primary mt-6 mb-3">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="font-display-lg text-display-lg text-primary mt-6 mb-3">$1</h1>')
    .replace(/\n/g, '<br>');
  return html;
}
