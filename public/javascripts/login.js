const loginForm = document.getElementById('loginForm');
const verifyForm = document.getElementById('verifyForm');
const verifySection = document.getElementById('verifySection');
const errorMsg = document.getElementById('errorMsg');
const successMsg = document.getElementById('successMsg');
const loginBtn = document.getElementById('loginBtn');
const verifyBtn = document.getElementById('verifyBtn');
const resendBtn = document.getElementById('resendBtn');
const emailSentTo = document.getElementById('emailSentTo');
const verificationCodeInput = document.getElementById('verificationCode');

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
}

function showSuccess(msg) {
  successMsg.textContent = msg;
  successMsg.classList.remove('hidden');
  setTimeout(() => successMsg.classList.add('hidden'), 3000);
}

function hideMessages() {
  errorMsg.classList.add('hidden');
  successMsg.classList.add('hidden');
}

// Only allow digits in OTP input
verificationCodeInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
});

// ======================= STEP 1: LOGIN WITH EMAIL + PASSWORD =======================
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMessages();
  loginBtn.disabled = true;
  loginBtn.innerHTML = '⏳ Verifying...';

  const payload = {
    username: document.getElementById('username').value,
    password: document.getElementById('password').value,
  };

  try {
    const res = await fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include', // CRITICAL: Send cookies with request
    });

    const data = await res.json();

    if (!data.ok) {
      showError(data.error || 'Login failed');
      loginBtn.disabled = false;
      loginBtn.innerHTML = '🚀 Login';
      return;
    }

    // Show verification section
    emailSentTo.textContent = `Code sent to ${data.username}`;
    verifySection.classList.remove('hidden');
    loginForm.classList.add('hidden');
    showSuccess('Code sent to your email');
  } catch (err) {
    console.error('Login error:', err);
    showError('Network error - please try again');
    loginBtn.disabled = false;
    loginBtn.innerHTML = '🚀 Login';
  }
});

// ======================= STEP 2: VERIFY OTP =======================
verifyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMessages();
  verifyBtn.disabled = true;
  verifyBtn.innerHTML = '⏳ Verifying...';

  const verificationCode = verificationCodeInput.value;

  if (!verificationCode || verificationCode.length !== 6) {
    showError('Please enter a valid 6-digit code');
    verifyBtn.disabled = false;
    verifyBtn.innerHTML = '✅ Verify & Login';
    return;
  }

  const payload = {
    verificationCode,
  };

  try {
    const res = await fetch('/admin/login/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include', // CRITICAL: Send cookies with request
    });

    const data = await res.json();

    if (!data.ok) {
      showError(data.error || 'Verification failed');
      verifyBtn.disabled = false;
      verifyBtn.innerHTML = '✅ Verify & Login';
      return;
    }

    // Success - redirect to dashboard
    showSuccess('✅ Login successful! Redirecting...');
    setTimeout(() => {
      window.location.href = data.redirect || '/admin/dashboard';
    }, 1000);
  } catch (err) {
    console.error('Verify error:', err);
    showError('Network error - please try again');
    verifyBtn.disabled = false;
    verifyBtn.innerHTML = '✅ Verify & Login';
  }
});

// ======================= RESEND OTP =======================
resendBtn.addEventListener('click', async () => {
  hideMessages();
  resendBtn.disabled = true;
  resendBtn.textContent = '⏳ Sending...';

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  if (!username || !password) {
    showError('Please enter email and password first');
    resendBtn.disabled = false;
    resendBtn.textContent = '🔄 Resend';
    return;
  }

  const payload = {
    username,
    password,
  };

  try {
    const res = await fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include', // CRITICAL: Send cookies with request
    });

    const data = await res.json();

    if (data.ok) {
      showSuccess('✅ New code sent to your email');
      verificationCodeInput.value = ''; // Clear OTP field
      verificationCodeInput.focus(); // Focus on OTP input
    } else {
      showError(data.error || 'Failed to resend code');
    }
  } catch (err) {
    console.error('Resend error:', err);
    showError('Network error - please try again');
  } finally {
    resendBtn.disabled = false;
    resendBtn.textContent = '🔄 Resend';
  }
});
