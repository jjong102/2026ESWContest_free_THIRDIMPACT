#!/usr/bin/env python3
"""Auto-segment a cleaned floor plan into room polygons.

Reads the map_server-style pgm/yaml produced by make_clear_floor_plan_node
from the `floor_plan` directory, splits the floor area into rooms by
treating narrow passages (doorway_width_m) as room boundaries, and writes a
draft room list as JSON next to it. The draft is a starting point only --
a human is expected to review/edit/add rooms and confirm the final layout
(e.g. via web_server_node's room editor) before it is used anywhere else.
"""

import glob
import json
import os

import cv2
import numpy as np
import yaml

import rclpy
from rclpy.node import Node

FREE_VALUE = 254
WALL_MARKER = 255  # reserved watershed marker id for "not floor"


class RoomSegmentationNode(Node):

    def __init__(self):
        super().__init__('room_segmentation_node')

        pkg_root = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
        default_floor_plan_dir = os.path.join(pkg_root, 'floor_plan')

        self.declare_parameter('floor_plan_dir', default_floor_plan_dir)
        self.declare_parameter('doorway_width_m', 0.9)
        self.declare_parameter('min_room_area_m2', 1.0)
        self.declare_parameter('poly_epsilon_px', 4.0)

        self.floor_plan_dir = self.get_parameter('floor_plan_dir').value
        self.doorway_width_m = self.get_parameter('doorway_width_m').value
        self.min_room_area_m2 = self.get_parameter('min_room_area_m2').value
        self.poly_epsilon_px = self.get_parameter('poly_epsilon_px').value

        self.process_all_floor_plans()

    def process_all_floor_plans(self):
        yaml_paths = sorted(glob.glob(os.path.join(self.floor_plan_dir, '*.yaml')))
        if not yaml_paths:
            self.get_logger().warn(f'No floor plan yaml files found in {self.floor_plan_dir}')
            return
        for yaml_path in yaml_paths:
            try:
                self.process_one(yaml_path)
            except Exception as exc:
                self.get_logger().error(f'Failed to segment {yaml_path}: {exc}')

    def process_one(self, yaml_path):
        with open(yaml_path, 'r') as f:
            meta = yaml.safe_load(f)

        map_dir = os.path.dirname(yaml_path)
        pgm_path = os.path.join(map_dir, meta['image'])
        img = cv2.imread(pgm_path, cv2.IMREAD_UNCHANGED)
        if img is None:
            raise RuntimeError(f'could not read {pgm_path}')

        resolution = meta['resolution']
        origin = meta['origin']

        self.get_logger().info(f'Segmenting {pgm_path} ({img.shape[1]}x{img.shape[0]})')
        rooms = self.segment_rooms(img, resolution)

        basename = os.path.splitext(os.path.basename(yaml_path))[0]
        out = {
            'map': basename,
            'resolution': resolution,
            'origin': origin,
            'image_size': [img.shape[1], img.shape[0]],
            'rooms': [
                self.room_to_dict(i + 1, poly_px, img.shape, resolution, origin)
                for i, poly_px in enumerate(rooms)
            ],
        }
        out_path = os.path.join(self.floor_plan_dir, f'{basename}_rooms_draft.json')
        with open(out_path, 'w') as f:
            json.dump(out, f, indent=2, ensure_ascii=False)
        self.get_logger().info(f'Wrote {len(rooms)} draft room(s) to {out_path}')

    def segment_rooms(self, img, resolution):
        free_mask = (img == FREE_VALUE).astype(np.uint8) * 255
        doorway_radius_px = max(1, int(round((self.doorway_width_m / 2.0) / resolution)))

        # erode the floor by half a doorway width so that door-sized gaps
        # pinch off, splitting each room into its own separate blob
        dist = cv2.distanceTransform(free_mask, cv2.DIST_L2, 5)
        seed_mask = (dist > doorway_radius_px).astype(np.uint8) * 255

        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(seed_mask, connectivity=8)
        min_seed_area_px = max(200, (doorway_radius_px * 2) ** 2)

        markers = np.zeros(img.shape, dtype=np.int32)
        room_id = 1
        for label in range(1, num_labels):
            if stats[label, cv2.CC_STAT_AREA] < min_seed_area_px:
                continue
            markers[labels == label] = room_id
            room_id += 1

        if room_id == 1:
            # nowhere was wide enough to seed a room (e.g. one open area
            # with no doorway-sized pinch point) -- treat it as one room
            markers[free_mask > 0] = 1
            room_id = 2

        markers[free_mask == 0] = WALL_MARKER

        # geodesic nearest-seed flood fill, constrained to the floor area
        # by pre-marking every non-floor pixel as an already-claimed
        # WALL_MARKER "seed" so the flood never crosses through walls
        img3 = cv2.cvtColor(free_mask, cv2.COLOR_GRAY2BGR)
        cv2.watershed(img3, markers)

        min_room_area_px = self.min_room_area_m2 / (resolution ** 2)
        polygons = []
        for label in range(1, room_id):
            room_mask = ((markers == label) & (free_mask > 0)).astype(np.uint8) * 255
            if room_mask.sum() == 0:
                continue
            contours, _ = cv2.findContours(room_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                continue
            contour = max(contours, key=cv2.contourArea)
            if cv2.contourArea(contour) < min_room_area_px:
                continue
            approx = cv2.approxPolyDP(contour, self.poly_epsilon_px, True).reshape(-1, 2)
            polygons.append(approx)
        return polygons

    def room_to_dict(self, index, poly_px, img_shape, resolution, origin):
        height = img_shape[0]
        poly_m = [self.px_to_m(x, y, height, resolution, origin) for x, y in poly_px]
        cx_px, cy_px = poly_px.mean(axis=0)
        cx_m, cy_m = self.px_to_m(cx_px, cy_px, height, resolution, origin)
        return {
            'id': f'room_{index}',
            'name': f'Room {index}',
            # MQTT room-id (topic suffix from MQTT_sub_node) this room's
            # scent ward reports under -- defaults to the room id but is
            # meant to be corrected by hand in the room editor, since the
            # auto-segmented id and the ward's real topic name won't
            # generally match.
            'sensor_id': f'room_{index}',
            'target_scent': None,
            'target_percent': 90,
            'polygon_px': [[int(x), int(y)] for x, y in poly_px],
            'polygon_m': [[round(x, 3), round(y, 3)] for x, y in poly_m],
            'centroid_px': [float(cx_px), float(cy_px)],
            'centroid_m': [round(cx_m, 3), round(cy_m, 3)],
        }

    @staticmethod
    def px_to_m(px, py, image_height, resolution, origin):
        # map_server convention: origin is the world pose of the bottom-left
        # pixel (row = image_height-1); pixel rows increase downward while
        # world y increases upward
        world_x = origin[0] + px * resolution
        world_y = origin[1] + (image_height - py) * resolution
        return world_x, world_y


def main(args=None):
    rclpy.init(args=args)
    node = RoomSegmentationNode()
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
