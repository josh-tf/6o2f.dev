const q = new URLSearchParams(location.search);
const m = {
  cancelled: 'Sign-in cancelled.',
  state: 'Sign-in expired. Try again.',
  discord: 'Discord error. Try again.',
  suspended: 'This account is suspended. Contact the site owner if you think that is a mistake.',
}[q.get('error')];
document.getElementById('msg').textContent = m || '';
