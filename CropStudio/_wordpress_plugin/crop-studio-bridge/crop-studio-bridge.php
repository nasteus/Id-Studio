<?php
/**
 * Plugin Name: Crop Studio Bridge for WooCommerce
 * Plugin URI: https://shop.studio77.ro
 * Description: Conecteaza editorul foto Crop Studio cu WooCommerce. Permite maparea dinamica a marimilor foto, asocierea cu ID-urile produselor WooCommerce, adaugarea automata a pozelor in cos la rezolutie de tipar si generarea de arhive ZIP pentru laboratorul foto.
 * Version: 1.0.0
 * Author: Crop Studio Team
 * Author URI: https://shop.studio77.ro
 * Text Domain: crop-studio-bridge
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 * WC tested up to: 9.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

define( 'CROP_STUDIO_BRIDGE_VERSION', '1.0.0' );
define( 'CROP_STUDIO_BRIDGE_FILE', __FILE__ );
define( 'CROP_STUDIO_BRIDGE_DIR', plugin_dir_path( __FILE__ ) );
define( 'CROP_STUDIO_BRIDGE_URL', plugin_dir_url( __FILE__ ) );

/**
 * Declarare compatibilitate HPOS (High-Performance Order Storage)
 */
add_action( 'before_woocommerce_init', function() {
	if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
	}
} );

/**
 * Verifica daca WooCommerce este activ
 */
function csb_check_woocommerce() {
	if ( ! class_exists( 'WooCommerce' ) ) {
		add_action( 'admin_notices', function() {
			echo '<div class="notice notice-error"><p><strong>Crop Studio Bridge</strong> necesita plugin-ul WooCommerce pentru a functiona.</p></div>';
		});
		return false;
	}
	return true;
}

/**
 * Activare plugin: Pre-populare cu cele 7 produse si marimi implicite
 */
register_activation_hook( __FILE__, 'csb_plugin_activate' );
function csb_plugin_activate() {
	// Verifica si initializeaza marimile implicite
	if ( false === get_option( 'crop_studio_sizes' ) ) {
		$default_sizes = array(
			array(
				'id'         => '9:13',
				'label'      => '9 × 13 cm',
				'width_cm'   => 9,
				'height_cm'  => 13,
				'ratio'      => round( 8.9 / 12.7, 4 ),
				'product_id' => 2643,
				'active'     => 1,
				'order'      => 1,
			),
			array(
				'id'         => '10:15',
				'label'      => '10 × 15 cm',
				'width_cm'   => 10,
				'height_cm'  => 15,
				'ratio'      => round( 10.2 / 15.2, 4 ),
				'product_id' => 2647,
				'active'     => 1,
				'order'      => 2,
			),
			array(
				'id'         => '13:18',
				'label'      => '13 × 18 cm',
				'width_cm'   => 13,
				'height_cm'  => 18,
				'ratio'      => round( 12.7 / 19.0, 4 ),
				'product_id' => 2648,
				'active'     => 1,
				'order'      => 3,
			),
			array(
				'id'         => '15:21',
				'label'      => '15 × 21 cm',
				'width_cm'   => 15,
				'height_cm'  => 21,
				'ratio'      => round( 15.2 / 20.3, 4 ),
				'product_id' => 2649,
				'active'     => 1,
				'order'      => 4,
			),
			array(
				'id'         => '20:30',
				'label'      => '20 × 30 cm',
				'width_cm'   => 20,
				'height_cm'  => 30,
				'ratio'      => round( 20.3 / 30.5, 4 ),
				'product_id' => 2650,
				'active'     => 1,
				'order'      => 5,
			),
			array(
				'id'         => '30:40',
				'label'      => '30 × 40 cm',
				'width_cm'   => 30,
				'height_cm'  => 40,
				'ratio'      => round( 30.5 / 40.6, 4 ),
				'product_id' => 2651,
				'active'     => 1,
				'order'      => 6,
			),
			array(
				'id'         => '30:45',
				'label'      => '30 × 45 cm',
				'width_cm'   => 30,
				'height_cm'  => 45,
				'ratio'      => round( 30.5 / 45.0, 4 ),
				'product_id' => 2652,
				'active'     => 1,
				'order'      => 7,
			),
		);
		update_option( 'crop_studio_sizes', $default_sizes );
	}

	// Setari generale implicite
	if ( false === get_option( 'crop_studio_settings' ) ) {
		$default_settings = array(
			'editor_path'        => '/editor/',
			'checkout_redirect'  => 'checkout', // 'checkout' sau 'cart'
			'jpeg_quality'       => 95,
			'enable_zip_archive' => 1,
		);
		update_option( 'crop_studio_settings', $default_settings );
	}

	// Creare folder uploads securizat
	$upload_dir = wp_upload_dir();
	$base_dir = $upload_dir['basedir'] . '/woo-uploads';
	if ( ! file_exists( $base_dir ) ) {
		wp_mkdir_p( $base_dir . '/.tmp' );
	}
}

/**
 * Initializare module
 */
add_action( 'plugins_loaded', 'csb_init_plugin' );
function csb_init_plugin() {
	if ( ! csb_check_woocommerce() ) {
		return;
	}

	// Sesiune WooCommerce activa pentru vizitatori
	add_action( 'init', function() {
		if ( function_exists( 'WC' ) && WC()->session ) {
			if ( ! WC()->session->has_session() ) {
				WC()->session->set_customer_session_cookie( true );
			}
		}
	});

	// Incarcare componente
	require_once CROP_STUDIO_BRIDGE_DIR . 'includes/admin-settings.php';
	require_once CROP_STUDIO_BRIDGE_DIR . 'includes/api-endpoints.php';
	require_once CROP_STUDIO_BRIDGE_DIR . 'includes/order-zip.php';
}
