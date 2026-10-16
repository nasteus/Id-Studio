<?php
/**
 * WooCommerce Order Admin ZIP archive generator and photo management for Crop Studio
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Crop_Studio_Order_ZIP {

	public function __construct() {
		// Preview-ul inline 'Fotografii decupate' este dezactivat la cererea utilizatorului
		// add_action( 'woocommerce_after_order_itemmeta', array( $this, 'display_order_item_photos' ), 10, 3 );

		if ( class_exists( 'ZipArchive' ) ) {
			add_action( 'admin_init', array( $this, 'process_zip_download' ) );
			add_action( 'add_meta_boxes', array( $this, 'register_order_metabox' ) );
		}

		// Stergere poze la stergerea comenzii
		add_action( 'before_delete_post', array( $this, 'delete_order_uploads_on_post_delete' ) );
		add_action( 'woocommerce_before_delete_order', array( $this, 'delete_order_uploads_hpos' ) );
		add_action( 'admin_init', array( $this, 'handle_manual_delete_uploads' ) );
	}

	/**
	 * Inregistrare metabox in pagina de comanda WooCommerce (suporta CPT si HPOS)
	 */
	public function register_order_metabox() {
		$screen = function_exists( 'wc_get_page_screen_id' ) ? wc_get_page_screen_id( 'shop_order' ) : 'shop_order';

		add_meta_box(
			'crop-studio-order-zip',
			'Fotografii Comandă',
			array( $this, 'render_order_metabox' ),
			$screen,
			'side',
			'high'
		);

		if ( $screen !== 'shop_order' ) {
			add_meta_box(
				'crop-studio-order-zip',
				'Fotografii Comandă',
				array( $this, 'render_order_metabox' ),
				'shop_order',
				'side',
				'high'
			);
		}
	}

	/**
	 * Randare continut metabox comanda - 1 singur buton direct de descarcare
	 */
	public function render_order_metabox( $post_or_order ) {
		$order = ( $post_or_order instanceof WC_Order ) ? $post_or_order : wc_get_order( $post_or_order );
		if ( ! $order ) {
			echo '<p>Comanda nu a putut fi identificată.</p>';
			return;
		}

		$order_id = $order->get_id();
		$has_uploads = false;
		$total_photos = 0;
		$total_copies = 0;
		$has_edited = false;

		$wp_upload_dir = wp_upload_dir();
		$base_dir = $wp_upload_dir['basedir'] . '/woo-uploads';
		$order_dir = $base_dir . '/' . $order_id . '/';

		foreach ( $order->get_items() as $item ) {
			$uploads = $item->get_meta( 'uploads' );
			if ( ! empty( $uploads ) && is_array( $uploads ) ) {
				$has_uploads = true;
				$total_photos += count( $uploads );
				foreach ( $uploads as $fid => $up ) {
					$total_copies += intval( ! empty( $up['quantity'] ) ? $up['quantity'] : 1 );
					if ( file_exists( $order_dir . $fid . '_edited' ) ) {
						$has_edited = true;
					}
				}
			}
		}

		if ( ! $has_uploads ) {
			echo '<p style="color: #64748b; font-size: 13px;">Această comandă nu conține fotografii încărcate.</p>';
			return;
		}

		$nonce = wp_create_nonce( 'crop_studio_zip_' . $order_id );
		$generate_url = add_query_arg( array(
			'crop_studio_action' => 'stream_zip',
			'order_id'           => $order_id,
			'_wpnonce'           => $nonce,
		), admin_url( 'admin.php' ) );

		$delete_nonce = wp_create_nonce( 'crop_studio_delete_' . $order_id );
		$delete_url = add_query_arg( array(
			'crop_studio_action' => 'delete_order_files',
			'order_id'           => $order_id,
			'_wpnonce'           => $delete_nonce,
		), admin_url( 'admin.php' ) );

		echo '<div class="crop-studio-metabox-content">';
		echo '<div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin-bottom: 12px; font-size: 13px;">';
		echo '<div style="margin-bottom: 4px;"><strong>Fotografii unice:</strong> ' . esc_html( $total_photos ) . ' fișiere</div>';
		echo '<div><strong>Total tiraj (copii):</strong> ' . esc_html( $total_copies ) . ' bucăți</div>';
		if ( $has_edited ) {
			echo '<div style="margin-top: 6px; color: #16a34a; font-weight: 600; font-size: 12px;">✓ Conține versiuni editate (Crop Studio)</div>';
		}
		echo '</div>';

		echo '<p><a href="' . esc_url( $generate_url ) . '" class="button button-primary button-large" style="width: 100%; text-align: center; height: 40px; line-height: 38px; font-weight: bold; background: #2563eb; border-color: #1d4ed8; font-size: 14px; display: block;">⬇ Descarcă Arhivă ZIP</a></p>';

		echo '<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;">';
		echo '<p style="margin-bottom: 0; text-align: right;"><a href="' . esc_url( $delete_url ) . '" onclick="return confirm(\'Ești sigur că vrei să ștergi definitiv fotografiile acestei comenzi de pe disc pentru eliberare spațiu?\');" style="color: #ef4444; font-size: 12px; text-decoration: none;">🗑️ Șterge definitiv fișierele</a></p>';
		echo '</div>';
	}

	/**
	 * Generare si descarcare directa arhiva ZIP cu formatul solicitat: xN NNxNN Tip hartie.jpg
	 */
	public function process_zip_download() {
		if ( ! isset( $_GET['crop_studio_action'] ) || $_GET['crop_studio_action'] !== 'stream_zip' ) {
			return;
		}

		$order_id = ! empty( $_GET['order_id'] ) ? absint( $_GET['order_id'] ) : 0;
		if ( ! $order_id || ! wp_verify_nonce( $_GET['_wpnonce'], 'crop_studio_zip_' . $order_id ) ) {
			wp_die( 'Cerere neautorizată sau link expirat.' );
		}

		if ( ! current_user_can( 'manage_woocommerce' ) && ! current_user_can( 'edit_shop_orders' ) ) {
			wp_die( 'Nu aveți permisiuni suficiente.' );
		}

		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			wp_die( 'Comanda nu există.' );
		}

		@set_time_limit( 300 );
		@ini_set( 'memory_limit', '512M' );

		$wp_upload_dir = wp_upload_dir();
		$base_dir = $wp_upload_dir['basedir'] . '/woo-uploads';
		$order_dir = $base_dir . '/' . $order_id . '/';
		$order_num = sanitize_file_name( str_replace( '#', '', $order->get_order_number() ) );
		$zip_filename = 'comanda_' . ( ! empty( $order_num ) ? $order_num : 'BO_' . $order_id ) . '.zip';
		$zip_path = $order_dir . $zip_filename;

		$zip = new ZipArchive();
		if ( $zip->open( $zip_path, ZipArchive::CREATE | ZipArchive::OVERWRITE ) !== true ) {
			wp_die( 'Nu s-a putut crea fișierul ZIP pe disc.' );
		}

		$has_files = false;

		foreach ( $order->get_items() as $item_id => $item_data ) {
			$uploads = $item_data->get_meta( 'uploads' );
			if ( empty( $uploads ) || ! is_array( $uploads ) ) {
				continue;
			}

			// Extragere marime si tip hartie
			$product_name = $item_data->get_name();
			preg_match( '/(\d+)\s*[x×X]\s*(\d+)/i', $product_name, $dim_match );
			$dimensions = $dim_match ? $dim_match[1] . 'x' . $dim_match[2] : '';
			$paper_type = ( stripos( $product_name, 'lucios' ) !== false ) ? 'Lucios' : 'Mat';

			$counter = 1;
			$total_photos = count( $uploads );

			foreach ( $uploads as $file_id => $info ) {
				// Cauta versiunea editata CropStudio, altfel foloseste originalul
				$edited_path = $order_dir . $file_id . '_edited';
				$orig_path   = $order_dir . $file_id;
				$source_path = file_exists( $edited_path ) ? $edited_path : $orig_path;

				if ( ! file_exists( $source_path ) ) {
					$counter++;
					continue;
				}

				$qty = intval( ! empty( $info['quantity'] ) ? $info['quantity'] : 1 );
				$raw_name = ! empty( $info['filename'] ) ? $info['filename'] : $file_id;
				$ext = pathinfo( $raw_name, PATHINFO_EXTENSION ) ?: 'jpg';

				// Format nume fisier: x4 10x15 Mat.jpg sau x4 10x15 Mat 2.jpg
				if ( ! empty( $dimensions ) ) {
					$base_name = "x{$qty} {$dimensions} {$paper_type}";
				} else {
					$base_name = "x{$qty} " . pathinfo( $raw_name, PATHINFO_FILENAME );
				}

				$zip_entry_name = ( $total_photos > 1 )
					? "{$base_name} {$counter}.{$ext}"
					: "{$base_name}.{$ext}";

				$zip->addFile( $source_path, $zip_entry_name );
				$has_files = true;
				$counter++;
			}
		}

		$zip->close();

		if ( ! $has_files || ! file_exists( $zip_path ) ) {
			wp_die( 'Nu au fost găsite fișiere foto valide pentru a genera arhiva.' );
		}

		// Descarcare directa automata
		header( 'Content-Type: application/zip' );
		header( 'Content-Disposition: attachment; filename="' . $zip_filename . '"' );
		header( 'Content-Length: ' . filesize( $zip_path ) );
		header( 'Pragma: no-cache' );
		header( 'Expires: 0' );
		readfile( $zip_path );
		exit;
	}

	/**
	 * Stergere manuala fisiere comanda
	 */
	public function handle_manual_delete_uploads() {
		if ( ! isset( $_GET['crop_studio_action'] ) || $_GET['crop_studio_action'] !== 'delete_order_files' ) {
			return;
		}

		$order_id = ! empty( $_GET['order_id'] ) ? absint( $_GET['order_id'] ) : 0;
		if ( ! $order_id || ! wp_verify_nonce( $_GET['_wpnonce'], 'crop_studio_delete_' . $order_id ) ) {
			wp_die( 'Cerere neautorizată.' );
		}

		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( 'Nu aveți permisiuni suficiente.' );
		}

		$this->delete_order_directory( $order_id );

		$redirect_back = wp_get_referer() ? wp_get_referer() : admin_url( 'edit.php?post_type=shop_order' );
		wp_safe_redirect( $redirect_back );
		exit;
	}

	public function delete_order_uploads_on_post_delete( $post_id ) {
		if ( 'shop_order' === get_post_type( $post_id ) ) {
			$this->delete_order_directory( $post_id );
		}
	}

	public function delete_order_uploads_hpos( $order ) {
		if ( $order && method_exists( $order, 'get_id' ) ) {
			$this->delete_order_directory( $order->get_id() );
		}
	}

	private function delete_order_directory( $order_id ) {
		$wp_upload_dir = wp_upload_dir();
		$order_dir = $wp_upload_dir['basedir'] . '/woo-uploads/' . $order_id;

		if ( file_exists( $order_dir ) ) {
			require_once ABSPATH . 'wp-admin/includes/class-wp-filesystem-base.php';
			require_once ABSPATH . 'wp-admin/includes/class-wp-filesystem-direct.php';
			$fs = new WP_Filesystem_Direct( array() );
			$fs->delete( $order_dir, true );
		}
	}
}

new Crop_Studio_Order_ZIP();


