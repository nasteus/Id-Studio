<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CSB_Admin_Settings {

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'register_admin_menu' ) );
		add_action( 'admin_init', array( $this, 'handle_form_submissions' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );
	}

	public function register_admin_menu() {
		add_menu_page(
			'Crop Studio',
			'Crop Studio',
			'manage_woocommerce',
			'crop-studio-sizes',
			array( $this, 'render_sizes_page' ),
			'dashicons-camera',
			56
		);

		add_submenu_page(
			'crop-studio-sizes',
			'Mărimi & Mapare Produse',
			'Mărimi & Produse',
			'manage_woocommerce',
			'crop-studio-sizes',
			array( $this, 'render_sizes_page' )
		);

		add_submenu_page(
			'crop-studio-sizes',
			'Setări Generale Crop Studio',
			'Setări Generale',
			'manage_woocommerce',
			'crop-studio-settings',
			array( $this, 'render_settings_page' )
		);
	}

	public function enqueue_admin_assets( $hook ) {
		if ( strpos( $hook, 'crop-studio' ) !== false ) {
			wp_enqueue_style( 'csb-admin-style', CROP_STUDIO_BRIDGE_URL . 'assets/css/admin.css', array(), CROP_STUDIO_BRIDGE_VERSION );
		}
	}

	/**
	 * Proceseaza salvarile din panoul de administrare
	 */
	public function handle_form_submissions() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}

		// 1. Salvare / Actualizare marimi existente
		if ( isset( $_POST['csb_save_sizes_nonce'] ) && wp_verify_nonce( $_POST['csb_save_sizes_nonce'], 'csb_save_sizes_action' ) ) {
			$raw_sizes = isset( $_POST['csb_sizes'] ) && is_array( $_POST['csb_sizes'] ) ? $_POST['csb_sizes'] : array();
			$updated_sizes = array();

			foreach ( $raw_sizes as $key => $item ) {
				if ( empty( $item['label'] ) ) {
					continue;
				}
				$w = max( 1, floatval( $item['width_cm'] ) );
				$h = max( 1, floatval( $item['height_cm'] ) );
				$ratio = round( $w / $h, 4 );

				$updated_sizes[] = array(
					'id'         => sanitize_text_field( $item['id'] ?? ( $w . ':' . $h ) ),
					'label'      => sanitize_text_field( $item['label'] ),
					'width_cm'   => $w,
					'height_cm'  => $h,
					'ratio'      => $ratio,
					'product_id' => absint( $item['product_id'] ),
					'active'     => isset( $item['active'] ) ? 1 : 0,
					'order'      => absint( $item['order'] ?? 0 ),
				);
			}

			update_option( 'crop_studio_sizes', $updated_sizes );
			add_settings_error( 'csb_messages', 'csb_sizes_saved', 'Mărimile și ID-urile de produse au fost actualizate cu succes!', 'updated' );
		}

		// 2. Adaugare marime noua
		if ( isset( $_POST['csb_add_size_nonce'] ) && wp_verify_nonce( $_POST['csb_add_size_nonce'], 'csb_add_size_action' ) ) {
			$label = sanitize_text_field( $_POST['new_label'] ?? '' );
			$w = max( 1, floatval( $_POST['new_width_cm'] ?? 10 ) );
			$h = max( 1, floatval( $_POST['new_height_cm'] ?? 15 ) );
			$product_id = absint( $_POST['new_product_id'] ?? 0 );

			if ( ! empty( $label ) ) {
				$current_sizes = get_option( 'crop_studio_sizes', array() );
				$id = str_replace( ' ', '', $w . ':' . $h );

				// Verificare unicitate id
				$exists = false;
				foreach ( $current_sizes as $s ) {
					if ( $s['id'] === $id ) {
						$exists = true;
						break;
					}
				}
				if ( $exists ) {
					$id .= '_' . time();
				}

				$current_sizes[] = array(
					'id'         => $id,
					'label'      => $label,
					'width_cm'   => $w,
					'height_cm'  => $h,
					'ratio'      => round( $w / $h, 4 ),
					'product_id' => $product_id,
					'active'     => 1,
					'order'      => count( $current_sizes ) + 1,
				);

				update_option( 'crop_studio_sizes', $current_sizes );
				add_settings_error( 'csb_messages', 'csb_size_added', 'Mărimea nouă a fost adăugată cu succes!', 'updated' );
			}
		}

		// 3. Salvare setari generale
		if ( isset( $_POST['csb_save_settings_nonce'] ) && wp_verify_nonce( $_POST['csb_save_settings_nonce'], 'csb_save_settings_action' ) ) {
			$settings = array(
				'editor_path'        => sanitize_text_field( $_POST['editor_path'] ?? '/editor/' ),
				'checkout_redirect'  => sanitize_text_field( $_POST['checkout_redirect'] ?? 'checkout' ),
				'jpeg_quality'       => min( 100, max( 80, absint( $_POST['jpeg_quality'] ?? 95 ) ) ),
				'enable_zip_archive' => isset( $_POST['enable_zip_archive'] ) ? 1 : 0,
			);
			update_option( 'crop_studio_settings', $settings );
			add_settings_error( 'csb_messages', 'csb_settings_saved', 'Setările generale au fost salvate cu succes!', 'updated' );
		}
	}

	/**
	 * Obtine lista produselor WooCommerce pentru dropdown
	 */
	private function get_woocommerce_products_list() {
		$products = array();
		if ( function_exists( 'wc_get_products' ) ) {
			$wc_products = wc_get_products( array(
				'limit'   => -1,
				'status'  => 'publish',
				'orderby' => 'name',
				'order'   => 'ASC',
			) );
			foreach ( $wc_products as $prod ) {
				$price = $prod->get_price();
				$price_html = $price ? ' (' . wc_price( $price ) . ')' : '';
				$products[ $prod->get_id() ] = sprintf( '#%d - %s%s', $prod->get_id(), $prod->get_name(), wp_strip_all_tags( $price_html ) );
			}
		}
		return $products;
	}

	/**
	 * Pagina 1: Marimi & Mapare Produse
	 */
	public function render_sizes_page() {
		$sizes = get_option( 'crop_studio_sizes', array() );
		$products = $this->get_woocommerce_products_list();
		?>
		<div class="wrap csb-admin-wrap">
			<div class="csb-header-card">
				<div class="csb-header-left">
					<h1>📸 Crop Studio — Mărimi & Mapare Produse WooCommerce</h1>
					<p class="csb-subtitle">Gestionează dimensiunile de printare din aplicație și asociază-le cu produsele din magazinul tău WooCommerce.</p>
				</div>
				<div class="csb-header-right">
					<span class="csb-badge">v<?php echo esc_html( CROP_STUDIO_BRIDGE_VERSION ); ?></span>
				</div>
			</div>

			<?php settings_errors( 'csb_messages' ); ?>

			<div class="csb-grid-layout">
				<!-- Coloana Stanga: Tabel Marimi Existente -->
				<div class="csb-main-col">
					<div class="csb-card">
						<div class="csb-card-header">
							<h2>Mărimi Active în Crop Studio</h2>
							<span class="csb-card-count"><?php echo count( $sizes ); ?> mărimi configurate</span>
						</div>

						<form method="post" action="">
							<?php wp_nonce_field( 'csb_save_sizes_action', 'csb_save_sizes_nonce' ); ?>
							
							<table class="wp-list-table widefat fixed striped csb-sizes-table">
								<thead>
									<tr>
										<th style="width: 50px;">Activ</th>
										<th style="width: 140px;">Denumire Afișată</th>
										<th style="width: 130px;">Dimensiune (cm)</th>
										<th style="width: 100px;">Proporție</th>
										<th>Produs WooCommerce Asociat</th>
										<th style="width: 70px; text-align: center;">Șterge</th>
									</tr>
								</thead>
								<tbody id="csb-sizes-tbody">
									<?php if ( ! empty( $sizes ) ) : ?>
										<?php foreach ( $sizes as $index => $size ) : ?>
											<tr class="csb-size-row">
												<td>
													<input type="hidden" name="csb_sizes[<?php echo $index; ?>][id]" value="<?php echo esc_attr( $size['id'] ); ?>" />
													<input type="hidden" name="csb_sizes[<?php echo $index; ?>][order]" value="<?php echo esc_attr( $size['order'] ?? $index ); ?>" />
													<label class="csb-switch">
														<input type="checkbox" name="csb_sizes[<?php echo $index; ?>][active]" value="1" <?php checked( $size['active'], 1 ); ?> />
														<span class="csb-slider"></span>
													</label>
												</td>
												<td>
													<input type="text" class="regular-text csb-input" name="csb_sizes[<?php echo $index; ?>][label]" value="<?php echo esc_attr( $size['label'] ); ?>" required />
												</td>
												<td>
													<div class="csb-dims-input">
														<input type="number" step="0.1" class="small-text" name="csb_sizes[<?php echo $index; ?>][width_cm]" value="<?php echo esc_attr( $size['width_cm'] ); ?>" title="Lățime cm" required />
														<span>×</span>
														<input type="number" step="0.1" class="small-text" name="csb_sizes[<?php echo $index; ?>][height_cm]" value="<?php echo esc_attr( $size['height_cm'] ); ?>" title="Înălțime cm" required />
													</div>
												</td>
												<td>
													<span class="csb-ratio-tag"><?php echo esc_html( $size['ratio'] ); ?></span>
												</td>
												<td>
													<select name="csb_sizes[<?php echo $index; ?>][product_id]" class="csb-product-select">
														<option value="0">— Selectează Produs WooCommerce —</option>
														<?php foreach ( $products as $prod_id => $prod_title ) : ?>
															<option value="<?php echo esc_attr( $prod_id ); ?>" <?php selected( $size['product_id'], $prod_id ); ?>>
																<?php echo esc_html( $prod_title ); ?>
															</option>
														<?php endforeach; ?>
													</select>
												</td>
												<td style="text-align: center;">
													<button type="button" class="button button-link-delete csb-delete-row" onclick="if(confirm('Sigur dorești să ștergi această mărime?')) { this.closest('tr').remove(); }">
														<span class="dashicons dashicons-trash"></span>
													</button>
												</td>
											</tr>
										<?php endforeach; ?>
									<?php else : ?>
										<tr>
											<td colspan="6" style="text-align: center; padding: 20px;">Nu există mărimi configurate. Folosește formularul din dreapta pentru a adăuga una!</td>
										</tr>
									<?php endif; ?>
								</tbody>
							</table>

							<div class="csb-form-actions">
								<button type="submit" class="button button-primary button-hero">
									<span class="dashicons dashicons-saved" style="margin-top: 4px;"></span> Salvează Modificările
								</button>
							</div>
						</form>
					</div>
				</div>

				<!-- Coloana Dreapta: Formular Adaugare Marime Noua -->
				<div class="csb-side-col">
					<div class="csb-card csb-add-card">
						<div class="csb-card-header">
							<h2>➕ Adaugă Mărime Nouă</h2>
						</div>
						<form method="post" action="">
							<?php wp_nonce_field( 'csb_add_size_action', 'csb_add_size_nonce' ); ?>
							
							<div class="csb-field-group">
								<label for="new_label"><strong>Denumire Mărime</strong> (ex: 40 × 50 cm sau A4):</label>
								<input type="text" id="new_label" name="new_label" class="widefat" placeholder="ex: 40 × 50 cm" required />
							</div>

							<div class="csb-field-group">
								<label><strong>Dimensiuni fizice de print (cm):</strong></label>
								<div class="csb-dims-input wide">
									<input type="number" step="0.1" id="new_width_cm" name="new_width_cm" class="widefat" placeholder="Lățime (ex: 40)" required />
									<span>×</span>
									<input type="number" step="0.1" id="new_height_cm" name="new_height_cm" class="widefat" placeholder="Înălțime (ex: 50)" required />
								</div>
								<p class="description">Crop Studio va calcula automat raportul de decupare exact din aceste dimensiuni.</p>
							</div>

							<div class="csb-field-group">
								<label for="new_product_id"><strong>Produs WooCommerce Asociat:</strong></label>
								<select id="new_product_id" name="new_product_id" class="widefat">
									<option value="0">— Selectează Produs din Magazin —</option>
									<?php foreach ( $products as $prod_id => $prod_title ) : ?>
										<option value="<?php echo esc_attr( $prod_id ); ?>">
											<?php echo esc_html( $prod_title ); ?>
										</option>
									<?php endforeach; ?>
								</select>
							</div>

							<div class="csb-field-group" style="margin-top: 20px;">
								<button type="submit" class="button button-primary widefat" style="height: 38px; line-height: 36px; font-weight: 600;">
									Adaugă Mărimea în Crop Studio
								</button>
							</div>
						</form>
					</div>

					<!-- Card Ajutor / Info -->
					<div class="csb-card csb-info-card">
						<h3>💡 Cum funcționează sincronizarea?</h3>
						<p>Când adaugi sau modifici o mărime aici, <strong>Crop Studio</strong> își va actualiza automat meniul derulant de mărimi fără să recompilăm aplicația.</p>
						<p>La finalizarea comenzii (butonul cu moneda $), pozele vor fi trimise către produsul WooCommerce selectat corespunzător.</p>
					</div>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * Pagina 2: Setari Generale
	 */
	public function render_settings_page() {
		$settings = get_option( 'crop_studio_settings', array(
			'editor_path'        => '/editor/',
			'checkout_redirect'  => 'checkout',
			'jpeg_quality'       => 95,
			'enable_zip_archive' => 1,
		) );
		?>
		<div class="wrap csb-admin-wrap">
			<div class="csb-header-card">
				<div class="csb-header-left">
					<h1>⚙️ Crop Studio — Setări Generale</h1>
					<p class="csb-subtitle">Configurații generale pentru integrarea cu magazinul și laboratorul foto.</p>
				</div>
			</div>

			<?php settings_errors( 'csb_messages' ); ?>

			<div class="csb-card" style="max-width: 800px; margin-top: 20px;">
				<form method="post" action="">
					<?php wp_nonce_field( 'csb_save_settings_action', 'csb_save_settings_nonce' ); ?>

					<table class="form-table">
						<tr>
							<th scope="row"><label for="editor_path">Cale / URL Aplicație Crop Studio</label></th>
							<td>
								<input type="text" id="editor_path" name="editor_path" value="<?php echo esc_attr( $settings['editor_path'] ); ?>" class="regular-text" />
								<p class="description">Calea unde ai dezarhivat Crop Studio (ex: <code>/editor/</code> sau <code>https://editor.site-ul-tau.ro/</code>).</p>
							</td>
						</tr>
						<tr>
							<th scope="row"><label for="checkout_redirect">Destinație după adăugarea în coș</label></th>
							<td>
								<select id="checkout_redirect" name="checkout_redirect" class="regular-text">
									<option value="checkout" <?php selected( $settings['checkout_redirect'], 'checkout' ); ?>>Direct la Checkout (/checkout/)</option>
									<option value="cart" <?php selected( $settings['checkout_redirect'], 'cart' ); ?>>La Coșul de cumpărături (/cart/)</option>
								</select>
								<p class="description">Unde este redirecționat clientul imediat ce fotografiile s-au încărcat cu succes.</p>
							</td>
						</tr>
						<tr>
							<th scope="row"><label for="jpeg_quality">Calitate Export JPEG (%)</label></th>
							<td>
								<input type="number" min="80" max="100" id="jpeg_quality" name="jpeg_quality" value="<?php echo esc_attr( $settings['jpeg_quality'] ); ?>" class="small-text" /> %
								<p class="description">Recomandat <strong>95%</strong> pentru calitate maximă de tipar fotografic.</p>
							</td>
						</tr>
						<tr>
							<th scope="row">Generator ZIP Comenzi</th>
							<td>
								<label>
									<input type="checkbox" name="enable_zip_archive" value="1" <?php checked( $settings['enable_zip_archive'] ?? 1, 1 ); ?> />
									Activează caseta „Generare Arhivă ZIP” în pagina fiecărei comenzi din WooCommerce Admin.
								</label>
							</td>
						</tr>
					</table>

					<p class="submit">
						<button type="submit" class="button button-primary button-hero">Salvează Setările Generale</button>
					</p>
				</form>
			</div>
		</div>
		<?php
	}
}

new CSB_Admin_Settings();
