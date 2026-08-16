export function renderPasswordResetPage(token: string): string {
  const safeToken = escapeHtml(token);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Reset your Cuppet password</title>
    <style>
      :root { color-scheme: light; font-family: Arial, sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f5f2; color: #25231f; }
      main { width: min(440px, calc(100% - 40px)); padding: 32px; background: #fff; border: 1px solid #e5e0d8; border-radius: 18px; box-sizing: border-box; }
      h1 { margin: 0 0 10px; font-size: 26px; }
      p { color: #6f6a62; line-height: 1.5; }
      label { display: block; margin: 20px 0 7px; font-size: 13px; font-weight: 700; }
      input { width: 100%; box-sizing: border-box; padding: 12px 13px; border: 1px solid #d8d1c7; border-radius: 10px; font-size: 16px; }
      button { width: 100%; margin-top: 24px; padding: 13px; border: 0; border-radius: 10px; background: #25231f; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; }
      button:disabled { opacity: .6; cursor: wait; }
      #status { min-height: 24px; margin-top: 18px; font-size: 14px; }
      .error { color: #a4382d; }
      .success { color: #28744c; }
      .hint { font-size: 13px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Set a new password</h1>
      <p>Choose a new password for your Cuppet account.</p>
      <form id="reset-form">
        <input type="hidden" name="token" value="${safeToken}">
        <label for="new-password">New password</label>
        <input id="new-password" name="newPassword" type="password" minlength="8" maxlength="128" autocomplete="new-password" required>
        <label for="confirm-password">Confirm password</label>
        <input id="confirm-password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required>
        <button id="submit" type="submit">Update password</button>
      </form>
      <div id="status" role="status" aria-live="polite"></div>
      <p class="hint">After updating your password, return to the Cuppet app and sign in again.</p>
    </main>
    <script>
      const form = document.getElementById('reset-form');
      const submit = document.getElementById('submit');
      const status = document.getElementById('status');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const newPassword = form.elements.newPassword.value;
        const confirmation = form.elements['confirm-password'].value;
        status.className = '';
        if (newPassword !== confirmation) {
          status.textContent = 'The passwords do not match.';
          status.className = 'error';
          return;
        }
        submit.disabled = true;
        status.textContent = 'Updating password...';
        try {
          const response = await fetch('/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ newPassword, token: form.elements.token.value })
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok || body.status !== true) {
            throw new Error('This reset link is invalid or has expired.');
          }
          form.reset();
          status.textContent = 'Password updated. You can return to Cuppet and sign in.';
          status.className = 'success';
        } catch (error) {
          status.textContent = error instanceof Error ? error.message : 'Password reset failed. Please try again.';
          status.className = 'error';
        } finally {
          submit.disabled = false;
        }
      });
    </script>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      })[character] ?? character
  );
}
