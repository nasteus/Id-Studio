import http.server
import socketserver
import os
import json
import mimetypes

PORT = 1017
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'CropStudio')

mimetypes.init()
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/javascript', '.mjs')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/manifest+json', '.webmanifest')
mimetypes.add_type('image/svg+xml', '.svg')

CONFIG_DATA = {
    "sizes": [
        {"id": "2:3", "label": "2 × 3 cm", "width_cm": 2, "height_cm": 3, "ratio": 2/3, "product_id": 1},
        {"id": "2.5:3.2", "label": "2.5 × 3.2 cm", "width_cm": 2.5, "height_cm": 3.2, "ratio": 2.5/3.2, "product_id": 2},
        {"id": "3:4", "label": "3 × 4 cm", "width_cm": 3, "height_cm": 4, "ratio": 3/4, "product_id": 3},
        {"id": "3.5:4.5", "label": "3.5 × 4.5 cm", "width_cm": 3.5, "height_cm": 4.5, "ratio": 3.5/4.5, "product_id": 4},
        {"id": "4:6", "label": "4 × 6 cm", "width_cm": 4, "height_cm": 6, "ratio": 4/6, "product_id": 5},
        {"id": "5:5", "label": "5 × 5 cm", "width_cm": 5, "height_cm": 5, "ratio": 1.0, "product_id": 6},
        {"id": "6:9", "label": "6 × 9 cm", "width_cm": 6, "height_cm": 9, "ratio": 6/9, "product_id": 7}
    ],
    "currency": "RON",
    "currency_symbol": "lei",
    "finishes": [
        {"id": "glossy", "label": "Lucios"},
        {"id": "matte", "label": "Mat"}
    ],
    "settings": {
        "checkout_redirect": "checkout",
        "jpeg_quality": 95
    }
}

B2B_ID_STUDIO_CONFIG = {
    "app": "id_studio",
    "app_name": "ID Studio",
    "version": "1.0.0",
    "sheet": {
        "width_cm": 8.9,
        "height_cm": 12.7,
        "dpi": 300,
        "default_bg": "#808080"
    },
    "presets": [
        {"id": "2:3", "label": "2 × 3 cm", "width_cm": 2.0, "height_cm": 3.0, "ratio": round(2.0/3.0, 4), "slots": 4},
        {"id": "2.5:3.2", "label": "2.5 × 3.2 cm", "width_cm": 2.5, "height_cm": 3.2, "ratio": round(2.5/3.2, 4), "slots": 4},
        {"id": "3:4", "label": "3 × 4 cm", "width_cm": 3.0, "height_cm": 4.0, "ratio": round(3.0/4.0, 4), "slots": 4},
        {"id": "3.5:4.5", "label": "3.5 × 4.5 cm", "width_cm": 3.5, "height_cm": 4.5, "ratio": round(3.5/4.5, 4), "slots": 4, "is_default": True},
        {"id": "4:6", "label": "4 × 6 cm", "width_cm": 4.0, "height_cm": 6.0, "ratio": round(4.0/6.0, 4), "slots": 2},
        {"id": "5:5", "label": "5 × 5 cm", "width_cm": 5.0, "height_cm": 5.0, "ratio": 1.0, "slots": 2},
        {"id": "6:9", "label": "6 × 9 cm", "width_cm": 6.0, "height_cm": 9.0, "ratio": round(6.0/9.0, 4), "slots": 2, "rotate": 90}
    ],
    "currency": "RON",
    "currency_symbol": "lei",
    "finishes": [
        {"id": "glossy", "label": "Lucios"},
        {"id": "matte", "label": "Mat"}
    ],
    "copies_options": [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20],
    "settings": {
        "checkout_redirect": "checkout",
        "jpeg_quality": 95
    }
}

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # 1. B2B Central App Config Endpoint
        if self.path.startswith('/wp-json/b2b/v1/app-config/id_studio') or self.path.startswith('/wp-json/b2b/v1/app-config/id-studio'):
            payload = json.dumps({"success": True, "data": B2B_ID_STUDIO_CONFIG}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(payload)
            return

        # 2. Intercept WordPress bridge config endpoint (fallback)
        elif self.path.startswith('/wp-json/crop-studio/v1/config'):
            payload = json.dumps(CONFIG_DATA).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(payload)
            return

        elif self.path.startswith('/wp-json/crop-studio/v1/session-photos'):
            payload = json.dumps({"success": False, "photos": []}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(payload)
            return

        return super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = b''
        if content_length > 0:
            post_data = self.rfile.read(content_length)

        # ID Studio Add to Cart Endpoint simulation
        if self.path.startswith('/wp-json/id-studio/v1/add-to-cart'):
            payload = json.dumps({
                "success": True,
                "message": "Produsul a fost adaugat in cos!",
                "redirect_url": "/cart/"
            }).encode('utf-8')
        else:
            payload = json.dumps({"success": True}).encode('utf-8')

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"ID Studio server running at http://localhost:{PORT}")
    httpd.serve_forever()
