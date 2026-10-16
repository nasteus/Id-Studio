<?php
/**
 * REST API Endpoints & Cart Integration for Crop Studio
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Crop_Studio_API_Endpoints {

	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );

		// WooCommerce Cart & Checkout integration
		add_filter( 'woocommerce_cart_item_quantity', array( $this, 'cart_quantity_display' ), 10, 3 );
		add_action( 'woocommerce_before_calculate_totals', array( $this, 'calculate_cart_totals' ), 20, 1 );
		add_action( 'woocommerce_remove_cart_item', array( $this, 'delete_cart_item_uploads' ), 10, 2 );
		add_filter( 'woocommerce_cart_item_name', array( $this, 'cart_item_name_with_previews' ), 10, 3 );
		add_action( 'woocommerce_checkout_create_order_line_item', array( $this, 'add_order_line_item_meta' ), 10, 4 );
		add_action( 'woocommerce_new_order', array( $this, 'move_uploads_to_order' ), 99, 2 );
		
		// Fallback for direct AJAX if REST API is restricted
		add_action( 'wp_ajax_crop_studio_config', array( $this, 'ajax_get_config' ) );
		add_action( 'wp_ajax_nopriv_crop_studio_config', array( $this, 'ajax_get_config' ) );
		add_action( 'wp_ajax_crop_studio_checkout', array( $this, 'ajax_checkout' ) );
		add_action( 'wp_ajax_nopriv_crop_studio_checkout', array( $this, 'ajax_checkout' ) );
	}

	/**
	 * Inregistrare rute REST API
	 */
	public function register_routes() {
		register_rest_route( 'crop-studio/v1', '/config', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'get_config' ),
			'permission_callback' => '__return_true',
		) );

		register_rest_route( 'crop-studio/v1', '/checkout', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'handle_checkout_upload' ),
			'permission_callback' => '__return_true',
		) );
	}

	/**
	 * Endpoint GET: Configurare marimi si produse active
	 */
	public function get_config( $request ) {
		$sizes = get_option( 'crop_studio_sizes', array() );
		$settings = get_option( 'crop_studio_settings', array() );

		// Filtram doar marimile active si adaugam detalii pret WooCommerce daca exista
		$active_sizes = array();
		foreach ( $sizes as $size ) {
			if ( empty( $size['active'] ) ) {
				continue;
			}
			$product_id = absint( $size['product_id'] );
			$price = 0;
			$price_html = '';
			$product_title = '';
			$in_stock = true;

			if ( $product_id > 0 && function_exists( 'wc_get_product' ) ) {
				$product = wc_get_product( $product_id );
				if ( $product ) {
					$price = $product->get_price();
					$price_html = $product->get_price_html();
					$product_title = $product->get_name();
					$in_stock = $product->is_in_stock();
				}
			}

			$active_sizes[] = array(
				'id'            => $size['id'],
				'label'         => $size['label'],
				'width_cm'      => floatval( $size['width_cm'] ),
				'height_cm'     => floatval( $size['height_cm'] ),
				'ratio'         => floatval( $size['ratio'] ),
				'product_id'    => $product_id,
				'product_title' => $product_title,
				'price'         => floatval( $price ),
				'price_html'    => $price_html,
				'in_stock'      => $in_stock,
			);
		}

		$currency_symbol = function_exists( 'get_woocommerce_currency_symbol' ) ? get_woocommerce_currency_symbol() : 'lei';
		$currency = function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : 'RON';

		return rest_ensure_response( array(
			'success'  => true,
			'sizes'    => $active_sizes,
			'currency' => $currency,
			'currency_symbol' => $currency_symbol,
			'finishes' => array(
				array( 'id' => 'glossy', 'label' => 'Lucios' ),
				array( 'id' => 'matte', 'label' => 'Mat' ),
			),
			'settings' => array(
				'checkout_redirect' => ! empty( $settings['checkout_redirect'] ) ? $settings['checkout_redirect'] : 'checkout',
				'jpeg_quality'      => ! empty( $settings['jpeg_quality'] ) ? intval( $settings['jpeg_quality'] ) : 95,
			),
		) );
	}

	public function ajax_get_config() {
		$response = $this->get_config( null );
		wp_send_json( $response->get_data() );
	}

	/**
	 * Endpoint POST: Upload imagini finale 300 DPI si trimitere in cosul WooCommerce
	 */
	public function handle_checkout_upload( $request ) {
		// Ensure WooCommerce Cart and Session are initialized in REST API
		if ( function_exists( 'WC' ) ) {
			if ( is_null( WC()->session ) ) {
				WC()->session = new WC_Session_Handler();
				WC()->session->init();
			}
			if ( is_null( WC()->customer ) ) {
				WC()->customer = new WC_Customer( get_current_user_id(), true );
			}
			if ( is_null( WC()->cart ) ) {
				WC()->cart = new WC_Cart();
			}
		}

		if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
			return new WP_Error( 'wc_unavailable', 'WooCommerce nu este disponibil.', array( 'status' => 500 ) );
		}

		// Asigurare sesiune WC activa
		if ( WC()->session && ! WC()->session->has_session() ) {
			WC()->session->set_customer_session_cookie( true );
		}

		// 1. Direct Session Checkout if no multipart files are posted
		if ( empty( $_FILES ) ) {
			global $wpdb;
			$customer_id = '';
			$cookie_prefix = 'wp_woocommerce_session_';
			foreach ( $_COOKIE as $c_name => $c_val ) {
				if ( strpos( $c_name, $cookie_prefix ) === 0 ) {
					$parts = preg_split( '/(\|\||\|)/', urldecode( $c_val ) );
					if ( ! empty( $parts[0] ) && preg_match( '/^[a-zA-Z0-9_-]+$/', $parts[0] ) ) {
						$customer_id = sanitize_text_field( $parts[0] );
						break;
					}
				}
			}
			if ( empty( $customer_id ) && WC()->session ) {
				$customer_id = WC()->session->get_customer_id();
			}

			$session_data = array();
			if ( ! empty( $customer_id ) ) {
				$row = $wpdb->get_var( $wpdb->prepare( "SELECT session_value FROM {$wpdb->prefix}woocommerce_sessions WHERE session_key = %s", $customer_id ) );
				if ( $row ) {
					$session_data = maybe_unserialize( $row );
					if ( ! is_array( $session_data ) ) $session_data = array();
				}
			}

			if ( WC()->session ) {
				$in_memory = WC()->session->get_session_data();
				if ( is_array( $in_memory ) ) {
					$session_data = array_merge( $session_data, $in_memory );
				}
			}

			$added_count = 0;
			$items_to_clear = array();

			foreach ( $session_data as $key => $val ) {
				if ( strpos( $key, '_tmp_uploads' ) !== false ) {
					$uploads = maybe_unserialize( $val );
					if ( is_array( $uploads ) && ! empty( $uploads ) ) {
						$pid = intval( str_replace( '_tmp_uploads', '', $key ) );
						if ( $pid > 0 && function_exists( 'wc_get_product' ) && wc_get_product( $pid ) ) {
							$total_qty = 0;
							foreach ( $uploads as $fid => $uinfo ) {
								$total_qty += max( 1, intval( isset( $uinfo['quantity'] ) ? $uinfo['quantity'] : 1 ) );
							}
							$cart_item_data = array(
								'uploads'    => $uploads,
								'upload_dir' => $customer_id,
							);
							WC()->cart->add_to_cart( $pid, $total_qty, 0, array(), $cart_item_data );
							$added_count++;
							$items_to_clear[] = $key;
						}
					}
				}
			}

			foreach ( $items_to_clear as $clear_key ) {
				$session_data[ $clear_key ] = maybe_serialize( array() );
				if ( WC()->session ) {
					WC()->session->set( $clear_key, array() );
				}
			}
			if ( WC()->session && method_exists( WC()->session, 'save_data' ) ) {
				WC()->session->save_data();
			}
			if ( ! empty( $customer_id ) && ! empty( $session_data ) ) {
				$wpdb->replace(
					"{$wpdb->prefix}woocommerce_sessions",
					array(
						'session_key'    => $customer_id,
						'session_value'  => maybe_serialize( $session_data ),
						'session_expiry' => time() + 86400 * 7,
					)
				);
			}

			WC()->cart->calculate_totals();

			return rest_ensure_response( array(
				'success'      => true,
				'added_count'  => $added_count,
				'redirect_url' => wc_get_cart_url(),
				'cart_count'   => WC()->cart->get_cart_contents_count(),
				'message'      => 'Fotografiile au fost transferate cu succes in cos!',
			) );
		}

		// Grupari pe product_id pentru adaugare in cos
		// $products_cart_items[ $product_id ] = [ 'uploads' => [ ... ], 'quantity' => total ]
		$products_cart_items = array();

		foreach ( $items_data as $index => $item_meta ) {
			$file_key = ! empty( $item_meta['file_field'] ) ? sanitize_text_field( $item_meta['file_field'] ) : ( 'photo_' . $index );
			
			if ( empty( $_FILES[ $file_key ] ) || ! empty( $_FILES[ $file_key ]['error'] ) ) {
				continue; // Skip if file upload failed
			}

			$uploaded_file = $_FILES[ $file_key ];
			$original_filename = sanitize_file_name( ! empty( $item_meta['filename'] ) ? $item_meta['filename'] : $uploaded_file['name'] );
			if ( empty( $original_filename ) ) {
				$original_filename = 'foto_' . ( $index + 1 ) . '.jpg';
			}

			// Nume fisier unic securizat pe disc
			$ext = pathinfo( $original_filename, PATHINFO_EXTENSION );
			if ( empty( $ext ) ) {
				$ext = 'jpg';
			}
			$stored_file_id = 'img_' . ( $index + 1 ) . '_' . substr( md5( $original_filename . microtime() ), 0, 10 ) . '.' . $ext;
			$target_path = $tmp_dir . $stored_file_id;

			if ( ! move_uploaded_file( $uploaded_file['tmp_name'], $target_path ) ) {
				continue;
			}

			// Generare thumbnail 160px pentru preview cos si comanda
			$this->generate_thumbnail( $target_path, $tmp_thumb_dir . $stored_file_id, 160 );

			$product_id = absint( ! empty( $item_meta['product_id'] ) ? $item_meta['product_id'] : 0 );
			$quantity = max( 1, absint( ! empty( $item_meta['quantity'] ) ? $item_meta['quantity'] : 1 ) );
			$finish = ! empty( $item_meta['finish'] ) ? sanitize_text_field( $item_meta['finish'] ) : 'Lucios';
			$size_label = ! empty( $item_meta['size_label'] ) ? sanitize_text_field( $item_meta['size_label'] ) : '';

			if ( ! isset( $products_cart_items[ $product_id ] ) ) {
				$products_cart_items[ $product_id ] = array(
					'uploads'    => array(),
					'total_qty'  => 0,
					'size_label' => $size_label,
					'finish'     => $finish,
				);
			}

			$products_cart_items[ $product_id ]['uploads'][ $stored_file_id ] = array(
				'filename'   => $original_filename,
				'quantity'   => $quantity,
				'finish'     => $finish,
				'size_label' => $size_label,
			);
			$products_cart_items[ $product_id ]['total_qty'] += $quantity;
		}

		if ( empty( $products_cart_items ) ) {
			return new WP_Error( 'no_valid_uploads', 'Nicio fotografie nu a putut fi procesata.', array( 'status' => 400 ) );
		}

		// Adaugare in cos WooCommerce
		foreach ( $products_cart_items as $product_id => $cart_group ) {
			if ( $product_id <= 0 ) {
				continue;
			}

			$cart_item_data = array(
				'uploads'    => $cart_group['uploads'],
				'upload_dir' => $upload_batch_id,
				'finish'     => $cart_group['finish'],
				'size_label' => $cart_group['size_label'],
			);

			WC()->cart->add_to_cart( $product_id, $cart_group['total_qty'], 0, array(), $cart_item_data );
		}

		// Calculare totaluri
		WC()->cart->calculate_totals();

		$settings = get_option( 'crop_studio_settings', array() );
		$redirect_type = ! empty( $settings['checkout_redirect'] ) ? $settings['checkout_redirect'] : 'checkout';
		$redirect_url = ( $redirect_type === 'cart' ) ? wc_get_cart_url() : wc_get_checkout_url();

		return rest_ensure_response( array(
			'success'      => true,
			'redirect_url' => $redirect_url,
			'cart_count'   => WC()->cart->get_cart_contents_count(),
			'message'      => 'Fotografiile au fost transferate cu succes in cos!',
		) );
	}

	public function ajax_checkout() {
		$result = $this->handle_checkout_upload( null );
		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		} else {
			wp_send_json( $result->get_data() );
		}
	}

	/**
	 * Generare thumbnail mic pentru preview rapid
	 */
	private function generate_thumbnail( $src_path, $dest_path, $max_dim = 160 ) {
		if ( ! file_exists( $src_path ) ) {
			return;
		}

		if ( function_exists( 'wp_get_image_editor' ) ) {
			$editor = wp_get_image_editor( $src_path );
			if ( ! is_wp_error( $editor ) ) {
				$editor->resize( $max_dim, $max_dim, false );
				$editor->save( $dest_path, 'image/jpeg' );
				return;
			}
		}

		// Fallback cu GD nativ daca wp_get_image_editor nu este disponibil
		if ( function_exists( 'imagecreatefromjpeg' ) && function_exists( 'imagecreatetruecolor' ) ) {
			list( $orig_w, $orig_h ) = @getimagesize( $src_path );
			if ( $orig_w && $orig_h ) {
				$scale = min( $max_dim / $orig_w, $max_dim / $orig_h );
				$new_w = max( 1, round( $orig_w * $scale ) );
				$new_h = max( 1, round( $orig_h * $scale ) );

				$src_img = @imagecreatefromstring( file_get_contents( $src_path ) );
				if ( $src_img ) {
					$thumb_img = imagecreatetruecolor( $new_w, $new_h );
					imagecopyresampled( $thumb_img, $src_img, 0, 0, 0, 0, $new_w, $new_h, $orig_w, $orig_h );
					imagejpeg( $thumb_img, $dest_path, 80 );
					imagedestroy( $src_img );
					imagedestroy( $thumb_img );
				}
			}
		}
	}

	/**
	 * Hook: Salveaza datele uploads in line item meta la finalizarea comenzii
	 */
	public function add_order_line_item_meta( $item, $cart_item_key, $values, $order ) {
		if ( ! empty( $values['uploads'] ) ) {
			$item->add_meta_data( 'uploads', $values['uploads'] );
		}
		if ( ! empty( $values['upload_dir'] ) ) {
			$item->add_meta_data( 'upload_dir', $values['upload_dir'] );
		}
		if ( ! empty( $values['finish'] ) ) {
			$item->add_meta_data( 'Finisaj hartie', $values['finish'] );
		}
		if ( ! empty( $values['size_label'] ) ) {
			$item->add_meta_data( 'Dimensiune print', $values['size_label'] );
		}
	}

	/**
	 * Hook: Muta fisierele din .tmp/[batch_id] in [order_id] cand comanda este plasata
	 */
	public function move_uploads_to_order( $order_id, $order ) {
		if ( is_admin() || ! $order ) {
			return;
		}

		$wp_upload_dir = wp_upload_dir();
		$base_dir = $wp_upload_dir['basedir'] . '/woo-uploads';

		foreach ( $order->get_items() as $item_id => $item_data ) {
			$uploads = $item_data->get_meta( 'uploads' );
			$item_upload_dir = $item_data->get_meta( 'upload_dir' );

			if ( ! empty( $uploads ) && is_array( $uploads ) && ! empty( $item_upload_dir ) ) {
				$tmp_dir = $base_dir . '/.tmp/' . $item_upload_dir . '/';
				$tmp_thumb_dir = $tmp_dir . '.thumb/';

				$order_dir = $base_dir . '/' . $order_id . '/';
				$order_thumb_dir = $order_dir . '.thumb/';

				if ( wp_mkdir_p( $order_thumb_dir ) ) {
					foreach ( $uploads as $file_id => $upload_info ) {
						if ( file_exists( $tmp_dir . $file_id ) ) {
							@rename( $tmp_dir . $file_id, $order_dir . $file_id );
						}
						if ( file_exists( $tmp_thumb_dir . $file_id ) ) {
							@rename( $tmp_thumb_dir . $file_id, $order_thumb_dir . $file_id );
						}
					}
				}
			}
		}
	}

	/**
	 * Afisare selector cantitate personalizat in cos
	 */
	public function cart_quantity_display( $product_quantity, $cart_item_key, $cart_item ) {
		if ( ! empty( $cart_item['uploads'] ) ) {
			$product_quantity = '<strong>' . $cart_item['quantity'] . ' buc.</strong>';
		}
		return $product_quantity;
	}

	/**
	 * Recalculare pret total bazat pe numarul de fotografii
	 */
	public function calculate_cart_totals( $cart ) {
		foreach ( $cart->get_cart() as $key => $item ) {
			if ( ! empty( $item['uploads'] ) && is_array( $item['uploads'] ) ) {
				$total_qty = 0;
				foreach ( $item['uploads'] as $upload ) {
					$total_qty += intval( $upload['quantity'] );
				}
				if ( $total_qty > 0 ) {
					$cart->set_quantity( $key, $total_qty, 0 );
				}
			}
		}
	}

	/**
	 * Stergere uploads cand un produs este eliminat din cos
	 */
	public function delete_cart_item_uploads( $cart_item_key, $cart ) {
		$item = isset( $cart->cart_contents[ $cart_item_key ] ) ? $cart->cart_contents[ $cart_item_key ] : null;
		if ( $item && ! empty( $item['uploads'] ) && ! empty( $item['upload_dir'] ) ) {
			$wp_upload_dir = wp_upload_dir();
			$tmp_dir = $wp_upload_dir['basedir'] . '/woo-uploads/.tmp/' . $item['upload_dir'] . '/';
			$tmp_thumb_dir = $tmp_dir . '.thumb/';

			foreach ( $item['uploads'] as $file_id => $upload ) {
				@unlink( $tmp_dir . $file_id );
				@unlink( $tmp_thumb_dir . $file_id );
			}
		}
	}

	/**
	 * Afisare miniaturi poze in pagina de cos si checkout
	 */
	public function cart_item_name_with_previews( $item_name, $cart_item, $cart_item_key ) {
		if ( ! empty( $cart_item['uploads'] ) && is_array( $cart_item['uploads'] ) && ! empty( $cart_item['upload_dir'] ) ) {
			$wp_upload_dir = wp_upload_dir();
			$base_url = $wp_upload_dir['baseurl'] . '/woo-uploads';
			$thumb_url = $base_url . '/.tmp/' . $cart_item['upload_dir'] . '/.thumb/';

			$html = '<div class="crop-studio-cart-previews" style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px;">';
			foreach ( $cart_item['uploads'] as $file_id => $upload ) {
				$img_src = esc_url( $thumb_url . $file_id );
				$fn = esc_html( $upload['filename'] );
				$qty = intval( $upload['quantity'] );
				$finish = ! empty( $upload['finish'] ) ? esc_html( $upload['finish'] ) : '';

				$html .= '<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; text-align: center; width: 80px; font-size: 11px;">';
				$html .= '<img src="' . $img_src . '" alt="' . $fn . '" style="width: 70px; height: 50px; object-fit: cover; border-radius: 4px; display: block; margin: 0 auto 4px;" />';
				$html .= '<div style="font-weight: 600; color: #1e293b;">' . $qty . ' buc</div>';
				if ( $finish ) {
					$html .= '<div style="color: #64748b; font-size: 10px;">' . $finish . '</div>';
				}
				$html .= '</div>';
			}
			$html .= '</div>';

			return $item_name . $html;
		}

		return $item_name;
	}
}

new Crop_Studio_API_Endpoints();
