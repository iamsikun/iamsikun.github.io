/* Chat widget client — "Ask about Sikun's research"
 *
 * - In MOCK mode (default until the Worker is deployed) returns canned
 *   responses so the UI can be developed and tested end-to-end without
 *   a backend.
 * - In LIVE mode, POSTs { message, history } to WORKER_URL and renders
 *   { reply, model } or { error } payloads.
 *
 * To go live: set WORKER_URL to the deployed Cloudflare Worker URL
 * (e.g. "https://iamsikun-chat.<subdomain>.workers.dev/chat") and the
 * widget will switch automatically.
 */
(function () {
  "use strict";

  // ---- Config -------------------------------------------------------------

  /** @type {string} Set to the deployed Worker URL to switch from mock to live. */
  var WORKER_URL = ""; // e.g. "https://iamsikun-chat.<subdomain>.workers.dev/chat"

  var MODEL_LABELS = {
    "gemini-2.0-flash": "Gemini 2.0 Flash",
    "llama-3.3-70b":    "Llama 3.3 70B",
    "mock":             "mock backend"
  };

  var MAX_INPUT_LEN  = 500;
  var MAX_HISTORY    = 6;          // turns (user+assistant pairs) sent to backend
  var MOCK_DELAY_MS  = 700;

  // ---- DOM lookup ---------------------------------------------------------

  var widget = document.getElementById("chat-widget");
  if (!widget) return;

  var bubble        = widget.querySelector(".chat-widget__bubble");
  var closeBtn      = widget.querySelector(".chat-widget__close");
  var panel         = widget.querySelector(".chat-widget__panel");
  var messagesEl    = widget.querySelector('[data-role="messages"]');
  var welcomeEl     = widget.querySelector('[data-role="welcome"]');
  var form          = widget.querySelector('[data-role="form"]');
  var input         = widget.querySelector('[data-role="input"]');
  var modelBadge    = widget.querySelector('[data-role="model-badge"]');
  var footerModel   = widget.querySelector('[data-role="footer-model"]');
  var starters      = widget.querySelectorAll(".chat-widget__starter");
  var sendBtn       = form.querySelector(".chat-widget__send");

  // ---- State --------------------------------------------------------------

  var history = []; // [{ role: "user"|"assistant", content: string }, ...]
  var inFlight = false;

  // ---- Open / close -------------------------------------------------------

  function setOpen(open) {
    widget.setAttribute("data-state", open ? "open" : "closed");
    panel.hidden = !open;
    bubble.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      setTimeout(function () { input.focus(); }, 30);
    }
  }

  bubble.addEventListener("click", function () { setOpen(true); });
  closeBtn.addEventListener("click", function () { setOpen(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && widget.getAttribute("data-state") === "open") {
      setOpen(false);
      bubble.focus();
    }
  });

  // ---- Starter chips ------------------------------------------------------

  starters.forEach(function (chip) {
    chip.addEventListener("click", function () {
      input.value = chip.textContent.trim();
      submit();
    });
  });

  // ---- Form submit --------------------------------------------------------

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    submit();
  });

  function submit() {
    if (inFlight) return;
    var text = (input.value || "").trim();
    if (!text) return;
    if (text.length > MAX_INPUT_LEN) text = text.slice(0, MAX_INPUT_LEN);

    hideWelcome();
    addMessage("user", text);
    history.push({ role: "user", content: text });
    input.value = "";

    var typingEl = showTyping();
    setInFlight(true);

    sendToBackend(text, history.slice(0, -1))
      .then(function (res) {
        removeNode(typingEl);
        if (res.error) {
          handleError(res);
          return;
        }
        var reply = res.reply || "";
        updateModelBadge(res.model);
        addMessage("assistant", reply);
        history.push({ role: "assistant", content: reply });
        trimHistory();
      })
      .catch(function (err) {
        removeNode(typingEl);
        addError(
          "Sorry — couldn't reach the assistant. Please try again in a moment. " +
          "(" + (err && err.message ? err.message : "network error") + ")"
        );
      })
      .then(function () { setInFlight(false); });
  }

  function setInFlight(flag) {
    inFlight = flag;
    sendBtn.disabled = flag;
    input.disabled = flag;
  }

  function trimHistory() {
    var maxEntries = MAX_HISTORY * 2;
    if (history.length > maxEntries) {
      history = history.slice(history.length - maxEntries);
    }
  }

  // ---- Backend call -------------------------------------------------------

  function sendToBackend(message, prior) {
    if (!WORKER_URL) return mockBackend(message);
    return fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message, history: prior })
    }).then(function (resp) {
      if (resp.status === 429) {
        return resp.json().then(function (j) {
          return { error: "rate_limited", message: (j && j.message) || "Too many messages — try again in a bit." };
        });
      }
      if (!resp.ok) {
        return resp.json().catch(function () { return {}; }).then(function (j) {
          var msg = (j && j.message) || ("HTTP " + resp.status);
          return { error: j.error || "http_error", message: msg };
        });
      }
      return resp.json();
    });
  }

  function mockBackend(message) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve({
          model: "mock",
          reply: mockReplyFor(message)
        });
      }, MOCK_DELAY_MS);
    });
  }

  function mockReplyFor(message) {
    var m = message.toLowerCase();
    if (/winner|curse/.test(m)) {
      return "Sikun's working paper *The Winner's Curse in Data-Driven Decision-Making: " +
             "Evidence and Solutions* (with Raphael Thomadsen and Dennis Zhang) " +
             "argues that when managers pick the best-performing policy from many " +
             "candidates, the chosen one's expected performance is systematically overstated. " +
             "She proposes corrections that recover honest estimates. " +
             "(This is a mock response — backend not yet wired.) " +
             "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5930537";
    }
    if (/teach|course|ta\b|lecture/.test(m)) {
      return "Sikun has guest-lectured at WashU's MGT 680E (AI & ML Business Applications, Fall 2024) " +
             "and at Columbia's IEOR 4721 (AI Application in Finance, 2021–2022). " +
             "She has TA'd a long list of operations and ML courses at Olin and Columbia. " +
             "(Mock response.)";
    }
    if (/about|who|work on|research|study/.test(m)) {
      return "Sikun is a Ph.D. candidate at WashU's Olin Business School, advised by " +
             "Dennis Zhang and Raphael Thomadsen. Her research uses causal inference and " +
             "machine learning to help firms make reliable decisions from noisy, " +
             "high-dimensional data — with applications in quantitative marketing and finance. " +
             "(Mock response — backend will give richer, grounded answers once deployed.)";
    }
    return "Thanks for the question! The backend isn't wired up yet, so I'm returning " +
           "a placeholder reply. Once the Cloudflare Worker is deployed, this widget " +
           "will return grounded answers about Sikun's research, papers, and teaching.";
  }

  // ---- Render -------------------------------------------------------------

  function hideWelcome() {
    if (welcomeEl && !welcomeEl.hidden) welcomeEl.hidden = true;
  }

  function addMessage(role, text) {
    var el = document.createElement("div");
    el.className = "chat-widget__msg chat-widget__msg--" + role;
    if (role === "assistant") {
      el.innerHTML = renderAssistant(text);
    } else {
      el.textContent = text;
    }
    messagesEl.appendChild(el);
    scrollToBottom();
    return el;
  }

  function addError(text) {
    var el = document.createElement("div");
    el.className = "chat-widget__msg chat-widget__msg--error";
    el.textContent = text;
    messagesEl.appendChild(el);
    scrollToBottom();
  }

  function showTyping() {
    var el = document.createElement("div");
    el.className = "chat-widget__typing";
    el.innerHTML = "<span></span><span></span><span></span>";
    messagesEl.appendChild(el);
    scrollToBottom();
    return el;
  }

  function removeNode(node) {
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Very small renderer: escape HTML, autolink URLs, **bold**, *italic*.
  function renderAssistant(text) {
    var safe = escapeHtml(text);
    safe = safe.replace(/(https?:\/\/[^\s)]+)(?=[\s).]|$)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    safe = safe.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    safe = safe.replace(/\n/g, "<br>");
    return safe;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---- Model badge --------------------------------------------------------

  function updateModelBadge(model) {
    var label = MODEL_LABELS[model] || model || "—";
    if (modelBadge) modelBadge.textContent = "via " + label;
    if (footerModel) footerModel.textContent = label;
  }

  // Initial label depends on mode
  updateModelBadge(WORKER_URL ? "gemini-2.0-flash" : "mock");

  // ---- Error states -------------------------------------------------------

  function handleError(res) {
    if (res.error === "both_quotas_exhausted") {
      addError(
        "The assistant is taking a break — both LLM backends are out of free " +
        "quota for today. Please try again tomorrow, or check Sikun's papers " +
        "directly on the homepage."
      );
      return;
    }
    if (res.error === "rate_limited") {
      addError(res.message || "Too many messages. Please try again in a bit.");
      return;
    }
    addError(res.message || "Something went wrong. Please try again.");
  }
})();
