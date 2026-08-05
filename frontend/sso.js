(function () {
  var statusEl = document.getElementById('sso-status')
  var query = new URLSearchParams(window.location.search)
  var ticket = query.get('ticket') || ''

  function setStatus(message, isError) {
    if (!statusEl) return
    statusEl.textContent = message
    statusEl.style.color = isError ? '#c0392b' : ''
  }

  function safeReturnPath(value) {
    var path = String(value || '/index.html')
    if (!path.startsWith('/') || path.startsWith('//') || path.indexOf('://') >= 0) {
      return '/index.html'
    }
    return path
  }

  function finishLogin(data) {
    var payload = data && data.data ? data.data : data
    if (!payload || !payload.token) throw new Error('登录响应无效')
    localStorage.setItem('token', payload.token)
    if (payload.user) {
      localStorage.setItem('openid', payload.user.openid || '')
      localStorage.setItem('userInfo', JSON.stringify(payload.user))
    }

    var returnPath = safeReturnPath(query.get('return'))
    window.history.replaceState(null, document.title, '/sso.html')
    window.location.replace(returnPath)
  }

  if (!ticket) {
    setStatus('登录票据缺失，请从小程序重新进入。', true)
    return
  }

  fetch('/api/auth/web-sso-exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket: ticket })
  })
    .then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok || !data || data.code !== 0) {
          throw new Error(data && data.message || '登录失败')
        }
        return data
      })
    })
    .then(finishLogin)
    .catch(function (error) {
      setStatus(error.message || '登录失败，请从小程序重新进入。', true)
    })
})()
