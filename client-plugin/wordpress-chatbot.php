<?php
/**
 * Plugin Name: WordPress Chatbot Connector
 * Plugin URI: https://example.com
 * Description: Thin connector plugin for the centralized WordPress AI chatbot platform.
 * Version: 0.1.4
 * Requires at least: 6.5
 * Requires PHP: 8.1
 * Author: Platform Team
 */

if (!defined('ABSPATH')) {
    exit;
}

define('WCP_PLUGIN_VERSION', '0.1.4');
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
        'installation_id' => '',
        'installation_secret' => '',
        'activation_code' => '',
        'display_mode' => 'floating',
        'trigger_selector' => '',
        'desktop_only' => '0',
        'mobile_only' => '0',
        'hide_logged_in' => '0',
        'hide_checkout' => '0',
        'include_pages' => '',
        'exclude_pages' => '',
    ];

    $settings = get_option(WCP_OPTION_KEY, []);
    if (!is_array($settings)) {
        return $defaults;
    }

    $stored = array_merge($defaults, $settings);
    return [
        'backend_url' => (string) ($stored['backend_url'] ?? ''),
        'installation_id' => (string) ($stored['installation_id'] ?? $stored['client_id'] ?? ''),
        'installation_secret' => (string) ($stored['installation_secret'] ?? $stored['client_secret'] ?? ''),
        'activation_code' => '',
        'display_mode' => 'floating',
        'trigger_selector' => '',
        'desktop_only' => '0',
        'mobile_only' => '0',
        'hide_logged_in' => '0',
        'hide_checkout' => '0',
        'include_pages' => '',
        'exclude_pages' => '',
    ];
}

function wcp_clear_bootstrap_cache(?string $installationId = null): void
{
    $domain = wcp_get_site_domain();
    if (!$domain || !$installationId) {
        return;
    }

    delete_transient('wcp_bootstrap_' . md5($installationId . '|' . $domain));
    delete_transient('wcp_admin_config_' . md5($installationId . '|' . $domain));
}

function wcp_normalize_settings(array $input, ?array $existing = null): array
{
    $existing = $existing ?: wcp_get_settings();

    $normalized = [
        'backend_url' => esc_url_raw(trim((string) ($input['backend_url'] ?? ''))),
        'installation_id' => sanitize_text_field((string) ($input['installation_id'] ?? $existing['installation_id'] ?? '')),
        'installation_secret' => trim((string) ($input['installation_secret'] ?? $existing['installation_secret'] ?? '')),
        'activation_code' => sanitize_text_field((string) ($input['activation_code'] ?? '')),
        'display_mode' => 'floating',
        'trigger_selector' => '',
        'desktop_only' => '0',
        'mobile_only' => '0',
        'hide_logged_in' => '0',
        'hide_checkout' => '0',
        'include_pages' => '',
        'exclude_pages' => '',
    ];

    if ($normalized['installation_secret'] === '' && $normalized['activation_code'] === '') {
        $normalized['installation_secret'] = (string) ($existing['installation_secret'] ?? '');
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
        ($existing['installation_id'] ?? '') !== ($normalized['installation_id'] ?? '') ||
        ($existing['installation_secret'] ?? '') !== ($normalized['installation_secret'] ?? '')
    ) {
        wcp_clear_bootstrap_cache((string) ($existing['installation_id'] ?? ''));
        wcp_clear_bootstrap_cache((string) ($normalized['installation_id'] ?? ''));
    }

    return $normalized;
}

function wcp_register_settings(): void
{
    register_setting('wcp_connector', WCP_OPTION_KEY, [
        'sanitize_callback' => 'wcp_sanitize_settings',
    ]);
}
add_action('admin_init', 'wcp_register_settings');

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
    $settings = wcp_get_settings();
    $status = sanitize_text_field((string) ($_GET['wcp_status'] ?? ''));
    $message = sanitize_text_field((string) ($_GET['wcp_message'] ?? ''));
    $compatibility = sanitize_text_field((string) ($_GET['wcp_compatibility'] ?? ''));
    $config = null;
    $configError = null;

    if (!empty($settings['backend_url']) && !empty($settings['installation_id']) && !empty($settings['installation_secret'])) {
        $loadedConfig = wcp_get_admin_widget_config();
        if (is_wp_error($loadedConfig)) {
            $configError = $loadedConfig->get_error_message();
        } else {
            $config = $loadedConfig;
        }
    }
    ?>
    <div class="wrap">
        <h1>Chatbot Connector</h1>
        <style>
            .wcp-card-grid { display: grid; gap: 16px; max-width: 720px; }
            .wcp-card { background: #fff; border: 1px solid #dcdcde; border-radius: 8px; padding: 22px; }
            .wcp-card h2 { margin-top: 0; }
            .wcp-status { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; }
            .wcp-status-dot { width: 10px; height: 10px; border-radius: 999px; background: #d63638; }
            .wcp-status.connected .wcp-status-dot { background: #00a32a; }
            .wcp-summary { display: grid; gap: 18px; margin-top: 8px; font-size: 15px; }
            .wcp-summary-block strong { display: block; margin-bottom: 4px; }
            .wcp-feature-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
            .wcp-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
            .wcp-actions form { margin: 0; }
            .wcp-muted { color: #646970; }
        </style>
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

        <div class="wcp-card-grid">
            <div class="wcp-card">
                <?php if ($config) : ?>
                    <?php wcp_render_connected_summary($config); ?>
                <?php elseif ($configError) : ?>
                    <h2>Connect Account</h2>
                    <p class="wcp-status"><span class="wcp-status-dot"></span> Not connected: <?php echo esc_html($configError); ?></p>
                    <?php if (!empty($settings['installation_id']) && !empty($settings['installation_secret'])) : ?>
                        <?php wcp_render_connection_actions(); ?>
                    <?php endif; ?>
                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                        <input type="hidden" name="action" value="wcp_test_connection" />
                        <?php wp_nonce_field('wcp_test_connection', 'wcp_test_connection_nonce'); ?>
                        <?php wcp_render_connection_fields($settings); ?>
                        <?php submit_button('Connect Account'); ?>
                    </form>
                <?php else : ?>
                    <h2>Connect Account</h2>
                    <p class="wcp-status"><span class="wcp-status-dot"></span> Enter the activation code from platform admin.</p>
                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                        <input type="hidden" name="action" value="wcp_test_connection" />
                        <?php wp_nonce_field('wcp_test_connection', 'wcp_test_connection_nonce'); ?>
                        <?php wcp_render_connection_fields($settings); ?>
                        <?php submit_button('Connect Account'); ?>
                    </form>
                <?php endif; ?>
            </div>
        </div>
    </div>
    <?php
}

function wcp_render_connection_fields(array $settings): void
{
    ?>
    <table class="form-table" role="presentation">
        <tbody>
            <tr>
                <th scope="row"><label for="wcp_backend_url">Platform URL</label></th>
                <td><input id="wcp_backend_url" class="regular-text" type="url" name="<?php echo esc_attr(WCP_OPTION_KEY); ?>[backend_url]" value="<?php echo esc_attr((string) ($settings['backend_url'] ?? '')); ?>" placeholder="https://platform.example.com" required /></td>
            </tr>
            <tr>
                <th scope="row"><label for="wcp_activation_code">Activation Code</label></th>
                <td><input id="wcp_activation_code" class="regular-text" type="text" name="<?php echo esc_attr(WCP_OPTION_KEY); ?>[activation_code]" value="" autocomplete="one-time-code" placeholder="ABCD-EFGH-IJKL" required /></td>
            </tr>
        </tbody>
    </table>
    <?php
}

function wcp_render_connected_summary(array $config): void
{
    $businessName = (string) ($config['business']['name'] ?? '');
    if (!$businessName) {
        $businessName = get_bloginfo('name') ?: 'Connected business';
    }

    echo '<h2>&#9989; Connected</h2>';
    echo '<div class="wcp-summary">';
    echo '<div class="wcp-summary-block"><strong>Business:</strong>' . esc_html($businessName) . '</div>';
    echo '<div class="wcp-summary-block"><strong>Platform Status:</strong>Connected</div>';
    echo '<div class="wcp-summary-block"><strong>Features Enabled:</strong>';
    wcp_render_enabled_features($config);
    echo '</div>';
    echo '<p class="description">To change settings, visit your Platform Admin.</p>';
    wcp_render_connection_actions();
    echo '</div>';
}

function wcp_render_connection_actions(): void
{
    ?>
    <div class="wcp-actions">
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <input type="hidden" name="action" value="wcp_reconnect" />
            <?php wp_nonce_field('wcp_reconnect', 'wcp_reconnect_nonce'); ?>
            <?php submit_button('Reconnect', 'secondary', 'submit', false); ?>
        </form>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <input type="hidden" name="action" value="wcp_disconnect" />
            <?php wp_nonce_field('wcp_disconnect', 'wcp_disconnect_nonce'); ?>
            <?php submit_button('Disconnect', 'delete', 'submit', false); ?>
        </form>
    </div>
    <?php
}

function wcp_render_enabled_features(array $config): void
{
    $features = ['AI Chat'];
    if (!empty($config['callback_request']['enabled']) || !empty($config['appointment_request']['enabled']) || !empty($config['quote_calculator']['enabled'])) {
        $features[] = 'Lead Capture';
    }
    if (!empty($config['business_hours']['enabled'])) {
        $features[] = 'Business Hours';
    }
    if (!empty($config['appointment_request']['enabled'])) {
        $features[] = 'Appointment Booking';
    }
    if (!empty($config['callback_request']['enabled'])) {
        $features[] = 'Callback Requests';
    }
    if (!empty($config['service_area']['enabled'])) {
        $features[] = 'Service Area';
    }
    if (!empty($config['quote_calculator']['enabled'])) {
        $features[] = 'Instant Quote';
    }

    echo '<ul class="wcp-feature-list">';
    foreach (array_values(array_unique($features)) as $feature) {
        echo '<li>&#10003; ' . esc_html($feature) . '</li>';
    }
    echo '</ul>';
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
        'installationId' => sanitize_text_field($settings['installation_id']),
        'connectorId' => sanitize_text_field($settings['installation_id']),
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
        'proxyNonce' => wp_create_nonce('wcp_proxy_request'),
    ]);

    wp_enqueue_script('wcp-widget');
}
add_action('wp_enqueue_scripts', 'wcp_enqueue_assets');

function wcp_backend_request(string $path, array $body, array $headers = [], ?array $settingsOverride = null)
{
    $settings = $settingsOverride ?: wcp_get_settings();
    $backend_url = untrailingslashit((string) ($settings['backend_url'] ?? ''));
    if (!$backend_url || ($path !== '/activate' && (empty($settings['installation_id']) || empty($settings['installation_secret'])))) {
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

function wcp_backend_get(string $path, array $headers = [], ?array $settingsOverride = null)
{
    $settings = $settingsOverride ?: wcp_get_settings();
    $backend_url = untrailingslashit((string) ($settings['backend_url'] ?? ''));
    if (!$backend_url) {
        return new WP_Error('wcp_not_configured', 'Backend URL is required.');
    }

    $response = wp_remote_get($backend_url . '/api/v1/plugin' . $path, [
        'timeout' => 15,
        'headers' => $headers,
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

    $cache_key = 'wcp_bootstrap_' . md5((string) $settings['installation_id'] . '|' . $domain);
    $cached = get_transient($cache_key);
    if (is_array($cached) && !empty($cached['token'])) {
        return $cached;
    }

    $result = wcp_backend_request('/verify-installation', [
        'installation_id' => sanitize_text_field((string) $settings['installation_id']),
        'installation_secret' => sanitize_text_field((string) $settings['installation_secret']),
        'domain' => $domain,
        'plugin_version' => WCP_PLUGIN_VERSION,
        'wordpress_version' => get_bloginfo('version'),
        'php_version' => PHP_VERSION,
        'elementor_version' => defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : '',
    ], [
        'Idempotency-Key' => 'verify-installation-' . md5($domain . '|' . (string) $settings['installation_id'] . '|' . hash('sha256', (string) $settings['installation_secret']) . '|' . WCP_PLUGIN_VERSION),
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

    if (empty($settings['backend_url'])) {
        return new WP_Error('wcp_not_configured', 'Platform URL is required.');
    }

    $activationCode = sanitize_text_field((string) ($settings['activation_code'] ?? ''));
    $hasStoredCredentials = !empty($settings['installation_id']) && !empty($settings['installation_secret']);
    if (!$activationCode && !$hasStoredCredentials) {
        return new WP_Error('wcp_not_configured', 'Activation code is required.');
    }

    delete_transient('wcp_bootstrap_' . md5((string) $settings['installation_id'] . '|' . $domain));
    delete_transient('wcp_admin_config_' . md5((string) $settings['installation_id'] . '|' . $domain));

    if ($activationCode) {
        $result = wcp_backend_request('/activate', [
            'activation_code' => $activationCode,
            'domain' => $domain,
            'plugin_version' => WCP_PLUGIN_VERSION,
            'wordpress_version' => get_bloginfo('version'),
            'php_version' => PHP_VERSION,
            'elementor_version' => defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : '',
        ], [
            'Idempotency-Key' => 'activate-' . md5($domain . '|' . hash('sha256', $activationCode) . '|' . microtime(true)),
        ], $settings);
    } else {
        $result = wcp_backend_request('/verify-installation', [
            'installation_id' => sanitize_text_field((string) $settings['installation_id']),
            'installation_secret' => sanitize_text_field((string) $settings['installation_secret']),
            'domain' => $domain,
            'plugin_version' => WCP_PLUGIN_VERSION,
            'wordpress_version' => get_bloginfo('version'),
            'php_version' => PHP_VERSION,
            'elementor_version' => defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : '',
        ], [
            'Idempotency-Key' => 'verify-installation-test-' . md5($domain . '|' . (string) $settings['installation_id'] . '|' . hash('sha256', (string) $settings['installation_secret']) . '|' . microtime(true)),
        ], $settings);
    }

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

    $data = $result['payload']['data'] ?? [];
    if (!empty($data['installation_id']) && !empty($data['installation_secret'])) {
        $settings['installation_id'] = sanitize_text_field((string) $data['installation_id']);
        $settings['installation_secret'] = sanitize_text_field((string) $data['installation_secret']);
        $settings['activation_code'] = '';
    }
    $config = wcp_fetch_widget_config_for_admin((string) ($data['token'] ?? ''), $settings);
    if (!is_wp_error($config)) {
        $data['widget_config'] = $config;
    }

    return $data;
}

function wcp_fetch_widget_config_for_admin(string $token, ?array $settingsOverride = null)
{
    if (!$token) {
        return new WP_Error('wcp_missing_token', 'Connection token is missing.');
    }

    $settings = $settingsOverride ?: wcp_get_settings();
    $domain = wcp_get_site_domain();
    $cache_key = 'wcp_admin_config_' . md5((string) ($settings['installation_id'] ?? '') . '|' . $domain);
    $cached = get_transient($cache_key);
    if (is_array($cached)) {
        return $cached;
    }

    $result = wcp_backend_get('/widget-config', [
        'Authorization' => 'Bearer ' . $token,
    ], $settings);

    if (is_wp_error($result)) {
        return $result;
    }

    if (($result['status'] ?? 500) >= 400 || empty($result['payload']['success'])) {
        return new WP_Error('wcp_config_failed', (string) ($result['payload']['error']['message'] ?? 'Widget configuration could not be loaded.'));
    }

    $config = $result['payload']['data'] ?? [];
    if (is_array($config)) {
        set_transient($cache_key, $config, 5 * MINUTE_IN_SECONDS);
    }

    return $config;
}

function wcp_get_admin_widget_config()
{
    $verification = wcp_verify_backend_session();
    if (is_wp_error($verification)) {
        return $verification;
    }

    return wcp_fetch_widget_config_for_admin((string) ($verification['token'] ?? ''));
}

function wcp_settings_page_url(): string
{
    return add_query_arg(
        [
            'page' => 'wcp-connector',
        ],
        admin_url('options-general.php')
    );
}

function wcp_redirect_with_status(string $status, string $message, array $extra = []): void
{
    wp_safe_redirect(add_query_arg(array_merge([
        'wcp_status' => $status,
        'wcp_message' => $message,
    ], $extra), wcp_settings_page_url()));
    exit;
}

function wcp_handle_test_connection(): void
{
    if (!current_user_can('manage_options')) {
        wp_die('You do not have permission to access this page.');
    }

    check_admin_referer('wcp_test_connection', 'wcp_test_connection_nonce');

    $postedSettings = $_POST[WCP_OPTION_KEY] ?? [];
    $settings = is_array($postedSettings) ? wcp_normalize_settings($postedSettings, wcp_get_settings()) : wcp_get_settings();

    $result = wcp_run_connection_test($settings);
    if (is_wp_error($result)) {
        wcp_redirect_with_status('error', $result->get_error_message());
    }

    if (!empty($result['installation_id']) && !empty($result['installation_secret'])) {
        $settings['installation_id'] = sanitize_text_field((string) $result['installation_id']);
        $settings['installation_secret'] = sanitize_text_field((string) $result['installation_secret']);
    }
    $settings['activation_code'] = '';

    update_option(WCP_OPTION_KEY, $settings);
    wcp_clear_bootstrap_cache((string) ($settings['installation_id'] ?? ''));

    wcp_redirect_with_status('success', 'Connected successfully.', [
        'wcp_compatibility' => (string) ($result['compatibility_status'] ?? 'compatible'),
    ]);
}
add_action('admin_post_wcp_test_connection', 'wcp_handle_test_connection');

function wcp_handle_reconnect(): void
{
    if (!current_user_can('manage_options')) {
        wp_die('You do not have permission to access this page.');
    }

    check_admin_referer('wcp_reconnect', 'wcp_reconnect_nonce');

    $settings = wcp_get_settings();
    $result = wcp_run_connection_test($settings);
    if (is_wp_error($result)) {
        wcp_redirect_with_status('error', $result->get_error_message());
    }

    wcp_redirect_with_status('success', 'Reconnected successfully.', [
        'wcp_compatibility' => (string) ($result['compatibility_status'] ?? 'compatible'),
    ]);
}
add_action('admin_post_wcp_reconnect', 'wcp_handle_reconnect');

function wcp_handle_disconnect(): void
{
    if (!current_user_can('manage_options')) {
        wp_die('You do not have permission to access this page.');
    }

    check_admin_referer('wcp_disconnect', 'wcp_disconnect_nonce');

    $settings = wcp_get_settings();
    wcp_clear_bootstrap_cache((string) ($settings['installation_id'] ?? ''));
    update_option(WCP_OPTION_KEY, [
        'backend_url' => (string) ($settings['backend_url'] ?? ''),
        'installation_id' => '',
        'installation_secret' => '',
        'activation_code' => '',
    ]);

    wcp_redirect_with_status('success', 'Disconnected successfully.');
}
add_action('admin_post_wcp_disconnect', 'wcp_handle_disconnect');

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
