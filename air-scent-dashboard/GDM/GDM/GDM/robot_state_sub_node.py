#!/usr/bin/env python3
"""Look up the robot's TF pose and publish it in floor-plan pixel space.

Subscribes to /tf (via tf2_ros) for the map->base_link transform -- from
test_robot_state_node while real localization isn't wired up, or from the
real SLAM/AMCL stack later, the topic is the same either way -- converts it
to floor_plan pixel coordinates using the same resolution/origin convention
as room_segmentation_node, and publishes that as JSON so web_server_node
(and the dashboard) don't need to know anything about TF or ROS.
"""

import glob
import json
import math
import os

import yaml

import rclpy
from rclpy.node import Node
from std_msgs.msg import String
from tf2_ros import Buffer, TransformListener, TransformException


class RobotStateSubNode(Node):

    def __init__(self):
        super().__init__('robot_state_sub_node')

        pkg_root = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
        default_floor_plan_dir = os.path.join(pkg_root, 'floor_plan')

        self.declare_parameter('floor_plan_dir', default_floor_plan_dir)
        self.declare_parameter('map_frame', 'map')
        self.declare_parameter('robot_frame', 'base_link')
        self.declare_parameter('poll_rate_hz', 10.0)
        self.declare_parameter('ros_topic', 'robot/pose')

        self.map_frame = self.get_parameter('map_frame').value
        self.robot_frame = self.get_parameter('robot_frame').value

        self.resolution, self.origin, self.image_height = self.load_map_meta(
            self.get_parameter('floor_plan_dir').value
        )

        self.tf_buffer = Buffer()
        self.tf_listener = TransformListener(self.tf_buffer, self)
        self.publisher_ = self.create_publisher(String, self.get_parameter('ros_topic').value, 10)

        period = 1.0 / self.get_parameter('poll_rate_hz').value
        self.timer = self.create_timer(period, self.on_timer)
        self.warned_once = False

    def load_map_meta(self, floor_plan_dir):
        yaml_paths = sorted(glob.glob(os.path.join(floor_plan_dir, '*.yaml')))
        if not yaml_paths:
            self.get_logger().warn(f'No floor plan yaml in {floor_plan_dir}; pixel conversion disabled')
            return None, None, None
        with open(yaml_paths[0]) as f:
            meta = yaml.safe_load(f)
        pgm_path = os.path.join(os.path.dirname(yaml_paths[0]), meta['image'])
        _, height_px = self.read_pgm_size(pgm_path)
        return meta['resolution'], meta['origin'], height_px

    @staticmethod
    def read_pgm_size(pgm_path):
        with open(pgm_path, 'rb') as f:
            assert f.readline().strip() == b'P5'
            line = f.readline()
            while line.startswith(b'#'):
                line = f.readline()
            width, height = (int(v) for v in line.split())
            return width, height

    def world_to_px(self, x_m, y_m):
        px = (x_m - self.origin[0]) / self.resolution
        py = self.image_height - (y_m - self.origin[1]) / self.resolution
        return px, py

    def on_timer(self):
        try:
            tf = self.tf_buffer.lookup_transform(self.map_frame, self.robot_frame, rclpy.time.Time())
        except TransformException as exc:
            if not self.warned_once:
                self.get_logger().warn(f'waiting for {self.map_frame}->{self.robot_frame} TF: {exc}')
                self.warned_once = True
            return
        self.warned_once = False

        x_m = tf.transform.translation.x
        y_m = tf.transform.translation.y
        q = tf.transform.rotation
        yaw = math.atan2(2.0 * (q.w * q.z + q.x * q.y), 1.0 - 2.0 * (q.y * q.y + q.z * q.z))

        data = {
            'x_m': x_m,
            'y_m': y_m,
            'yaw': yaw,
            'stamp': self.get_clock().now().nanoseconds / 1e9,
        }
        if self.resolution is not None:
            x_px, y_px = self.world_to_px(x_m, y_m)
            data['x_px'] = x_px
            data['y_px'] = y_px

        self.publisher_.publish(String(data=json.dumps(data)))


def main(args=None):
    rclpy.init(args=args)
    node = RobotStateSubNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
