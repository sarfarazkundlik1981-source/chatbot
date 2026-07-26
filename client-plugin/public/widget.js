(function () {
  const connectorId = window.WCP_CONFIG && (window.WCP_CONFIG.connectorId || window.WCP_CONFIG.installationId);
  if (!window.WCP_CONFIG || !window.WCP_CONFIG.backendUrl || !connectorId || !window.WCP_CONFIG.ajaxUrl || !window.WCP_CONFIG.proxyNonce) {
    return;
  }

  const storagePrefix = ["wcp", connectorId, window.WCP_CONFIG.siteHost || window.location.hostname].join(":");

  function storageKey(name) {
    return storagePrefix + ":" + name;
  }

  function loadStorage(name) {
    try {
      return window.localStorage.getItem(storageKey(name));
    } catch (_error) {
      return null;
    }
  }

  function saveStorage(name, value) {
    try {
      if (value == null || value === "") {
        window.localStorage.removeItem(storageKey(name));
        return;
      }
      window.localStorage.setItem(storageKey(name), String(value));
    } catch (_error) {
      return;
    }
  }

  const state = {
    token: null,
    bootstrapPromise: null,
    conversationId: null,
    booting: false,
    resumeToken: loadStorage("resume_token"),
    cachedConfigVersion: Number(loadStorage("config_version") || 0),
    cachedConfig: loadStorage("widget_config"),
    config: null,
    open: false,
    embedded: false,
    bootFailed: false,
    isPopupMode: false,
    scriptPromises: {},
    turnstileWidgetId: null
  };

  const apiBase = window.WCP_CONFIG.backendUrl.replace(/\/$/, "") + "/api/v1/plugin";

  function matchesPath(list, currentPath) {
    return Array.isArray(list) && list.some(function (item) {
      return item && currentPath.indexOf(item) !== -1;
    });
  }

  function shouldRenderWidget() {
    if (window.WCP_CONFIG.desktopOnly && window.innerWidth < 768) {
      return false;
    }
    if (window.WCP_CONFIG.mobileOnly && window.innerWidth >= 768) {
      return false;
    }
    if (window.WCP_CONFIG.hideLoggedIn && window.WCP_CONFIG.isLoggedIn) {
      return false;
    }
    if (window.WCP_CONFIG.hideCheckout && /checkout/i.test(window.WCP_CONFIG.currentPath || "")) {
      return false;
    }
    if (window.WCP_CONFIG.includePages && window.WCP_CONFIG.includePages.length && !matchesPath(window.WCP_CONFIG.includePages, window.WCP_CONFIG.currentPath || "/")) {
      return false;
    }
    if (window.WCP_CONFIG.excludePages && matchesPath(window.WCP_CONFIG.excludePages, window.WCP_CONFIG.currentPath || "/")) {
      return false;
    }
    return true;
  }

  function shouldRenderPlatformConfig() {
    return !(state.config && state.config.widget && state.config.widget.hide_for_logged_in_users && window.WCP_CONFIG.isLoggedIn);
  }

  function removeWidgetShell() {
    [launcher, panel, backdrop].forEach(function (element) {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
  }

  function createBox(tag, style) {
    const element = document.createElement(tag);
    if (style) {
      element.setAttribute("style", style);
    }
    return element;
  }

  const launcher = createBox("button", "position:fixed;right:24px;bottom:24px;min-width:76px;height:44px;padding:0 18px;border:none;border-radius:999px;background:#050505;color:#fff;cursor:pointer;z-index:9999;font:600 14px/1 'Segoe UI',Arial,sans-serif;box-shadow:0 14px 34px rgba(0,0,0,.22)");
  launcher.type = "button";
  launcher.textContent = "Chat";

  const backdrop = createBox("div", "position:fixed;inset:0;background:rgba(2,6,23,.62);display:none;z-index:9998");
  const panel = createBox("div", "position:fixed;right:24px;bottom:24px;width:430px;max-width:calc(100vw - 40px);height:min(560px, calc(100vh - 96px));background:#f6f7f9;color:#111827;border:1px solid #d8dde8;border-radius:18px;display:none;flex-direction:column;overflow:hidden;z-index:9999;box-shadow:0 20px 48px rgba(15,23,42,.18)");
  const header = createBox("div", "display:flex;align-items:center;justify-content:space-between;padding:9px 16px;background:#050505;color:#fff;min-height:50px");
  const headerIdentity = createBox("div", "display:flex;align-items:center;gap:12px;min-width:0");
  const headerIcon = createBox("div", "width:34px;height:34px;background:#171717;border:none;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:15px;flex:0 0 auto");
  const headerText = createBox("div", "display:flex;flex-direction:column;min-width:0");
  const headerTitle = createBox("div", "font:700 15px/1.15 'Segoe UI',Arial,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;max-width:280px");
  const headerSubtitle = createBox("div", "font:400 12px/1.2 'Segoe UI',Arial,sans-serif;color:rgba(255,255,255,.76);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;max-width:280px");
  const headerControls = createBox("div", "display:flex;align-items:center;gap:14px;flex:0 0 auto");
  const minimizeButton = createBox("button", "width:24px;height:24px;border:none;background:transparent;color:#fff;border-radius:999px;cursor:pointer;font:400 18px/1 'Segoe UI',Arial,sans-serif;opacity:.9");
  const closeButton = createBox("button", "width:24px;height:24px;border:none;background:transparent;color:#fff;border-radius:999px;cursor:pointer;font:400 22px/1 'Segoe UI',Arial,sans-serif;opacity:.9");
  const messages = createBox("div", "flex:1;overflow:auto;padding:18px 18px 12px;background:#f6f7f9;display:flex;flex-direction:column;gap:12px;font:400 15px/1.5 'Segoe UI',Arial,sans-serif");
  const actions = createBox("div", "display:none;gap:8px;flex-wrap:wrap;padding:0 20px 10px;background:#f6f7f9");
  const tools = createBox("div", "display:none;gap:8px;padding:0 20px 10px;background:#f6f7f9;flex-wrap:wrap");
  const formHost = createBox("div", "display:none;padding:12px 16px;background:#f6f7f9;border-top:1px solid #edf0f4;max-height:52%;overflow:auto;flex:0 1 auto;box-sizing:border-box");
  const captchaHost = createBox("div", "display:none");
  const composerWrap = createBox("div", "padding:16px 14px 8px;background:#fff;border-top:1px solid #edf0f4");
  const composer = createBox("form", "display:flex;align-items:center;gap:8px;padding:6px 8px 6px 14px;border:1px solid #d8dde8;border-radius:14px;background:#f9fafb");
  const input = createBox("input", "flex:1;min-width:0;padding:8px 0;border:none;background:transparent;color:#111827;font:400 15px/1.35 'Segoe UI',Arial,sans-serif;outline:none");
  const send = createBox("button", "width:32px;height:32px;border:none;border-radius:10px;background:#8f8f8f;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;flex:0 0 auto");
  const footer = createBox("div", "padding:0 10px 10px;background:#fff;color:#99a2b2;text-align:center;font:500 12px/1.2 'Segoe UI',Arial,sans-serif");
  const customStyle = createBox("style", "");

  launcher.className = "wcp-chatbot-launcher";
  panel.className = "wcp-chatbot-panel";
  header.className = "wcp-chatbot-header";
  headerIcon.className = "wcp-chatbot-header-icon";
  headerTitle.className = "wcp-chatbot-title";
  headerSubtitle.className = "wcp-chatbot-subtitle";
  minimizeButton.className = "wcp-chatbot-minimize";
  closeButton.className = "wcp-chatbot-close";
  messages.className = "wcp-chatbot-messages";
  actions.className = "wcp-chatbot-actions";
  tools.className = "wcp-chatbot-tools";
  formHost.className = "wcp-chatbot-form-host";
  composerWrap.className = "wcp-chatbot-composer-wrap";
  composer.className = "wcp-chatbot-composer";
  input.className = "wcp-chatbot-input";
  send.className = "wcp-chatbot-send";
  footer.className = "wcp-chatbot-footer";
  customStyle.id = "wcp-chatbot-custom-css";

  input.type = "text";
  input.placeholder = "Type a message...";
  send.type = "submit";
  send.setAttribute("aria-label", "Send message");
  send.innerHTML = "&#10148;";
  headerIcon.innerHTML = "&#128172;";
  minimizeButton.type = "button";
  minimizeButton.textContent = "\u229d";
  closeButton.type = "button";
  closeButton.textContent = "\u00d7";
  headerTitle.textContent = "Assistant";
  headerSubtitle.textContent = "";
  footer.textContent = "Powered by Swift FM";

  headerText.appendChild(headerTitle);
  headerText.appendChild(headerSubtitle);
  headerIdentity.appendChild(headerIcon);
  headerIdentity.appendChild(headerText);
  headerControls.appendChild(minimizeButton);
  headerControls.appendChild(closeButton);
  header.appendChild(headerIdentity);
  header.appendChild(headerControls);

  composer.appendChild(input);
  composer.appendChild(send);
  composerWrap.appendChild(composer);
  panel.appendChild(header);
  panel.appendChild(messages);
  panel.appendChild(actions);
  panel.appendChild(tools);
  panel.appendChild(formHost);
  panel.appendChild(captchaHost);
  panel.appendChild(composerWrap);
  panel.appendChild(footer);

  function addMessage(role, text) {
    const baseFontSize = appearanceNumber("font_size", 15, 12, 18);
    const customerBubbleBg = appearanceColor("customer_bubble_bg_color", "#111827");
    const customerText = appearanceColor("customer_text_color", "#ffffff");
    const assistantBubbleBg = appearanceColor("assistant_bubble_bg_color", "#ffffff");
    const assistantText = appearanceColor("assistant_text_color", "#1f2937");
    const bubble = createBox(
      "div",
      [
        "max-width:78%",
        "padding:14px 18px",
        "border-radius:16px",
        `font:400 ${baseFontSize}px/1.5 'Segoe UI',Arial,sans-serif`,
        role === "user"
          ? `background:${customerBubbleBg};color:${customerText};align-self:flex-end;border-bottom-right-radius:8px;white-space:pre-wrap`
          : `background:${assistantBubbleBg};color:${assistantText};align-self:flex-start;white-space:pre-wrap;border:1px solid #dfe4ec;box-shadow:0 2px 8px rgba(15,23,42,.06);border-bottom-left-radius:8px`
      ].join(";")
    );
    bubble.className = role === "user" ? "wcp-chatbot-message wcp-chatbot-message-user" : "wcp-chatbot-message wcp-chatbot-message-assistant";
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  function setComposerDisabled(disabled) {
    input.disabled = disabled;
    send.disabled = disabled;
    input.style.opacity = disabled ? "0.6" : "1";
    send.style.opacity = disabled ? "0.6" : "1";
    send.style.cursor = disabled ? "not-allowed" : "pointer";
    send.style.background = disabled ? "#b0b0b0" : appearanceColor("button_bg_color", "#8f8f8f");
    send.style.color = appearanceColor("button_text_color", "#ffffff");
  }

  function setUnavailableState(message) {
    state.bootFailed = true;
    state.booting = false;
    setComposerDisabled(true);
    hideInlineForm();
    actions.innerHTML = "";
    tools.innerHTML = "";
    actions.style.display = "flex";
    tools.style.display = "none";
    messages.innerHTML = "";
    addMessage("assistant", message || "Chat is temporarily unavailable. Please try again or use the contact options on this page.");
    renderButtons(actions, [
      {
        label: "Retry",
        onClick: function () {
          state.bootFailed = false;
          state.conversationId = null;
          actions.style.display = "none";
          messages.innerHTML = "";
          void boot();
        }
      }
    ]);
  }

  function setPanelVisibility(open) {
    state.open = open;
    panel.style.display = open ? "flex" : "none";
    if (state.isPopupMode) {
      backdrop.style.display = open ? "block" : "none";
      document.body.style.overflow = open ? "hidden" : "";
    }
  }

  function renderButtons(container, buttons) {
    container.innerHTML = "";
    if (!buttons.length) {
      container.style.display = "none";
      return;
    }
    container.style.display = "flex";
    buttons.forEach(function (buttonConfig) {
      const button = createBox("button", "max-width:100%;padding:8px 11px;border:1px solid #d8deea;border-radius:10px;background:#fff;color:#1f2937;cursor:pointer;font:600 13px/1.2 'Segoe UI',Arial,sans-serif;white-space:normal;text-align:left");
      button.type = "button";
      button.textContent = buttonConfig.label;
      if (buttonConfig.kind) {
        button.dataset.wcpFeatureKind = buttonConfig.kind;
      }
      button.className = buttonConfig.kind ? "wcp-chatbot-action wcp-chatbot-feature-action" : "wcp-chatbot-action";
      button.addEventListener("click", buttonConfig.onClick);
      container.appendChild(button);
    });
  }

  function wordpressAjax(action, payload) {
    const formData = new FormData();
    formData.append("action", action);
    formData.append("nonce", window.WCP_CONFIG.proxyNonce || "");
    Object.keys(payload || {}).forEach(function (key) {
      formData.append(key, payload[key] == null ? "" : String(payload[key]));
    });
    return fetch(window.WCP_CONFIG.ajaxUrl, {
      method: "POST",
      body: formData,
      credentials: "same-origin"
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok || !payload.success) {
          throw new Error((payload.data && payload.data.message) || (payload.error && payload.error.message) || "WordPress request failed");
        }
        return payload;
      });
    });
  }

  function submitLeadProxy(details) {
    return wordpressAjax("wcp_notify_lead", {
      name: details.name || "",
      email: details.email || "",
      phone: details.phone || "",
      message: details.message || "",
      status: details.status || "new",
      data: JSON.stringify(details.data || {}),
      captcha_token: details.captcha_token || ""
    });
  }

  function withOptionalCaptchaToken(payload, captchaToken) {
    if (captchaToken) {
      payload.captcha_token = captchaToken;
    }
    return payload;
  }

  function apiFetch(path, init) {
    return fetch(apiBase + path, init).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) {
          const error = new Error((payload.error && payload.error.message) || "Request failed");
          error.status = response.status;
          throw error;
        }
        return payload;
      });
    });
  }

  function fetchWithPluginAuth(path, init, retryOnUnauthorized) {
    const request = Object.assign({}, init || {});
    request.headers = Object.assign({}, request.headers || {}, {
      Authorization: "Bearer " + state.token
    });

    return fetch(apiBase + path, request).then(function (response) {
      if (response.status === 401 && retryOnUnauthorized !== false) {
        return refreshPluginToken().then(function () {
          return fetchWithPluginAuth(path, init, false);
        });
      }
      return response;
    });
  }

  function refreshPluginToken() {
    state.token = null;
    return bootstrapPlugin().then(loadConfig);
  }

  function getCaptchaConfig(interaction) {
    if (!state.config || !state.config.captcha || !state.config.captcha.provider) {
      return null;
    }
    const forms = state.config.captcha.protected_forms || {};
    if (!forms[interaction]) {
      return null;
    }
    return state.config.captcha;
  }

  function loadExternalScript(key, src, readyCheck) {
    if (readyCheck()) {
      return Promise.resolve();
    }
    if (state.scriptPromises[key]) {
      return state.scriptPromises[key];
    }

    state.scriptPromises[key] = new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = function () {
        resolve();
      };
      script.onerror = function () {
        reject(new Error("Failed to load verification script."));
      };
      document.head.appendChild(script);
    });

    return state.scriptPromises[key];
  }

  function getCaptchaToken(interaction) {
    const config = getCaptchaConfig(interaction);
    if (!config || !config.site_key) {
      return Promise.resolve(null);
    }

    if (config.provider === "recaptcha_v3") {
      return loadExternalScript("recaptcha_v3", "https://www.google.com/recaptcha/api.js?render=" + encodeURIComponent(config.site_key), function () {
        return Boolean(window.grecaptcha && window.grecaptcha.execute);
      }).then(function () {
        return new Promise(function (resolve, reject) {
          window.grecaptcha.ready(function () {
            window.grecaptcha
              .execute(config.site_key, { action: "widget_" + interaction })
              .then(resolve)
              .catch(function () {
                reject(new Error("Verification failed. Please try again."));
              });
          });
        });
      });
    }

    return loadExternalScript("turnstile", "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", function () {
      return Boolean(window.turnstile && window.turnstile.render);
    }).then(function () {
      return new Promise(function (resolve, reject) {
        captchaHost.innerHTML = "";
        const target = document.createElement("div");
        captchaHost.appendChild(target);
        captchaHost.style.display = "block";
        state.turnstileWidgetId = window.turnstile.render(target, {
          sitekey: config.site_key,
          size: "invisible",
          callback: function (token) {
            resolve(token);
          },
          "error-callback": function () {
            reject(new Error("Verification failed. Please try again."));
          }
        });
        window.turnstile.execute(state.turnstileWidgetId);
      });
    });
  }

  function showInlineForm(title, fields, onSubmit) {
    formHost.innerHTML = "";
    formHost.style.display = "block";
    const heading = createBox("div", "font:700 14px/1.3 'Segoe UI',Arial,sans-serif;margin:0 0 10px;color:#111827");
    heading.textContent = title;
    const form = createBox("form", "display:flex;flex-direction:column;gap:9px;margin:0;width:100%;box-sizing:border-box");
    const inputs = {};
    fields.forEach(function (field) {
      const fieldStyle = "display:block;width:100%;box-sizing:border-box;min-height:40px;padding:10px 12px;border-radius:10px;border:1px solid #d8deea;background:#fff;color:#111827;font:400 13px/1.4 'Segoe UI',Arial,sans-serif;outline:none;box-shadow:none;appearance:none";
      const element = field.multiline ? createBox("textarea", fieldStyle + ";min-height:78px;resize:vertical") : createBox("input", fieldStyle);
      element.className = "wcp-chatbot-form-field";
      if (!field.multiline) {
        element.type = field.type || "text";
      }
      if (field.required) {
        element.required = true;
      }
      element.placeholder = field.label;
      if (field.value !== undefined) {
        element.value = field.value;
      }
      inputs[field.key] = element;
      form.appendChild(element);
    });
    const submit = createBox("button", `display:flex;align-items:center;justify-content:center;width:100%;box-sizing:border-box;min-height:42px;margin-top:2px;padding:10px 14px;border:none;border-radius:10px;background:${appearanceColor("button_bg_color", "#050505")};color:${appearanceColor("button_text_color", "#ffffff")};cursor:pointer;font:700 13px/1.2 'Segoe UI',Arial,sans-serif;text-align:center`);
    submit.className = "wcp-chatbot-form-submit";
    submit.type = "submit";
    submit.textContent = "Submit";
    form.appendChild(submit);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      submit.disabled = true;
      submit.style.opacity = "0.7";
      submit.style.cursor = "not-allowed";
      const values = {};
      Object.keys(inputs).forEach(function (key) {
        values[key] = inputs[key].value;
      });
      Promise.resolve(onSubmit(values)).finally(function () {
        if (submit.parentNode) {
          submit.disabled = false;
          submit.style.opacity = "1";
          submit.style.cursor = "pointer";
        }
      });
    });
    formHost.appendChild(heading);
    formHost.appendChild(form);
  }

  function hideInlineForm() {
    formHost.style.display = "none";
    formHost.innerHTML = "";
  }

  function renderFeatureTools() {
    if (!state.config) {
      return;
    }

    const buttons = [];
    if (state.config.callback_request && state.config.callback_request.enabled) {
      buttons.push({
        kind: "callback",
        label: state.config.callback_request.button_label || "Request a call",
        onClick: function () {
          showInlineForm(
            "Request a call",
            [
              { key: "name", label: "Name" },
              { key: "phone", label: "Phone", required: true },
              { key: "email", label: "Email", type: "email" },
              { key: "message", label: "Message", multiline: true }
            ],
            function (values) {
              return getCaptchaToken("callback")
                .then(function (captchaToken) {
                  return submitLeadProxy({
                    name: values.name,
                    phone: values.phone,
                    email: values.email,
                    message: values.message,
                    data: { request_type: "callback", message: values.message },
                    captcha_token: captchaToken
                  });
                })
                .then(function () {
                  addMessage("assistant", state.config.callback_request.success_message || "Your callback request has been sent.");
                  hideInlineForm();
                })
                .catch(function (error) {
                  addMessage("assistant", error.message || "Callback request failed.");
                });
            }
          );
        }
      });
    }

    if (state.config.appointment_request && state.config.appointment_request.enabled) {
      buttons.push({
        kind: "appointment",
        label: state.config.appointment_request.title || "Request appointment",
        onClick: function () {
          showInlineForm(
            state.config.appointment_request.title || "Request appointment",
            [
              { key: "name", label: "Name", required: true },
              { key: "email", label: "Email", type: "email", required: true },
              { key: "phone", label: "Phone", required: true },
              { key: "service", label: "Service" },
              { key: "preferred_date", label: "Preferred date", required: true },
              { key: "preferred_time", label: "Preferred time", required: true }
            ],
            function (values) {
              return getCaptchaToken("appointment")
                .then(function (captchaToken) {
                  return submitLeadProxy({
                    name: values.name,
                    phone: values.phone,
                    email: values.email,
                    data: {
                      request_type: "appointment",
                      service: values.service,
                      preferred_date: values.preferred_date,
                      preferred_time: values.preferred_time
                    },
                    captcha_token: captchaToken
                  });
                })
                .then(function () {
                  addMessage("assistant", state.config.appointment_request.success_message || "Your appointment request has been sent.");
                  hideInlineForm();
                })
                .catch(function (error) {
                  addMessage("assistant", error.message || "Appointment request failed.");
                });
            }
          );
        }
      });
    }

    if (state.config.service_area && state.config.service_area.enabled) {
      buttons.push({
        kind: "service-area",
        label: "Check service area",
        onClick: function () {
          showInlineForm("Check service area", [{ key: "query", label: state.config.service_area.input_label || "Enter your city or ZIP", required: true }], function (values) {
            return fetchWithPluginAuth("/service-area-check", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ query: values.query })
            })
              .then(function (response) {
                if (!response.ok) {
                  throw new Error("Service area check failed.");
                }
                return response.json();
              })
              .then(function (payload) {
                addMessage("assistant", payload.data.message);
                hideInlineForm();
              })
              .catch(function (error) {
                addMessage("assistant", error.message || "Service area check failed.");
              });
          });
        }
      });
    }

    if (state.config.quote_calculator && state.config.quote_calculator.enabled) {
      buttons.push({
        kind: "quote",
        label: state.config.quote_calculator.title || "Instant quote",
        onClick: function () {
          const fields = (state.config.quote_calculator.fields || []).map(function (field) {
            return {
              key: field.key,
              label: field.label,
              value: "",
              multiline: field.field_type === "textarea"
            };
          });
          showInlineForm(state.config.quote_calculator.title || "Instant quote", fields, function (values) {
            return getCaptchaToken("quote")
              .then(function (captchaToken) {
                return fetchWithPluginAuth("/quote-calculate", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify(withOptionalCaptchaToken({ values: values }, captchaToken))
                });
              })
              .then(function (response) {
                if (!response.ok) {
                  throw new Error("Quote calculation failed.");
                }
                return response.json();
              })
              .then(function (payload) {
                const quote = payload.data;
                addMessage("assistant", (state.config.quote_calculator.success_message || "Estimated quote generated.") + "\n" + quote.amount + " " + quote.currency);
                return getCaptchaToken("quote").then(function (leadCaptchaToken) {
                  return submitLeadProxy({
                    data: {
                      request_type: "quote",
                      amount: quote.amount,
                      currency: quote.currency,
                      values: values
                    },
                    captcha_token: leadCaptchaToken
                  }).catch(function () {
                    return null;
                  });
                }).then(function () {
                  hideInlineForm();
                });
              })
              .catch(function (error) {
                addMessage("assistant", error.message || "Quote calculation failed.");
              });
          });
        }
      });
    }

    renderButtons(tools, buttons);
  }

  function cleanDisplayName(value) {
    const name = String(value || "").trim();
    if (!name) {
      return "";
    }
    if (/hostinger|hosting|localhost|\.test|\.local|\.com|\.net|\.org|\.co\.|^[a-z]+-[a-z]+-\d+/i.test(name)) {
      return "";
    }
    return name.length > 34 ? name.slice(0, 31).trim() + "..." : name;
  }

  function appearanceNumber(key, fallback, min, max) {
    const value = Number(state.config && state.config.branding ? state.config.branding[key] : null);
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, value));
  }

  function appearanceColor(key, fallback) {
    const value = state.config && state.config.branding ? String(state.config.branding[key] || "").trim() : "";
    return value || fallback;
  }

  function applyCustomCss() {
    const css = state.config && state.config.branding ? String(state.config.branding.custom_css || "").trim() : "";
    customStyle.textContent = css;
    if (css && !customStyle.parentNode) {
      document.head.appendChild(customStyle);
    }
    if (!css && customStyle.parentNode) {
      customStyle.parentNode.removeChild(customStyle);
    }
  }

  function applyConfig() {
    if (!state.config) {
      return;
    }

    const businessName = cleanDisplayName(state.config.business && state.config.business.name ? state.config.business.name : "");
    const siteName = cleanDisplayName(window.WCP_CONFIG.siteName || "");
    const title = businessName || siteName || "SFM";
    const subtitle = cleanDisplayName(window.WCP_CONFIG.siteTagline || "") || "Swift Facilities Management";
    headerTitle.textContent = /assistant/i.test(title) ? title : title + " Assistant";
    headerSubtitle.textContent = subtitle;
    launcher.textContent = "Chat";
    const panelWidth = appearanceNumber("panel_width", 430, 320, 640);
    const panelHeight = appearanceNumber("panel_height", 560, 360, 760);
    const baseFontSize = appearanceNumber("font_size", 15, 12, 18);
    const radius = appearanceNumber("border_radius", 18, 0, 32);
    const headerBg = appearanceColor("header_bg_color", "#050505");
    const widgetBg = appearanceColor("widget_bg_color", "#f6f7f9");
    const composerBg = appearanceColor("composer_bg_color", "#ffffff");
    const inputBg = appearanceColor("input_bg_color", "#f9fafb");
    const buttonBg = appearanceColor("button_bg_color", "#8f8f8f");
    const buttonText = appearanceColor("button_text_color", "#ffffff");
    const footerText = appearanceColor("footer_text_color", "#99a2b2");
    launcher.style.background = headerBg;
    panel.style.width = `${panelWidth}px`;
    panel.style.maxWidth = "calc(100vw - 40px)";
    panel.style.height = `min(${panelHeight}px, calc(100vh - 96px))`;
    panel.style.background = widgetBg;
    panel.style.borderRadius = state.embedded ? `${radius}px` : `${radius}px`;
    panel.style.fontFamily = state.config.branding.font || "Segoe UI";
    header.style.background = headerBg;
    messages.style.background = widgetBg;
    messages.style.fontSize = `${baseFontSize}px`;
    actions.style.background = widgetBg;
    tools.style.background = widgetBg;
    formHost.style.background = widgetBg;
    composerWrap.style.background = composerBg;
    composer.style.background = inputBg;
    input.style.fontSize = `${baseFontSize}px`;
    send.style.background = buttonBg;
    send.style.color = buttonText;
    footer.style.color = footerText;
    headerSubtitle.style.display = subtitle ? "block" : "none";
    footer.textContent = "Powered by " + title;
    if (state.config.widget.position === "bottom-left") {
      launcher.style.left = "20px";
      launcher.style.right = "auto";
      panel.style.left = "20px";
      panel.style.right = "auto";
    }
    renderFeatureTools();
    applyCustomCss();
  }

  function renderRuntimeCtas(ctas) {
    function clickFeatureTool(kind) {
      const button = tools.querySelector('button[data-wcp-feature-kind="' + kind + '"]');
      if (button) {
        button.click();
        return true;
      }
      return false;
    }

    function openCtaUrl(cta) {
      const url = String((cta && cta.url) || "").trim();
      if (!url || url.charAt(0) === "#") {
        return false;
      }
      window.open(url, "_blank", "noopener,noreferrer");
      return true;
    }

    function handleFeatureCta(kind, cta) {
      if (clickFeatureTool(kind) || openCtaUrl(cta)) {
        return;
      }
      addMessage("assistant", "This action is not configured yet. Please contact the business directly.");
    }

    renderButtons(
      actions,
      (ctas || []).map(function (cta) {
        return {
          label: cta.label,
          onClick: function () {
            if (cta.kind === "callback") {
              handleFeatureCta("callback", cta);
              return;
            }
            if (cta.kind === "appointment") {
              handleFeatureCta("appointment", cta);
              return;
            }
            if (cta.kind === "service-area" || cta.kind === "quote") {
              handleFeatureCta(cta.kind, cta);
              return;
            }
            if (!openCtaUrl(cta)) {
              addMessage("assistant", "This action is not configured yet. Please contact the business directly.");
            }
          }
        };
      })
    );
  }

  function submitLeadDetails(messageText) {
    const details = {
      name: "",
      email: "",
      phone: "",
      message: messageText || "",
      data: {}
    };
    return getCaptchaToken("lead")
      .then(function (captchaToken) {
        details.captcha_token = captchaToken;
        return submitLeadProxy(details);
      })
      .then(function () {
        addMessage("assistant", "Thanks. Your details have been sent.");
      });
  }

  function bootstrapPlugin() {
    if (state.bootstrapPromise) {
      return state.bootstrapPromise;
    }

    state.bootstrapPromise = wordpressAjax("wcp_bootstrap_plugin", {})
      .then(function (payload) {
        state.token = payload.data.token;
        state.cachedConfigVersion = payload.data.config_version || state.cachedConfigVersion;
      })
      .finally(function () {
        state.bootstrapPromise = null;
      });

    return state.bootstrapPromise;
  }

  function loadConfig() {
    if (state.cachedConfig) {
      try {
        state.config = JSON.parse(state.cachedConfig);
      } catch (_error) {
        state.cachedConfig = null;
      }
    }

    if (state.config && state.config.config_version === state.cachedConfigVersion) {
      applyConfig();
      return Promise.resolve();
    }

    return fetchWithPluginAuth("/widget-config", {})
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Config fetch failed");
        }
        return response.json();
      })
      .then(function (payload) {
        state.config = payload.data;
        saveStorage("widget_config", JSON.stringify(payload.data));
        saveStorage("config_version", String(payload.data.config_version || 0));
        state.cachedConfigVersion = Number(payload.data.config_version || 0);
        state.cachedConfig = JSON.stringify(payload.data);
        applyConfig();
      });
  }

  function createOrResumeSession() {
    if (state.resumeToken) {
      return fetchWithPluginAuth("/resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ resume_token: state.resumeToken })
      }).then(function (resumed) {
        if (resumed.ok) {
          return resumed.json().then(function (payload) {
            state.conversationId = payload.data.conversation_id;
          });
        }
        return fetchWithPluginAuth("/session", {
          method: "POST",
          headers: {}
        })
          .then(function (created) {
            if (!created.ok) {
              throw new Error("Session creation failed");
            }
            return created.json();
          })
          .then(function (payload) {
            state.conversationId = payload.data.conversation_id;
            state.resumeToken = payload.data.resume_token;
            saveStorage("resume_token", state.resumeToken);
          });
      });
    }

    return fetchWithPluginAuth("/session", {
      method: "POST",
      headers: {}
    })
      .then(function (created) {
        if (!created.ok) {
          throw new Error("Session creation failed");
        }
        return created.json();
      })
      .then(function (payload) {
        state.conversationId = payload.data.conversation_id;
        state.resumeToken = payload.data.resume_token;
        saveStorage("resume_token", state.resumeToken);
      });
  }

  function sendMessage(text) {
    if (state.bootFailed) {
      setUnavailableState("Chat is temporarily unavailable. Please retry in a moment.");
      return Promise.resolve();
    }
    if (state.booting || !state.conversationId) {
      addMessage("assistant", "The assistant is still connecting. Please try again in a moment.");
      return Promise.resolve();
    }
    addMessage("user", text);
    return getCaptchaToken("chat")
      .then(function (captchaToken) {
        return fetchWithPluginAuth("/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(withOptionalCaptchaToken({
            conversation_id: state.conversationId,
            message: text
          }, captchaToken))
        });
      })
      .then(function (response) {
        if (!response.ok) {
          return response.json().then(function (payload) {
            addMessage("assistant", (payload.error && payload.error.message) || "The assistant is temporarily unavailable.");
            return null;
          }).catch(function () {
            addMessage("assistant", "The assistant is temporarily unavailable.");
            return null;
          });
        }
        return response.json();
      })
      .then(function (payload) {
        if (!payload) {
          return;
        }
        addMessage("assistant", payload.data.message);
        renderRuntimeCtas(payload.data.cta_options);
      });
  }

  function boot() {
    state.booting = true;
    state.conversationId = null;
    setComposerDisabled(true);
    return bootstrapPlugin()
      .then(loadConfig)
      .then(function () {
        if (!shouldRenderPlatformConfig()) {
          state.booting = false;
          removeWidgetShell();
          return Promise.reject({ wcpSilent: true });
        }
        return null;
      })
      .then(createOrResumeSession)
      .then(function () {
        state.booting = false;
        setComposerDisabled(false);
        const greeting = (state.config && state.config.out_of_hours && state.config.out_of_hours.enabled && state.config.out_of_hours.greeting) || (state.config && state.config.widget && state.config.widget.greeting) || "Hi, how can I help you today?";
        addMessage("assistant", greeting);
        if (!state.embedded && state.config && state.config.widget && state.config.widget.auto_open) {
          window.setTimeout(function () {
            setPanelVisibility(true);
          }, state.config.widget.auto_open_delay_ms || 0);
        }
      })
      .catch(function (error) {
        if (error && error.wcpSilent) {
          return;
        }
        state.booting = false;
        console.error(error);
        setUnavailableState("Chat is temporarily unavailable. Please try again or use the contact options on this page.");
      });
  }

  composer.addEventListener("submit", function (event) {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) {
      return;
    }
    input.value = "";
    void sendMessage(text);
  });

  launcher.addEventListener("click", function () {
    setPanelVisibility(!state.open);
  });

    backdrop.addEventListener("click", function () {
    setPanelVisibility(false);
  });

  minimizeButton.addEventListener("click", function () {
    setPanelVisibility(false);
  });

  closeButton.addEventListener("click", function () {
    setPanelVisibility(false);
  });

  window.addEventListener("load", function () {
    if (!shouldRenderWidget()) {
      return;
    }

    const embedTarget = document.querySelector("[data-wcp-embed='1']");
    state.embedded = Boolean(embedTarget);
    state.isPopupMode = window.WCP_CONFIG.displayMode === "popup";
    if ((window.WCP_CONFIG.displayMode === "embed" || state.embedded) && embedTarget) {
      panel.style.position = "relative";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.width = "100%";
      panel.style.maxWidth = "100%";
      panel.style.display = "flex";
      panel.style.height = "520px";
      embedTarget.appendChild(panel);
    } else {
      document.body.appendChild(backdrop);
      document.body.appendChild(launcher);
      document.body.appendChild(panel);
    }

    if (state.isPopupMode) {
      launcher.style.display = "none";
      panel.style.left = "50%";
      panel.style.top = "50%";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.transform = "translate(-50%, -50%)";
      panel.style.maxWidth = "min(430px, calc(100vw - 40px))";
      panel.style.width = "100%";
      panel.style.borderRadius = "18px";
    }

    if (window.WCP_CONFIG.displayMode === "button" || state.isPopupMode) {
      launcher.style.display = "none";
      const selector = window.WCP_CONFIG.triggerSelector || "[data-wcp-trigger='1']";
      document.querySelectorAll(selector).forEach(function (element) {
        element.addEventListener("click", function (event) {
          event.preventDefault();
          setPanelVisibility(true);
        });
      });
    }

    if (window.innerWidth < 640) {
      panel.style.width = "calc(100vw - 28px)";
      panel.style.maxWidth = "430px";
      panel.style.height = "min(540px, calc(100vh - 112px))";
      if (state.isPopupMode) {
        panel.style.left = "50%";
        panel.style.right = "auto";
        panel.style.top = "50%";
        panel.style.bottom = "auto";
        panel.style.transform = "translate(-50%, -50%)";
      } else {
        panel.style.bottom = "16px";
        panel.style.right = "12px";
        panel.style.left = "12px";
      }
      launcher.style.bottom = "max(16px, env(safe-area-inset-bottom))";
    }

    void boot();
    window.setInterval(function () {
      if (!state.token) {
        return;
      }
      void fetchWithPluginAuth("/heartbeat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          domain: window.location.hostname,
          plugin_version: window.WCP_CONFIG.pluginVersion,
          wordpress_version: window.WCP_CONFIG.wordpressVersion,
          php_version: window.WCP_CONFIG.phpVersion,
          elementor_version: window.WCP_CONFIG.elementorVersion
        })
      }).catch(function () {
        return null;
      });
    }, 12 * 60 * 60 * 1000);
  });
})();
