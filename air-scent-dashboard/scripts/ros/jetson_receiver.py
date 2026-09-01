#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from std_msgs.msg import String


class JetsonReceiver(Node):
    def __init__(self):
        super().__init__("jetson_receiver")
        self.subscription = self.create_subscription(
            String,
            "jetson_test",
            self.listener_callback,
            10,
        )

    def listener_callback(self, msg):
        self.get_logger().info(f'Received: "{msg.data}"')


def main(args=None):
    rclpy.init(args=args)
    node = JetsonReceiver()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
