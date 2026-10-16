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

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # Intercept WordPress bridge config endpoint
        if self.path.startswith('/wp-json/crop-studio/v1/config'):
            payload = json.dumps(CONFIG_DATA).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(payload)
            return
        elif self.path.startswith('/wp-json/crop-studio/v1/session-photos'):
            payload = json.dumps({"success": False, "photos": []}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(payload)
            return
        return super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            self.rfile.read(content_length)
        payload = json.dumps({"success": True}).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
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
