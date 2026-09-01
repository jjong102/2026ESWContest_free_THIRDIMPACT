#!/usr/bin/env python3
"""Fake a moving robot by broadcasting a map->base_link TF.

Stand-in for real localization while the SLAM/nav stack isn't wired up yet.
The robot patrols back and forth along a straight line inside the map's
real-world bounds (read from the floor_plan yaml) so the simulated position
always lands somewhere sensible on the actual floor plan.
"""

import glob
import math
import os

import cv2
import numpy as np
import yaml

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import TransformStamped
from tf2_ros import TransformBroadcaster


class TestRobotStateNode(Node):

    def __init__(self):
        super().__init__('test_robot_state_node')

        pkg_root = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
        default_floor_plan_dir = os.path.join(pkg_root, 'floor_plan')

        self.declare_parameter('floor_plan_dir', default_floor_plan_dir)
        self.declare_parameter('map_frame', 'map')
        self.declare_parameter('robot_frame', 'base_link')
        self.declare_parameter('publish_rate_hz', 10.0)
        self.declare_parameter('speed_mps', 0.3)
        self.declare_parameter('margin_m', 1.0)

        self.map_frame = self.get_parameter('map_frame').value
        self.robot_frame = self.get_parameter('robot_frame').value
        self.speed_mps = self.get_parameter('speed_mps').value

        self.x0, self.y0, self.x1, self.y1 = self.compute_patrol_line(
            self.get_parameter('floor_plan_dir').value, self.get_parameter('margin_m').value
        )
        self.get_logger().info(
            f'Patrolling between ({self.x0:.2f}, {self.y0:.2f}) and ({self.x1:.2f}, {self.y1:.2f})'
        )

        self.broadcaster = TransformBroadcaster(self)
        self.start_time = self.get_clock().now()

        period = 1.0 / self.get_parameter('publish_rate_hz').value
        self.timer = self.create_timer(period, self.on_timer)

    def compute_patrol_line(self, floor_plan_dir, margin_m):
        """Pick a straight line that stays on real floor the whole way.

        The floor plan isn't necessarily a simple rectangle (this one is
        L-shaped), so a line through the geometric middle of the image can
        easily fall outside the actual floor. Instead, scan the pgm for the
        pixel row with the most free-space pixels and patrol along that
        row's own free-space span, which is guaranteed to be real floor.
        """
        yaml_paths = sorted(glob.glob(os.path.join(floor_plan_dir, '*.yaml')))
        if not yaml_paths:
            self.get_logger().warn(f'No floor plan yaml in {floor_plan_dir}, defaulting to (0,0)-(2,0)')
            return 0.0, 0.0, 2.0, 0.0

        with open(yaml_paths[0]) as f:
            meta = yaml.safe_load(f)

        pgm_path = os.path.join(os.path.dirname(yaml_paths[0]), meta['image'])
        img = cv2.imread(pgm_path, cv2.IMREAD_UNCHANGED)
        if img is None:
            self.get_logger().warn(f'could not read {pgm_path}, defaulting to (0,0)-(2,0)')
            return 0.0, 0.0, 2.0, 0.0

        resolution = meta['resolution']
        origin = meta['origin']
        height_px = img.shape[0]

        free_mask = img >= 250
        best_row = int(np.argmax(free_mask.sum(axis=1)))
        xs = np.where(free_mask[best_row])[0]

        margin_px = max(1, int(round(margin_m / resolution)))
        x_min_px, x_max_px = int(xs.min()) + margin_px, int(xs.max()) - margin_px
        if x_max_px <= x_min_px:
            x_min_px, x_max_px = int(xs.min()), int(xs.max())

        x_min_m = origin[0] + x_min_px * resolution
        x_max_m = origin[0] + x_max_px * resolution
        y_m = origin[1] + (height_px - best_row) * resolution
        return x_min_m, y_m, x_max_m, y_m

    def on_timer(self):
        elapsed = (self.get_clock().now() - self.start_time).nanoseconds / 1e9
        length = math.hypot(self.x1 - self.x0, self.y1 - self.y0)
        if length < 1e-6:
            t = 0.0
        else:
            period = 2.0 * length / max(self.speed_mps, 1e-3)
            phase = (elapsed % period) / period * 2.0
            t = phase if phase <= 1.0 else 2.0 - phase  # triangle wave 0->1->0

        x = self.x0 + (self.x1 - self.x0) * t
        y = self.y0 + (self.y1 - self.y0) * t
        yaw = math.atan2(self.y1 - self.y0, self.x1 - self.x0)

        tf = TransformStamped()
        tf.header.stamp = self.get_clock().now().to_msg()
        tf.header.frame_id = self.map_frame
        tf.child_frame_id = self.robot_frame
        tf.transform.translation.x = x
        tf.transform.translation.y = y
        tf.transform.translation.z = 0.0
        tf.transform.rotation.z = math.sin(yaw / 2.0)
        tf.transform.rotation.w = math.cos(yaw / 2.0)
        self.broadcaster.sendTransform(tf)


def main(args=None):
    rclpy.init(args=args)
    node = TestRobotStateNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
