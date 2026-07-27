/**
 * CorreTop Lead Capture — v1
 *
 * Static embed script. Paste before </body> on any landing page.
 * Requires: <form data-corretop-form> with inputs named nome, telefone, email, etc.
 *
 * Usage:
 *   <script src="https://app.corretop.com.br/embed/lead-form.js"
 *           data-token="ctp_live_..."
 *           data-redirect="/obrigado"></script>
 */
(function () {
  "use strict";

  var ENDPOINT_BASE = "/api/webhooks/leads/";
  var HONEYPOT_FIELD = "website";

  function getScriptEl() {
    return document.currentScript || document.querySelector("script[data-token]");
  }

  function mapFields(form) {
    var mapped = {};
    var inputs = form.querySelectorAll("input, select, textarea");
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      var name = el.name;
      var alias = el.getAttribute("data-corretop-field");
      if (!name && !alias) continue;

      // Prefer data-corretop-field, fall back to name
      var key = alias || name;
      var val = el.value;
      if (key && val) {
        mapped[key] = val;
      }
    }
    return mapped;
  }

  function isHoneypotFilled(data) {
    return !!(data[HONEYPOT_FIELD] && data[HONEYPOT_FIELD].trim().length > 0);
  }

  function handleSubmit(e) {
    var form = e.target;
    if (!form || !form.matches || !form.matches("[data-corretop-form]")) return;

    e.preventDefault();

    var script = getScriptEl();
    if (!script) return;

    var token = script.getAttribute("data-token");
    if (!token) return;

    var raw = Object.fromEntries(new FormData(form).entries());

    // Honeypot check — silently discard, respond 200 to not tip off bots
    if (isHoneypotFilled(raw)) {
      form.reset();
      return;
    }

    var data = mapFields(form);

    // Add receivedAt timestamp
    data.receivedAt = new Date().toISOString();

    fetch(ENDPOINT_BASE + token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then(function (res) {
        if (res.ok) {
          form.reset();
          var redirect = script.getAttribute("data-redirect");
          if (redirect) {
            window.location.href = redirect;
          }
        }
      })
      .catch(function () {
        // Network failure — don't block the LP visitor
      });
  }

  document.addEventListener("submit", handleSubmit, true);
})();
