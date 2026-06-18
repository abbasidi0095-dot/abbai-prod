document.addEventListener('DOMContentLoaded', function () {
  var publicPages = ['/login.html', '/signup.html'];
  var current = window.location.pathname;
  var token = getToken();

  if (publicPages.indexOf(current) === -1 && !token) {
    window.location.href = '/login.html';
    return;
  }

  if (publicPages.indexOf(current) !== -1 && token) {
    window.location.href = '/chat.html';
    return;
  }

  if (token && publicPages.indexOf(current) === -1) {
    getMe().then(function (data) {
      var user = data.user;
      window.abbaiUser = user;
      updateUserUI(user);
    }).catch(function (err) {
      console.error(err);
      clearToken();
      window.location.href = '/login.html';
    });
  }
});

function updateUserUI(user) {
  user = user || {};
  var profile = user.profile || {};
  var displayName = profile.fullName || user.email || 'User';
  var email = user.email || '';

  document.querySelectorAll('[data-user-name]').forEach(function (el) {
    el.textContent = displayName;
  });
  document.querySelectorAll('[data-user-email]').forEach(function (el) {
    el.textContent = email;
  });
}
