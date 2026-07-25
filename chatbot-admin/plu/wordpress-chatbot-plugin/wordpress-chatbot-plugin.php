<?php
/**
 * Plugin Name: WordPress Chatbot Connector
 * Plugin URI: https://example.com
 * Description: Thin connector plugin for the centralized WordPress AI chatbot platform.
 * Version: 0.1.0
 * Requires at least: 6.5
 * Requires PHP: 8.1
 * Author: Platform Team
 */

if (!defined('ABSPATH')) {
    exit;
}

define('WCP_PLUGIN_VERSION', '0.1.0');
define('WCP_OPTION_KEY', 'wcp_connector_settings');

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

function wcp_register_settings(): void
{
    register_setting('wcp_connector', WCP_OPTION_KEY);

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
    ?>
    <div class="wrap">
        <h1>Chatbot Connector</h1>
        <form method="post" action="options.php">
            <?php
            settings_fields('wcp_connector');
            do_settings_sections('wcp_connector');
            submit_button('Save Settings');
            ?>
        </form>
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
        plugins_url('widget.js', __FILE__),
        [],
        WCP_PLUGIN_VERSION,
        true
    );

    $settings = wcp_get_settings();
    wp_localize_script('wcp-widget', 'WCP_CONFIG', [
        'backendUrl' => esc_url_raw($settings['backend_url']),
        'clientId' => sanitize_text_field($settings['client_id']),
        'clientSecret' => sanitize_text_field($settings['client_secret']),
        'pluginVersion' => WCP_PLUGIN_VERSION,
        'siteUrl' => home_url('/'),
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
        'notifyEmail' => sanitize_email((string) ($settings['notify_email'] ?? '')),
        'notifyNonce' => wp_create_nonce('wcp_notify_lead'),
    ]);

    wp_enqueue_script('wcp-widget');
}
add_action('wp_enqueue_scripts', 'wcp_enqueue_assets');

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
    check_ajax_referer('wcp_notify_lead', 'nonce');

    $settings = wcp_get_settings();
    if (empty($settings['notify_admin'])) {
        wp_send_json_success(['sent' => false, 'reason' => 'disabled']);
    }

    $email = sanitize_email((string) ($settings['notify_email'] ?? get_option('admin_email')));
    if (!$email) {
        wp_send_json_error(['message' => 'Notification email is not configured.'], 422);
    }

    $name = sanitize_text_field((string) ($_POST['name'] ?? ''));
    $lead_email = sanitize_email((string) ($_POST['email'] ?? ''));
    $phone = sanitize_text_field((string) ($_POST['phone'] ?? ''));
    $message = sanitize_textarea_field((string) ($_POST['message'] ?? ''));
    $site = home_url('/');

    $subject = sprintf('New chatbot lead from %s', wp_parse_url($site, PHP_URL_HOST) ?: $site);
    $body = "A new chatbot lead was submitted.\n\n";
    $body .= "Name: {$name}\n";
    $body .= "Email: {$lead_email}\n";
    $body .= "Phone: {$phone}\n";
    $body .= "Message: {$message}\n";
    $body .= "Site: {$site}\n";

    $sent = wp_mail($email, $subject, $body);
    if (!$sent) {
      wp_send_json_error(['message' => 'wp_mail() failed.'], 500);
    }

    wp_send_json_success(['sent' => true]);
}
add_action('wp_ajax_wcp_notify_lead', 'wcp_send_lead_notification');
add_action('wp_ajax_nopriv_wcp_notify_lead', 'wcp_send_lead_notification');

if (did_action('elementor/loaded')) {
    add_action('elementor/widgets/register', function ($widgets_manager) {
        if (!class_exists('\\Elementor\\Widget_Base')) {
            return;
        }

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
                    ],
                ]);

                $this->add_control('button_label', [
                    'label' => 'Button Label',
                    'type' => \Elementor\Controls_Manager::TEXT,
                    'default' => 'Open Chat',
                ]);

                $this->end_controls_section();
            }

            protected function render(): void
            {
                $settings = $this->get_settings_for_display();
                if (($settings['mode'] ?? 'embed') === 'button') {
                    echo do_shortcode('[wcp_chatbot_trigger label="' . esc_attr((string) ($settings['button_label'] ?? 'Open Chat')) . '"]');
                    return;
                }

                echo do_shortcode('[wcp_chatbot]');
            }
        }

        $widgets_manager->register(new WCP_Elementor_Chatbot_Widget());
    });
}
