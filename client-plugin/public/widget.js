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

  const launcher = createBox("button", "position:fixed;right:20px;bottom:20px;min-width:84px;height:52px;padding:0 20px;border:none;border-radius:999px;background:#6d28d9;color:#fff;cursor:pointer;z-index:9999;font:600 18px/1 'Segoe UI',sans-serif;box-shadow:0 18px 45px rgba(76,29,149,.35)");
  launcher.type = "button";
  launcher.textContent = "Chat";

  const backdrop = createBox("div", "position:fixed;inset:0;background:rgba(2,6,23,.62);display:none;z-index:9998");
  const panel = createBox("div", "position:fixed;right:16px;bottom:16px;width:425px;max-width:calc(100vw - 16px);height:min(650px, calc(100vh - 24px));background:#ffffff;color:#111827;border:1px solid #d9dee8;border-radius:0;display:none;flex-direction:column;overflow:hidden;z-index:9999;box-shadow:0 28px 65px rgba(15,23,42,.24)");
  const header = createBox("div", "display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#000;color:#fff");
  const headerIdentity = createBox("div", "display:flex;align-items:center;gap:10px;min-width:0");
  const headerIcon = createBox("div", "width:32px;height:32px;border:1px solid rgba(255,255,255,.22);border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:16px;flex:0 0 auto");
  const headerText = createBox("div", "display:flex;flex-direction:column;min-width:0");
  const headerTitle = createBox("div", "font:700 17px/1.2 'Segoe UI',sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis");
  const headerSubtitle = createBox("div", "font:500 12px/1.25 'Segoe UI',sans-serif;color:rgba(255,255,255,.76);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px");
  const headerControls = createBox("div", "display:flex;align-items:center;gap:8px;flex:0 0 auto");
  const minimizeButton = createBox("button", "width:26px;height:26px;border:none;background:transparent;color:#fff;border-radius:999px;cursor:pointer;font:400 18px/1 'Segoe UI',sans-serif");
  const closeButton = createBox("button", "width:26px;height:26px;border:none;background:transparent;color:#fff;border-radius:999px;cursor:pointer;font:400 22px/1 'Segoe UI',sans-serif");
  const messages = createBox("div", "flex:1;overflow:auto;padding:22px 10px 12px;background:#fff;display:flex;flex-direction:column;gap:12px");
  const actions = createBox("div", "display:none;gap:8px;flex-wrap:wrap;padding:0 10px 10px;background:#fff");
  const tools = createBox("div", "display:none;gap:8px;padding:0 10px 10px;background:#fff;flex-wrap:wrap");
  const formHost = createBox("div", "display:none;padding:10px;background:#fff;border-top:1px solid #ebedf2");
  const captchaHost = createBox("div", "display:none");
  const composerWrap = createBox("div", "padding:10px 10px 4px;background:#fff;border-top:1px solid #ebedf2");
  const composer = createBox("form", "display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #d8dde8;border-radius:18px;background:#fff");
  const input = createBox("input", "flex:1;padding:10px 6px;border:none;background:transparent;color:#111827;font:400 16px/1.35 'Segoe UI',sans-serif;outline:none");
  const send = createBox("button", "width:40px;height:40px;border:none;border-radius:12px;background:#a3a3a3;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;flex:0 0 auto");
  const footer = createBox("div", "padding:4px 10px 8px;background:#fff;color:#97a0b3;text-align:center;font:500 12px/1.2 'Segoe UI',sans-serif");

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
    const bubble = createBox(
      "div",
      [
        "max-width:85%",
        "padding:14px 18px",
        "border-radius:22px",
        role === "user"
          ? "background:#6d28d9;color:#fff;align-self:flex-end;border-bottom-right-radius:8px;white-space:pre-wrap"
          : "background:#fff;color:#2b3345;align-self:flex-start;white-space:pre-wrap;border:1px solid #dbe1eb;box-shadow:0 4px 14px rgba(15,23,42,.08);border-bottom-left-radius:8px"
      ].join(";")
    );
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
    send.style.background = disabled ? "#b0b0b0" : (state.config && state.config.branding && state.config.branding.primary_color) || "#a3a3a3";
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
      const button = createBox("button", "padding:10px 14px;border:1px solid #d8deea;border-radius:12px;background:#fff;color:#1f2937;cursor:pointer;font:600 14px/1.2 'Segoe UI',sans-serif");
      button.type = "button";
      button.textContent = buttonConfig.label;
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
    const heading = createBox("div", "font-weight:600;margin-bottom:8px");
    heading.textContent = title;
    const form = createBox("form", "display:flex;flex-direction:column;gap:8px");
    const inputs = {};
    fields.forEach(function (field) {
      const element = field.multiline ? createBox("textarea", "padding:12px 14px;border-radius:14px;border:1px solid #d8deea;background:#fff;color:#111827;font:400 14px/1.4 'Segoe UI',sans-serif") : createBox("input", "padding:12px 14px;border-radius:14px;border:1px solid #d8deea;background:#fff;color:#111827;font:400 14px/1.4 'Segoe UI',sans-serif");
      if (!field.multiline) {
        element.type = field.type || "text";
      }
      element.placeholder = field.label;
      if (field.value !== undefined) {
        element.value = field.value;
      }
      inputs[field.key] = element;
      form.appendChild(element);
    });
    const submit = createBox("button", "padding:12px 16px;border:none;border-radius:14px;background:#6d28d9;color:#fff;cursor:pointer;font:600 14px/1.2 'Segoe UI',sans-serif");
    submit.type = "submit";
    submit.textContent = "Submit";
    form.appendChild(submit);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const values = {};
      Object.keys(inputs).forEach(function (key) {
        values[key] = inputs[key].value;
      });
      onSubmit(values);
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
        label: state.config.callback_request.button_label || "Request a call",
        onClick: function () {
          showInlineForm(
            "Request a call",
            [
              { key: "name", label: "Name" },
              { key: "phone", label: "Phone" },
              { key: "email", label: "Email", type: "email" },
              { key: "message", label: "Message", multiline: true }
            ],
            function (values) {
              getCaptchaToken("callback")
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
        label: state.config.appointment_request.title || "Request appointment",
        onClick: function () {
          showInlineForm(
            state.config.appointment_request.title || "Request appointment",
            [
              { key: "name", label: "Name" },
              { key: "email", label: "Email", type: "email" },
              { key: "phone", label: "Phone" },
              { key: "service", label: "Service" },
              { key: "preferred_date", label: "Preferred date" },
              { key: "preferred_time", label: "Preferred time" }
            ],
            function (values) {
              getCaptchaToken("appointment")
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
        label: "Check service area",
        onClick: function () {
          showInlineForm("Check service area", [{ key: "query", label: state.config.service_area.input_label || "Enter your city or ZIP" }], function (values) {
            fetchWithPluginAuth("/service-area-check", {
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
            getCaptchaToken("quote")
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

  function applyConfig() {
    if (!state.config) {
      return;
    }

    const title = (window.WCP_CONFIG.siteName || "").trim() || "Assistant";
    const subtitle = (window.WCP_CONFIG.siteTagline || "").trim() || ((state.config.widget && state.config.widget.greeting) ? state.config.widget.greeting : "");
    headerTitle.textContent = title + " Assistant";
    headerSubtitle.textContent = subtitle;
    launcher.textContent = "Chat";
    launcher.style.background = state.config.branding.primary_color || "#6d28d9";
    send.style.background = state.config.branding.primary_color || "#a3a3a3";
    panel.style.borderRadius = state.embedded ? ((state.config.branding.border_radius || 18) + "px") : "0";
    panel.style.fontFamily = state.config.branding.font || "Segoe UI";
    headerSubtitle.style.display = subtitle ? "block" : "none";
    footer.textContent = "Powered by " + title;
    if (state.config.widget.position === "bottom-left") {
      launcher.style.left = "20px";
      launcher.style.right = "auto";
      panel.style.left = "20px";
      panel.style.right = "auto";
    }
    renderFeatureTools();
  }

  function renderRuntimeCtas(ctas) {
    renderButtons(
      actions,
      (ctas || []).map(function (cta) {
        return {
          label: cta.label,
          onClick: function () {
            if (cta.kind === "callback") {
              const button = Array.from(tools.querySelectorAll("button")).find(function (element) {
                return element.textContent === cta.label;
              });
              if (button) {
                button.click();
              }
              return;
            }
            if (cta.kind === "appointment") {
              const button = Array.from(tools.querySelectorAll("button")).find(function (element) {
                return element.textContent === cta.label;
              });
              if (button) {
                button.click();
              }
              return;
            }
            if (cta.kind === "service-area" || cta.kind === "quote") {
              const button = Array.from(tools.querySelectorAll("button")).find(function (element) {
                return element.textContent === cta.label;
              });
              if (button) {
                button.click();
              }
              return;
            }
            window.open(cta.url, "_blank", "noopener,noreferrer");
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
      panel.style.maxWidth = "min(420px, calc(100vw - 24px))";
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
      panel.style.width = "calc(100vw - 12px)";
      panel.style.height = "calc(100vh - 24px)";
      if (state.isPopupMode) {
        panel.style.left = "50%";
        panel.style.right = "auto";
        panel.style.top = "50%";
        panel.style.bottom = "auto";
        panel.style.transform = "translate(-50%, -50%)";
      } else {
        panel.style.bottom = "12px";
        panel.style.right = "6px";
        panel.style.left = "6px";
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
