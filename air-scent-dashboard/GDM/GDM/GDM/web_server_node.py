#!/usr/bin/env python3
"""Serve the room editor + live scent dashboard over plain HTTP.

Two pages are served from the `web/` directory next to this file:
  - /editor    lets a human review the auto-segmented room polygons
               (room_segmentation_node's *_rooms_draft.json), drag/add/
               remove rooms, assign a target scent per room, and confirm
               the final layout (saved as *_rooms_confirmed.json).
  - /          (dashboard) overlays live scent readings from MQTT_sub_node
               (via the scent/raw ROS2 topic) onto the confirmed rooms.

Uses only the Python standard library's http.server so this node has no
extra runtime dependency beyond rclpy.
"""

import glob
import json
import os
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import rclpy
from rclpy.node import Node
from std_msgs.msg import String

CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.png': 'image/png',
    '.json': 'application/json; charset=utf-8',
}


def make_handler(node):

    class Handler(BaseHTTPRequestHandler):

        def log_message(self, fmt, *args):
            node.get_logger().debug(fmt % args)

        def _send_json(self, obj, status=200):
            body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _send_file(self, path):
            if not os.path.isfile(path):
                self.send_error(404, 'not found')
                return
            ext = os.path.splitext(path)[1]
            with open(path, 'rb') as f:
                body = f.read()
            self.send_response(200)
            self.send_header('Content-Type', CONTENT_TYPES.get(ext, 'application/octet-stream'))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()

        def _current_map_basename(self):
            yaml_paths = sorted(glob.glob(os.path.join(node.floor_plan_dir, '*.yaml')))
            if not yaml_paths:
                return None
            return os.path.splitext(os.path.basename(yaml_paths[0]))[0]

        def do_GET(self):
            path = urllib.parse.urlparse(self.path).path

            if path in ('/', '/dashboard'):
                self._send_file(os.path.join(node.web_dir, 'dashboard.html'))
            elif path == '/editor':
                self._send_file(os.path.join(node.web_dir, 'editor.html'))
            elif path == '/api/floorplan.png':
                basename = self._current_map_basename()
                if not basename:
                    self.send_error(404, 'no floor plan found')
                    return
                self._send_file(os.path.join(node.floor_plan_dir, f'{basename}.png'))
            elif path == '/api/rooms/draft':
                self._serve_rooms_file('_rooms_draft.json')
            elif path == '/api/rooms/confirmed':
                self._serve_rooms_file('_rooms_confirmed.json')
            elif path == '/api/scent/status':
                with node.scent_lock:
                    self._send_json(dict(node.scent_state))
            elif path == '/api/robot/pose':
                with node.robot_lock:
                    self._send_json(node.robot_pose or {})
            else:
                self.send_error(404, 'not found')

        def _serve_rooms_file(self, suffix):
            basename = self._current_map_basename()
            path = os.path.join(node.floor_plan_dir, f'{basename}{suffix}') if basename else None
            if not path or not os.path.isfile(path):
                self._send_json({'map': basename, 'rooms': []})
                return
            with open(path) as f:
                self._send_json(json.load(f))

        def do_POST(self):
            path = urllib.parse.urlparse(self.path).path
            if path != '/api/rooms/confirm':
                self.send_error(404, 'not found')
                return

            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body)
            except json.JSONDecodeError:
                self.send_error(400, 'invalid json')
                return

            basename = self._current_map_basename() or data.get('map', 'floor_plan')
            out_path = os.path.join(node.floor_plan_dir, f'{basename}_rooms_confirmed.json')
            with open(out_path, 'w') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            node.get_logger().info(f'Saved confirmed rooms to {out_path}')
            self._send_json({'status': 'ok', 'path': out_path})

    return Handler


class WebServerNode(Node):

    def __init__(self):
        super().__init__('web_server_node')

        pkg_root = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
        this_dir = os.path.dirname(os.path.realpath(__file__))

        self.declare_parameter('floor_plan_dir', os.path.join(pkg_root, 'floor_plan'))
        self.declare_parameter('web_dir', os.path.join(this_dir, 'web'))
        self.declare_parameter('host', '0.0.0.0')
        self.declare_parameter('port', 8080)
        self.declare_parameter('scent_topic', 'scent/raw')
        self.declare_parameter('robot_pose_topic', 'robot/pose')

        self.floor_plan_dir = self.get_parameter('floor_plan_dir').value
        self.web_dir = self.get_parameter('web_dir').value
        self.host = self.get_parameter('host').value
        self.port = self.get_parameter('port').value

        self.scent_lock = threading.Lock()
        self.scent_state = {}  # sensor_id -> latest {scent, percent, stamp, topic, payload}

        self.robot_lock = threading.Lock()
        self.robot_pose = {}  # latest {x_m, y_m, yaw, x_px, y_px, stamp}

        self.create_subscription(
            String, self.get_parameter('scent_topic').value, self.on_scent_raw, 10
        )
        self.create_subscription(
            String, self.get_parameter('robot_pose_topic').value, self.on_robot_pose, 10
        )

        self.server = ThreadingHTTPServer((self.host, self.port), make_handler(self))
        self.get_logger().info(f'Serving on http://{self.host}:{self.port}  (dashboard: /, editor: /editor)')

    def on_scent_raw(self, msg):
        try:
            data = json.loads(msg.data)
        except json.JSONDecodeError:
            self.get_logger().warn(f'bad scent/raw payload: {msg.data}')
            return
        room_id = data.get('room_id', 'default')
        with self.scent_lock:
            self.scent_state[room_id] = data

    def on_robot_pose(self, msg):
        try:
            data = json.loads(msg.data)
        except json.JSONDecodeError:
            self.get_logger().warn(f'bad robot/pose payload: {msg.data}')
            return
        with self.robot_lock:
            self.robot_pose = data

    def serve_forever(self):
        self.server.serve_forever()

    def shutdown(self):
        self.server.shutdown()
        self.server.server_close()


def main(args=None):
    rclpy.init(args=args)
    node = WebServerNode()
    spin_thread = threading.Thread(target=rclpy.spin, args=(node,), daemon=True)
    spin_thread.start()
    try:
        node.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        node.shutdown()
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
