(function(root, factory) {
  var api = factory(root);
  if (root) root.AuthUI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null, function(root) {
  'use strict';

  var state = {
    initialized: false,
    user: null,
    modalOpen: false,
    activeMode: 'signin'
  };

  function isConfigured(config) {
    return Boolean(
      config &&
      config.url &&
      config.key &&
      config.url !== 'YOUR_SUPABASE_URL' &&
      config.key !== 'YOUR_SUPABASE_PUBLISHABLE_KEY'
    );
  }

  function getClient() {
    return root && root.SupabaseClient ? root.SupabaseClient : null;
  }

  function formatUserLabel(email) {
    if (!email) return '我的账户';
    return String(email).split('@')[0] || '我的账户';
  }

  function getAuthModalMarkup() {
    return [
      '<div class="auth-modal hidden" id="auth-modal" aria-hidden="true">',
      '  <div class="auth-modal-backdrop" data-auth-close></div>',
      '  <div class="auth-modal-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">',
      '    <button class="auth-modal-close" type="button" aria-label="关闭" data-auth-close>×</button>',
      '    <p class="auth-kicker">COSMIC ACCOUNT</p>',
      '    <h2 class="auth-title" id="auth-title">登录后可同步收藏与笔记</h2>',
      '    <p class="auth-copy">使用邮箱注册或登录，你的星座收藏和笔记就能在不同设备之间同步。</p>',
      '    <div class="auth-tabs">',
      '      <button class="auth-tab active" type="button" data-auth-mode="signin">登录</button>',
      '      <button class="auth-tab" type="button" data-auth-mode="signup">注册</button>',
      '    </div>',
      '    <form class="auth-form" id="auth-form">',
      '      <label class="auth-label" for="auth-email">邮箱</label>',
      '      <input class="auth-input" id="auth-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>',
      '      <label class="auth-label" for="auth-password">密码</label>',
      '      <input class="auth-input" id="auth-password" name="password" type="password" autocomplete="current-password" placeholder="至少 6 位" required>',
      '      <p class="auth-hint" id="auth-mode-hint">输入邮箱和密码后即可登录。</p>',
      '      <div class="auth-actions">',
      '        <button class="auth-submit-btn" id="auth-submit-btn" type="submit">立即登录</button>',
      '      </div>',
      '      <p class="auth-status" id="auth-status" aria-live="polite"></p>',
      '    </form>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function ensureModal() {
    if (!root || !root.document) return null;

    var modal = root.document.getElementById('auth-modal');
    if (!modal) {
      var wrapper = root.document.createElement('div');
      wrapper.innerHTML = getAuthModalMarkup();
      modal = wrapper.firstChild;
      root.document.body.appendChild(modal);
    }
    return modal;
  }

  function setStatus(message, kind) {
    var status = root.document.getElementById('auth-status');
    if (!status) return;
    status.textContent = message || '';
    status.className = 'auth-status' + (kind ? ' is-' + kind : '');
  }

  function updateModeUi() {
    var tabs = root.document.querySelectorAll('.auth-tab');
    var submitBtn = root.document.getElementById('auth-submit-btn');
    var hint = root.document.getElementById('auth-mode-hint');
    var passwordInput = root.document.getElementById('auth-password');
    var isSignin = state.activeMode === 'signin';

    tabs.forEach(function(tab) {
      tab.classList.toggle('active', tab.getAttribute('data-auth-mode') === state.activeMode);
    });

    if (submitBtn) {
      submitBtn.textContent = isSignin ? '立即登录' : '创建账户';
    }
    if (hint) {
      hint.textContent = isSignin
        ? '输入邮箱和密码后即可登录。'
        : '注册后请到邮箱中完成验证，再回到这里登录。';
    }
    if (passwordInput) {
      passwordInput.setAttribute('autocomplete', isSignin ? 'current-password' : 'new-password');
    }
    setStatus('');
  }

  function setLoading(isLoading) {
    var submitBtn = root.document.getElementById('auth-submit-btn');
    var email = root.document.getElementById('auth-email');
    var password = root.document.getElementById('auth-password');
    if (submitBtn) {
      submitBtn.disabled = isLoading;
      submitBtn.textContent = isLoading
        ? (state.activeMode === 'signin' ? '登录中...' : '注册中...')
        : (state.activeMode === 'signin' ? '立即登录' : '创建账户');
    }
    if (email) email.disabled = isLoading;
    if (password) password.disabled = isLoading;
  }

  function renderNav() {
    if (!root || !root.document) return;

    var slot = root.document.getElementById('auth-slot');
    if (!slot) return;

    var configured = isConfigured(root.SupabaseConfig);
    var user = state.user;
    var buttonHtml;

    if (!configured) {
      buttonHtml =
        '<button class="auth-nav-btn auth-nav-btn-muted" type="button" id="auth-open-btn">' +
          '<span class="auth-nav-icon">◎</span>' +
          '<span class="auth-nav-label" data-mobile-label="配置">待配置</span>' +
        '</button>';
    } else if (user) {
      buttonHtml =
        '<div class="auth-nav-group">' +
          '<button class="auth-nav-btn" type="button" id="auth-open-btn">' +
            '<span class="auth-nav-icon">◎</span>' +
            '<span class="auth-nav-label" data-mobile-label="账户">' + escapeHtml(formatUserLabel(user.email)) + '</span>' +
          '</button>' +
          '<button class="auth-nav-btn auth-nav-btn-secondary" type="button" id="auth-logout-btn">退出</button>' +
        '</div>';
    } else {
      buttonHtml =
        '<button class="auth-nav-btn" type="button" id="auth-open-btn">' +
          '<span class="auth-nav-icon">◎</span>' +
          '<span class="auth-nav-label" data-mobile-label="登录">登录 / 注册</span>' +
        '</button>';
    }

    slot.innerHTML = buttonHtml;

    var openBtn = root.document.getElementById('auth-open-btn');
    if (openBtn) {
      openBtn.addEventListener('click', function() {
        if (!configured) {
          openModal('signin');
          setStatus('请先在 js/supabase-client.js 中填入 Supabase URL 和 Publishable Key。', 'warning');
          return;
        }
        if (user) {
          openModal('signin');
          setStatus('当前已登录邮箱：' + user.email, 'success');
          return;
        }
        openModal('signin');
      });
    }

    var logoutBtn = root.document.getElementById('auth-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', signOut);
    }
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function openModal(mode) {
    var modal = ensureModal();
    if (!modal) return;
    state.activeMode = mode || 'signin';
    state.modalOpen = true;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    updateModeUi();

    var email = root.document.getElementById('auth-email');
    if (email) {
      root.setTimeout(function() {
        email.focus();
      }, 0);
    }
  }

  function closeModal() {
    var modal = root.document.getElementById('auth-modal');
    if (!modal) return;
    state.modalOpen = false;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  async function refreshSession() {
    var client = getClient();
    if (!client || !client.auth) {
      state.user = null;
      renderNav();
      dispatchAuthChanged();
      return null;
    }

    var result = await client.auth.getUser();
    state.user = result && result.data ? result.data.user : null;
    renderNav();
    dispatchAuthChanged();
    return state.user;
  }

  function dispatchAuthChanged() {
    root.dispatchEvent(new root.CustomEvent('auth:changed', {
      detail: {
        user: state.user
      }
    }));
  }

  async function submitAuth(event) {
    event.preventDefault();

    var client = getClient();
    if (!client || !client.auth || !isConfigured(root.SupabaseConfig)) {
      setStatus('请先在 js/supabase-client.js 中填写正确的 Supabase 配置。', 'warning');
      return;
    }

    var email = root.document.getElementById('auth-email');
    var password = root.document.getElementById('auth-password');
    var userEmail = email ? email.value.trim() : '';
    var userPassword = password ? password.value : '';

    if (!userEmail || !userPassword) {
      setStatus('请完整填写邮箱和密码。', 'warning');
      return;
    }

    try {
      setLoading(true);

      if (state.activeMode === 'signin') {
        var signInResult = await client.auth.signInWithPassword({
          email: userEmail,
          password: userPassword
        });

        if (signInResult.error) throw signInResult.error;

        await refreshSession();
        setStatus('登录成功，正在同步你的收藏与笔记。', 'success');
        closeModal();
      } else {
        var signUpResult = await client.auth.signUp({
          email: userEmail,
          password: userPassword
        });

        if (signUpResult.error) throw signUpResult.error;

        setStatus('注册成功，请到邮箱完成验证后再登录。', 'success');
      }
    } catch (error) {
      setStatus(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }

  function getErrorMessage(error) {
    var message = error && error.message ? String(error.message) : '';

    if (!message) return '操作失败，请稍后重试。';
    if (message.indexOf('Invalid login credentials') !== -1) return '邮箱或密码不正确。';
    if (message.indexOf('Email not confirmed') !== -1) return '请先完成邮箱验证，再回来登录。';
    if (message.indexOf('User already registered') !== -1) return '这个邮箱已经注册过了，请直接登录。';
    if (message.indexOf('Password should be at least') !== -1) return '密码长度不足，请至少输入 6 位。';
    return message;
  }

  async function signOut() {
    var client = getClient();
    if (!client || !client.auth) return;

    try {
      await client.auth.signOut();
      await refreshSession();
    } catch (error) {
      setStatus(getErrorMessage(error), 'error');
    }
  }

  function bindModalEvents() {
    var modal = ensureModal();
    if (!modal) return;

    modal.addEventListener('click', function(event) {
      var target = event.target;
      if (target.hasAttribute('data-auth-close')) {
        closeModal();
        return;
      }

      var mode = target.getAttribute('data-auth-mode');
      if (mode) {
        state.activeMode = mode;
        updateModeUi();
      }
    });

    var form = root.document.getElementById('auth-form');
    if (form) {
      form.addEventListener('submit', submitAuth);
    }

    root.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && state.modalOpen) {
        closeModal();
      }
    });
  }

  async function init() {
    if (!root || !root.document) return;

    ensureModal();
    bindModalEvents();
    renderNav();

    if (state.initialized) {
      await refreshSession();
      return;
    }

    state.initialized = true;

    var client = getClient();
    if (client && client.auth) {
      client.auth.onAuthStateChange(function() {
        refreshSession();
      });
    }

    await refreshSession();
  }

  function getCurrentUser() {
    return state.user;
  }

  return {
    init: init,
    openModal: openModal,
    closeModal: closeModal,
    refreshSession: refreshSession,
    getCurrentUser: getCurrentUser,
    formatUserLabel: formatUserLabel,
    getAuthModalMarkup: getAuthModalMarkup,
    isConfigured: isConfigured
  };
});
