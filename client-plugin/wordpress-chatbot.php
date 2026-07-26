<?php
/**
 * Plugin Name: WordPress Chatbot Connector
 * Plugin URI: https://example.com
 * Description: Thin connector plugin for the centralized WordPress AI chatbot platform.
 * Version: 0.1.2
 * Requires at least: 6.5
 * Requires PHP: 8.1
 * Author: Platform Team
 */

if (!defined('ABSPATH')) {
    exit;
}

define('WCP_PLUGIN_VERSION', '0.1.2');
define('WCP_OPTION_KEY', 'wcp_connector_settings');
define('WCP_HEARTBEAT_HOOK', 'wcp_server_heartbeat');

function wcp_get_site_domain(): string
{
    return (string) (wp_parse_url(home_url('/'), PHP_URL_HOST) ?: '');
}

function wcp_get_settings(): array
{
    $defaults = [
        'backend_url' => '',
        'client_id' => '',
        'client_secret' => '',
        'display_mode' => 'floating',
        'trigger_selector' => '',
        'desktop_only' => '0',
        'mobile_only' => '0',
        'hide_logged_in' => '0',
        'hide_checkout' => '1',
        'include_pages' => '',
        'exclude_pages' => '',
        'notify_admin' => '0',
        'notify_email' => get_option('admin_email'),
    ];

    $settings = get_option(WCP_OPTION_KEY, []);
    if (!is_array($settings)) {
        return $defaults;
    }

    return array_merge($defaults, $settings);
}

function wcp_clear_bootstrap_cache(?string $clientId = null): void
{
    $domain = wcp_get_site_domain();
    if (!$domain || !$clientId) {
        return;
    }

    delete_transient('wcp_bootstrap_' . md5($clientId . '|' . $domain));
}

function wcp_normalize_settings(array $input, ?array $existing = null): array
{
    $existing = $existing ?: wcp_get_settings();

    $normalized = [
        'backend_url' => esc_url_raw(trim((string) ($input['backend_url'] ?? ''))),
        'client_id' => sanitize_text_field((string) ($input['client_id'] ?? '')),
        'client_secret' => trim((string) ($input['client_secret'] ?? '')),
        'display_mode' => sanitize_text_field((string) ($input['display_mode'] ?? 'floating')),
        'trigger_selector' => sanitize_text_field((string) ($input['trigger_selector'] ?? '')),
        'desktop_only' => !empty($input['desktop_only']) ? '1' : '0',
        'mobile_only' => !empty($input['mobile_only']) ? '1' : '0',
        'hide_logged_in' => !empty($input['hide_logged_in']) ? '1' : '0',
        'hide_checkout' => !empty($input['hide_checkout']) ? '1' : '0',
        'include_pages' => sanitize_text_field((string) ($input['include_pages'] ?? '')),
        'exclude_pages' => sanitize_text_field((string) ($input['exclude_pages'] ?? '')),
        'notify_admin' => !empty($input['notify_admin']) ? '1' : '0',
        'notify_email' => sanitize_email((string) ($input['notify_email'] ?? '')),
    ];

    if ($normalized['client_secret'] === '') {
        $normalized['client_secret'] = (string) ($existing['client_secret'] ?? '');
    }

    if (!in_array($normalized['display_mode'], ['floating', 'embed', 'button', 'popup'], true)) {
        $normalized['display_mode'] = 'floating';
    }

    return $normalized;
}

function wcp_sanitize_settings($input): array
{
    if (!is_array($input)) {
        return wcp_get_settings();
    }

    $existing = wcp_get_settings();
    $normalized = wcp_normalize_settings($input, $existing);

    if (
        ($existing['backend_url'] ?? '') !== ($normalized['backend_url'] ?? '') ||
        ($existing['client_id'] ?? '') !== ($normalized['client_id'] ?? '') ||
        ($existing['client_secret'] ?? '') !== ($normalized['client_secret'] ?? '')
    ) {
        wcp_clear_bootstrap_cache((string) ($existing['client_id'] ?? ''));
        wcp_clear_bootstrap_cache((string) ($normalized['client_id'] ?? ''));
    }

    return $normalized;
}

function wcp_register_settings(): void
{
    register_setting('wcp_connector', WCP_OPTION_KEY, [
        'sanitize_callback' => 'wcp_sanitize_settings',
    ]);

    add_settings_section('wcp_main', 'Connector Settings', '__return_empty_string', 'wcp_connector');

    foreach ([
        'backend_url' => 'Backend URL',
        'client_id' => 'Client ID',
        'client_secret' => 'Client Secret',
        'display_mode' => 'Display Mode',
        'trigger_selector' => 'Trigger Selector',
        'desktop_only' => 'Desktop Only',
        'mobile_only' => 'Mobile Only',
        'hide_logged_in' => 'Hide For Logged-in Users',
        'hide_checkout' => 'Hide On Checkout',
        'include_pages' => 'Show Only On Pages',
        'exclude_pages' => 'Hide On Pages',
        'notify_admin' => 'Lead Email Notification',
        'notify_email' => 'Notification Email',
    ] as $key => $label) {
        add_settings_field($key, $label, 'wcp_render_field', 'wcp_connector', 'wcp_main', ['key' => $key]);
    }
}
add_action('admin_init', 'wcp_register_settings');

function wcp_render_field(array $args): void
{
    $settings = wcp_get_settings();
    $key = $args['key'];
    if ($key === 'display_mode') {
        ?>
        <select name="<?php echo esc_attr(WCP_OPTION_KEY); ?>[display_mode]">
            <?php foreach (['floating', 'embed', 'button', 'popup'] as $mode) : ?>
                <option value="<?php echo esc_attr($mode); ?>" <?php selected($settings['display_mode'] ?? 'floating', $mode); ?>><?php echo esc_html(ucfirst($mode)); ?></option>
            <?php endforeach; ?>
        </select>
        <?php
        return;
    }

    if (in_array($key, ['desktop_only', 'mobile_only', 'hide_logged_in', 'hide_checkout', 'notify_admin'], true)) {
        printf(
            '<label><input type="checkbox" name="%s[%s]" value="1" %s /> Enabled</label>',
            esc_attr(WCP_OPTION_KEY),
            esc_attr($key),
            checked($settings[$key] ?? '0', '1', false)
        );
        return;
    }

    $type = $key === 'client_secret' ? 'password' : 'text';
    if ($key === 'client_secret') {
        printf(
            '<input type="%s" name="%s[%s]" value="" class="regular-text" autocomplete="new-password" placeholder="%s" />',
            esc_attr($type),
            esc_attr(WCP_OPTION_KEY),
            esc_attr($key),
            esc_attr(!empty($settings['client_secret']) ? 'Leave blank to keep the saved secret' : 'Enter client secret')
        );
        if (!empty($settings['client_secret'])) {
            echo '<p class="description">A client secret is already saved. Enter a new one only if you want to replace it.</p>';
        }
        return;
    }

    printf(
        '<input type="%s" name="%s[%s]" value="%s" class="regular-text" />',
        esc_attr($type),
        esc_attr(WCP_OPTION_KEY),
        esc_attr($key),
        esc_attr($settings[$key] ?? '')
    );
}

function wcp_register_menu(): void
{
    add_options_page(
        'Chatbot Connector',
        'Chatbot Connector',
        'manage_options',
        'wcp-connector',
        'wcp_render_settings_page'
    );
}
add_action('admin_menu', 'wcp_register_menu');

function wcp_render_settings_page(): void
{
    $status = sanitize_text_field((string) ($_GET['wcp_status'] ?? ''));
    $message = sanitize_text_field((string) ($_GET['wcp_message'] ?? ''));
    $compatibility = sanitize_text_field((string) ($_GET['wcp_compatibility'] ?? ''));
    ?>
    <div class="wrap">
        <h1>Chatbot Connector</h1>
        <?php if ($status && $message) : ?>
            <div class="notice notice-<?php echo $status === 'success' ? 'success' : 'error'; ?> is-dismissible">
                <p>
                    <strong><?php echo esc_html($message); ?></strong>
                    <?php if ($compatibility) : ?>
                        <br />
                        <span>Compatibility: <?php echo esc_html($compatibility); ?></span>
                    <?php endif; ?>
                </p>
            </div>
        <?php endif; ?>
        <form method="post" action="options.php">
            <?php
            settings_fields('wcp_connector');
            wp_nonce_field('wcp_test_connection', 'wcp_test_connection_nonce');
            do_settings_sections('wcp_connector');
            submit_button('Save Settings');
            ?>
            <button type="submit" class="button button-secondary" name="action" value="wcp_test_connection" formaction="<?php echo esc_url(admin_url('admin-post.php')); ?>" formmethod="post">Save and Test Connection</button>
        </form>
        <p class="description">Save and Test Connection stores the current values, clears cached verification state, and tests exactly what the live widget will use.</p>
    </div>
    <?php
}

function wcp_enqueue_assets(): void
{
    if (is_admin()) {
        return;
    }

    wp_register_script(
        'wcp-widget',
        plugins_url('public/widget.js', __FILE__),
        [],
        WCP_PLUGIN_VERSION,
        true
    );

    $settings = wcp_get_settings();
    wp_localize_script('wcp-widget', 'WCP_CONFIG', [
        'backendUrl' => esc_url_raw($settings['backend_url']),
        'clientId' => sanitize_text_field($settings['client_id']),
        'pluginVersion' => WCP_PLUGIN_VERSION,
        'siteUrl' => home_url('/'),
        'siteHost' => wcp_get_site_domain(),
        'siteName' => get_bloginfo('name'),
        'siteTagline' => get_bloginfo('description'),
        'wordpressVersion' => get_bloginfo('version'),
        'phpVersion' => PHP_VERSION,
        'elementorVersion' => defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : '',
        'displayMode' => sanitize_text_field($settings['display_mode']),
        'triggerSelector' => sanitize_text_field($settings['trigger_selector']),
        'desktopOnly' => !empty($settings['desktop_only']),
        'mobileOnly' => !empty($settings['mobile_only']),
        'hideLoggedIn' => !empty($settings['hide_logged_in']),
        'hideCheckout' => !empty($settings['hide_checkout']),
        'includePages' => array_values(array_filter(array_map('trim', explode(',', (string) ($settings['include_pages'] ?? ''))))),
        'excludePages' => array_values(array_filter(array_map('trim', explode(',', (string) ($settings['exclude_pages'] ?? ''))))),
        'isLoggedIn' => is_user_logged_in(),
        'currentPath' => wp_parse_url(home_url(add_query_arg([], $GLOBALS['wp']->request ?? '')), PHP_URL_PATH) ?: '/',
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'notifyAdmin' => !empty($settings['notify_admin']),
        'proxyNonce' => wp_create_nonce('wcp_proxy_request'),
    ]);

    wp_enqueue_script('wcp-widget');
}
add_action('wp_enqueue_scripts', 'wcp_enqueue_assets');

function wcp_backend_request(string $path, array $body, array $headers = [], ?array $settingsOverride = null)
{
    $settings = $settingsOverride ?: wcp_get_settings();
    $backend_url = untrailingslashit((string) ($settings['backend_url'] ?? ''));
    if (!$backend_url || empty($settings['client_id']) || empty($settings['client_secret'])) {
        return new WP_Error('wcp_not_configured', 'Connector settings are incomplete.');
    }

    $response = wp_remote_post($backend_url . '/api/v1/plugin' . $path, [
        'timeout' => 15,
        'headers' => array_merge([
            'Content-Type' => 'application/json',
        ], $headers),
        'body' => wp_json_encode($body),
    ]);

    if (is_wp_error($response)) {
        return $response;
    }

    $payload = json_decode((string) wp_remote_retrieve_body($response), true);
    $rawBody = (string) wp_remote_retrieve_body($response);
    return [
        'status' => (int) wp_remote_retrieve_response_code($response),
        'payload' => is_array($payload) ? $payload : [],
        'raw_body' => $rawBody,
    ];
}

function wcp_get_request_ip(): string
{
    return sanitize_text_field((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
}

function wcp_enforce_rate_limit(string $action, int $maxAttempts, int $windowSeconds): bool
{
    $key = 'wcp_rl_' . md5($action . '|' . wcp_get_request_ip());
    $attempts = (int) get_transient($key);
    if ($attempts >= $maxAttempts) {
        return false;
    }

    set_transient($key, $attempts + 1, $windowSeconds);
    return true;
}

function wcp_enforce_request_size(int $maxBytes): bool
{
    $contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
    if ($contentLength > 0 && $contentLength > $maxBytes) {
        return false;
    }

    return true;
}

function wcp_verify_backend_session()
{
    $settings = wcp_get_settings();
    $domain = wcp_get_site_domain();
    if (!$domain) {
        return new WP_Error('wcp_invalid_domain', 'Site domain could not be determined.');
    }

    $cache_key = 'wcp_bootstrap_' . md5((string) $settings['client_id'] . '|' . $domain);
    $cached = get_transient($cache_key);
    if (is_array($cached) && !empty($cached['token'])) {
        return $cached;
    }

    $result = wcp_backend_request('/verify', [
        'client_id' => sanitize_text_field((string) $settings['client_id']),
        'client_secret' => sanitize_text_field((string) $settings['client_secret']),
        'domain' => $domain,
        'plugin_version' => WCP_PLUGIN_VERSION,
        'wordpress_version' => get_bloginfo('version'),
        'php_version' => PHP_VERSION,
        'elementor_version' => defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : '',
    ], [
        'Idempotency-Key' => 'verify-' . md5($domain . '|' . WCP_PLUGIN_VERSION),
    ]);

    if (is_wp_error($result)) {
        return $result;
    }

    if (($result['status'] ?? 500) >= 400 || empty($result['payload']['success']) || empty($result['payload']['data']['token'])) {
        return new WP_Error('wcp_verify_failed', (string) ($result['payload']['error']['message'] ?? 'Plugin verification failed.'));
    }

    $data = $result['payload']['data'];
    set_transient($cache_key, $data, 5 * MINUTE_IN_SECONDS);

    return $data;
}

function wcp_run_connection_test(?array $settingsOverride = null)
{
    $settings = $settingsOverride ?: wcp_get_settings();
    $domain = wcp_get_site_domain();
    if (!$domain) {
        return new WP_Error('wcp_invalid_domain', 'Site domain could not be determined.');
    }

    if (empty($settings['backend_url']) || empty($settings['client_id']) || empty($settings['client_secret'])) {
        return new WP_Error('wcp_not_configured', 'Backend URL, Client ID, and Client Secret are required.');
    }

    delete_transient('wcp_bootstrap_' . md5((string) $settings['client_id'] . '|' . $domain));

    $result = wcp_backend_request('/verify', [
        'client_id' => sanitize_text_field((string) $settings['client_id']),
        'client_secret' => sanitize_text_field((string) $settings['client_secret']),
        'domain' => $domain,
        'plugin_version' => WCP_PLUGIN_VERSION,
        'wordpress_version' => get_bloginfo('version'),
        'php_version' => PHP_VERSION,
        'elementor_version' => defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : '',
    ], [
        'Idempotency-Key' => 'verify-' . md5($domain . '|' . WCP_PLUGIN_VERSION . '|manual-test'),
    ], $settings);

    if (is_wp_error($result)) {
        return $result;
    }

    if (($result['status'] ?? 500) >= 400 || empty($result['payload']['success'])) {
        return new WP_Error(
            'wcp_verify_failed',
            (string) ($result['payload']['error']['message'] ?? ('Plugin verification failed with status ' . (int) ($result['status'] ?? 500) . '.')),
            [
                'status' => (int) ($result['status'] ?? 500),
                'payload' => $result['payload'],
                'raw_body' => $result['raw_body'] ?? '',
            ]
        );
    }

    return $result['payload']['data'] ?? [];
}

function wcp_handle_test_connection(): void
{
    if (!current_user_can('manage_options')) {
        wp_die('You do not have permission to access this page.');
    }

    check_admin_referer('wcp_test_connection', 'wcp_test_connection_nonce');

    $redirectUrl = add_query_arg(
        [
            'page' => 'wcp-connector',
        ],
        admin_url('options-general.php')
    );

    $postedSettings = $_POST[WCP_OPTION_KEY] ?? [];
    $settings = is_array($postedSettings) ? wcp_normalize_settings($postedSettings, wcp_get_settings()) : wcp_get_settings();
    update_option(WCP_OPTION_KEY, $settings);
    wcp_clear_bootstrap_cache((string) ($settings['client_id'] ?? ''));

    $result = wcp_run_connection_test($settings);
    if (is_wp_error($result)) {
        wp_safe_redirect(
            add_query_arg(
                [
                    'wcp_status' => 'error',
                    'wcp_message' => $result->get_error_message(),
                ],
                $redirectUrl
            )
        );
        exit;
    }

    wp_safe_redirect(
        add_query_arg(
            [
                'wcp_status' => 'success',
                'wcp_message' => 'Connected successfully.',
                'wcp_compatibility' => (string) ($result['compatibility_status'] ?? 'compatible'),
            ],
            $redirectUrl
        )
    );
    exit;
}
add_action('admin_post_wcp_test_connection', 'wcp_handle_test_connection');

function wcp_send_server_heartbeat(): void
{
    $verification = wcp_verify_backend_session();
    if (is_wp_error($verification) || empty($verification['token'])) {
        return;
    }

    $settings = wcp_get_settings();
    $domain = wcp_get_site_domain();
    if (!$domain) {
        return;
    }

    wcp_backend_request('/heartbeat', [
        'client_id' => sanitize_text_field((string) $settings['client_id']),
        'domain' => $domain,
        'plugin_version' => WCP_PLUGIN_VERSION,
        'wordpress_version' => get_bloginfo('version'),
        'php_version' => PHP_VERSION,
        'elementor_version' => defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : '',
    ], [
        'Authorization' => 'Bearer ' . $verification['token'],
    ]);
}

function wcp_schedule_heartbeat(): void
{
    if (!wp_next_scheduled(WCP_HEARTBEAT_HOOK)) {
        wp_schedule_event(time() + HOUR_IN_SECONDS, 'twicedaily', WCP_HEARTBEAT_HOOK);
    }
}

register_activation_hook(__FILE__, 'wcp_schedule_heartbeat');

register_deactivation_hook(__FILE__, function (): void {
    wp_clear_scheduled_hook(WCP_HEARTBEAT_HOOK);
});

add_action('init', 'wcp_schedule_heartbeat');
add_action(WCP_HEARTBEAT_HOOK, 'wcp_send_server_heartbeat');

function wcp_render_shortcode(): string
{
    return '<div class="wcp-chatbot-embed" data-wcp-embed="1"></div>';
}
add_shortcode('wcp_chatbot', 'wcp_render_shortcode');

function wcp_render_trigger_shortcode($atts): string
{
    $atts = shortcode_atts([
        'label' => 'Open Chat',
    ], $atts);

    return sprintf(
        '<button type="button" class="wcp-chatbot-trigger" data-wcp-trigger="1">%s</button>',
        esc_html((string) $atts['label'])
    );
}
add_shortcode('wcp_chatbot_trigger', 'wcp_render_trigger_shortcode');

function wcp_send_lead_notification(): void
{
    check_ajax_referer('wcp_proxy_request', 'nonce');

    if (!wcp_enforce_request_size(32 * 1024)) {
        wp_send_json_error(['message' => 'Lead submission payload is too large.'], 413);
    }

    if (!wcp_enforce_rate_limit('lead_proxy', 20, HOUR_IN_SECONDS)) {
        wp_send_json_error(['message' => 'Too many lead submissions. Please try again later.'], 429);
    }

    $verification = wcp_verify_backend_session();
    if (is_wp_error($verification)) {
        wp_send_json_error(['message' => $verification->get_error_message()], 502);
    }

    $name = sanitize_text_field((string) ($_POST['name'] ?? ''));
    $lead_email = sanitize_email((string) ($_POST['email'] ?? ''));
    $phone = sanitize_text_field((string) ($_POST['phone'] ?? ''));
    $message = sanitize_textarea_field((string) ($_POST['message'] ?? ''));
    $status = sanitize_text_field((string) ($_POST['status'] ?? 'new'));
    $captcha_token = sanitize_text_field((string) ($_POST['captcha_token'] ?? ''));
    $data = json_decode(wp_unslash((string) ($_POST['data'] ?? '{}')), true);
    if (!is_array($data)) {
        $data = [];
    }

    $result = wcp_backend_request('/lead', [
        'name' => $name ?: null,
        'email' => $lead_email ?: null,
        'phone' => $phone ?: null,
        'status' => $status ?: 'new',
        'message' => $message ?: null,
        'data' => $data,
        'captcha_token' => $captcha_token ?: null,
    ], [
        'Authorization' => 'Bearer ' . $verification['token'],
        'Idempotency-Key' => wp_generate_uuid4(),
    ]);

    if (is_wp_error($result)) {
        wp_send_json_error(['message' => $result->get_error_message()], 502);
    }

    if (($result['status'] ?? 500) >= 400 || empty($result['payload']['success'])) {
        wp_send_json_error(['message' => (string) ($result['payload']['error']['message'] ?? 'Lead submission failed.')], $result['status'] ?? 500);
    }

    $settings = wcp_get_settings();
    if (!empty($settings['notify_admin'])) {
        $email = sanitize_email((string) ($settings['notify_email'] ?? get_option('admin_email')));
        if ($email) {
            $site = home_url('/');
            $subject = sprintf('New chatbot lead from %s', wp_parse_url($site, PHP_URL_HOST) ?: $site);
            $body = "A new chatbot lead was submitted.\n\n";
            $body .= "Name: {$name}\n";
            $body .= "Email: {$lead_email}\n";
            $body .= "Phone: {$phone}\n";
            $body .= "Message: {$message}\n";
            $body .= "Site: {$site}\n";
            wp_mail($email, $subject, $body);
        }
    }

    wp_send_json_success($result['payload']['data'] ?? ['submitted' => true]);
}
add_action('wp_ajax_wcp_notify_lead', 'wcp_send_lead_notification');
add_action('wp_ajax_nopriv_wcp_notify_lead', 'wcp_send_lead_notification');

function wcp_bootstrap_plugin(): void
{
    check_ajax_referer('wcp_proxy_request', 'nonce');

    if (!wcp_enforce_request_size(8 * 1024)) {
        wp_send_json_error(['message' => 'Bootstrap payload is too large.'], 413);
    }

    if (!wcp_enforce_rate_limit('bootstrap', 60, 10 * MINUTE_IN_SECONDS)) {
        wp_send_json_error(['message' => 'Too many bootstrap requests. Please try again shortly.'], 429);
    }

    $verification = wcp_verify_backend_session();
    if (is_wp_error($verification)) {
        wp_send_json_error(['message' => $verification->get_error_message()], 502);
    }

    wp_send_json_success([
        'token' => $verification['token'],
        'config_version' => $verification['config_version'] ?? 0,
        'cache_ttl_seconds' => $verification['cache_ttl_seconds'] ?? 300,
    ]);
}
add_action('wp_ajax_wcp_bootstrap_plugin', 'wcp_bootstrap_plugin');
add_action('wp_ajax_nopriv_wcp_bootstrap_plugin', 'wcp_bootstrap_plugin');

function wcp_register_elementor_widget($widgets_manager): void
{
    if (!class_exists('\\Elementor\\Widget_Base')) {
        return;
    }

    if (!class_exists('WCP_Elementor_Chatbot_Widget')) {
        class WCP_Elementor_Chatbot_Widget extends \Elementor\Widget_Base
        {
            public function get_name(): string
            {
                return 'wcp_chatbot_widget';
            }

            public function get_title(): string
            {
                return 'Chatbot Widget';
            }

            public function get_icon(): string
            {
                return 'eicon-comments';
            }

            public function get_categories(): array
            {
                return ['general'];
            }

            protected function register_controls(): void
            {
                $this->start_controls_section('content_section', [
                    'label' => 'Chatbot',
                ]);

                $this->add_control('mode', [
                    'label' => 'Mode',
                    'type' => \Elementor\Controls_Manager::SELECT,
                    'default' => 'embed',
                    'options' => [
                        'embed' => 'Embed',
                        'button' => 'Button Trigger',
                        'popup' => 'Popup Trigger',
                    ],
                ]);

                $this->add_control('button_label', [
                    'label' => 'Trigger Label',
                    'type' => \Elementor\Controls_Manager::TEXT,
                    'default' => 'Open Chat',
                ]);

                $this->end_controls_section();
            }

            protected function render(): void
            {
                $settings = $this->get_settings_for_display();
                $mode = (string) ($settings['mode'] ?? 'embed');
                if ($mode === 'button' || $mode === 'popup') {
                    echo do_shortcode('[wcp_chatbot_trigger label="' . esc_attr((string) ($settings['button_label'] ?? 'Open Chat')) . '"]');
                    return;
                }

                echo do_shortcode('[wcp_chatbot]');
            }
        }
    }

    $widgets_manager->register(new WCP_Elementor_Chatbot_Widget());
}

add_action('elementor/widgets/register', 'wcp_register_elementor_widget');
