#!/usr/bin/env python3
"""Turn a raw SLAM-generated occupancy map into a clean 2D floor plan.

Reads every map_server-style *.yaml/*.pgm pair from the `map` directory,
removes SLAM speckle noise, smooths jagged wall edges, and writes a cleaned
map_server-compatible pgm/yaml pair plus a nicely rendered PNG into the
`floor_plan` directory.
"""

import glob
import os

import cv2
import numpy as np
import yaml

import rclpy
from rclpy.node import Node

# map_server "trinary" mode always encodes exactly these three gray values
# (0=occupied, 205=unknown, 254=free) no matter what free/occupied_thresh
# say in the yaml -- those thresholds are only used when a costmap loads the
# pgm back into probabilities, not when map_saver wrote it. So we classify
# pixels by nearest canonical value instead of re-deriving probabilities.
FREE_VALUE_MIN = 250
OCCUPIED_VALUE_MAX = 10
UNKNOWN_VALUE = 205
FREE_VALUE = 254
OCCUPIED_VALUE = 0


class MakeClearFloorPlanNode(Node):

    def __init__(self):
        super().__init__('make_clear_floor_plan_node')

        # realpath (not abspath) so this resolves through the symlinks that
        # `colcon build --symlink-install` places in build/install space,
        # back to the actual package source tree under src/GDM.
        pkg_root = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
        workspace_src_dir = os.path.dirname(pkg_root)
        default_map_dir = os.path.join(workspace_src_dir, 'maps')
        default_output_dir = os.path.join(pkg_root, 'floor_plan')

        self.declare_parameter('map_dir', default_map_dir)
        self.declare_parameter('output_dir', default_output_dir)
        self.declare_parameter('morph_kernel_size', 3)
        self.declare_parameter('hole_area_min_px', 60)
        self.declare_parameter('hole_area_ratio', 0.01)
        self.declare_parameter('straighten_epsilon_px', 6.0)
        self.declare_parameter('wall_thickness_px', 3)
        self.declare_parameter('crop_padding_px', 10)

        self.map_dir = self.get_parameter('map_dir').value
        self.output_dir = self.get_parameter('output_dir').value
        self.morph_kernel_size = self.get_parameter('morph_kernel_size').value
        self.hole_area_min_px = self.get_parameter('hole_area_min_px').value
        self.hole_area_ratio = self.get_parameter('hole_area_ratio').value
        self.straighten_epsilon_px = self.get_parameter('straighten_epsilon_px').value
        self.wall_thickness_px = self.get_parameter('wall_thickness_px').value
        self.crop_padding_px = self.get_parameter('crop_padding_px').value

        os.makedirs(self.output_dir, exist_ok=True)
        self.process_all_maps()

    def process_all_maps(self):
        yaml_paths = sorted(glob.glob(os.path.join(self.map_dir, '*.yaml')))
        if not yaml_paths:
            self.get_logger().warn(f'No map yaml files found in {self.map_dir}')
            return

        for yaml_path in yaml_paths:
            try:
                self.process_one_map(yaml_path)
            except Exception as exc:
                self.get_logger().error(f'Failed to process {yaml_path}: {exc}')

    def process_one_map(self, yaml_path):
        with open(yaml_path, 'r') as f:
            meta = yaml.safe_load(f)

        map_dir = os.path.dirname(yaml_path)
        pgm_path = os.path.join(map_dir, meta['image'])
        img = cv2.imread(pgm_path, cv2.IMREAD_UNCHANGED)
        if img is None:
            raise RuntimeError(f'could not read {pgm_path}')

        self.get_logger().info(f'Cleaning {pgm_path} ({img.shape[1]}x{img.shape[0]})')
        clean_img = self.clean_map(img)

        # crop the pgm itself (not just the preview render) so the pixel
        # coordinates every downstream node/webpage uses (room polygons,
        # robot pose, the displayed png) all agree with each other
        original_height = clean_img.shape[0]
        clean_img, x0, y0 = self.crop_to_content(clean_img)

        basename = os.path.splitext(os.path.basename(yaml_path))[0]
        out_pgm_name = f'{basename}.pgm'
        out_png_name = f'{basename}.png'

        cv2.imwrite(os.path.join(self.output_dir, out_pgm_name), clean_img)

        out_meta = dict(meta)
        out_meta['image'] = out_pgm_name
        resolution = meta['resolution']
        origin = meta['origin']
        out_meta['origin'] = [
            float(origin[0] + x0 * resolution),
            float(origin[1] + (original_height - (y0 + clean_img.shape[0])) * resolution),
            float(origin[2]) if len(origin) > 2 else 0.0,
        ]
        with open(os.path.join(self.output_dir, f'{basename}.yaml'), 'w') as f:
            yaml.safe_dump(out_meta, f, default_flow_style=None, sort_keys=False)

        render = self.render_floor_plan(clean_img)
        cv2.imwrite(os.path.join(self.output_dir, out_png_name), render)

        self.get_logger().info(
            f'Wrote {out_pgm_name}, {basename}.yaml, {out_png_name} to {self.output_dir}'
        )

    def clean_map(self, img):
        free_mask = (img >= FREE_VALUE_MIN).astype(np.uint8) * 255

        k = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (self.morph_kernel_size, self.morph_kernel_size)
        )
        mask = cv2.morphologyEx(free_mask, cv2.MORPH_OPEN, k, iterations=1)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k, iterations=2)

        # keep only the largest connected free region; stray free pixels
        # left over in the unknown area are noise, not real floor
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
        if num_labels <= 1:
            return np.full(img.shape, UNKNOWN_VALUE, dtype=np.uint8)
        largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        free_region = np.where(labels == largest, 255, 0).astype(np.uint8)
        main_area = stats[largest, cv2.CC_STAT_AREA]

        # fill small interior holes (sensor noise); leave larger ones alone
        # since those are likely real interior obstacles (pillars, furniture)
        inv = cv2.bitwise_not(free_region)
        n2, labels2, stats2, _ = cv2.connectedComponentsWithStats(inv, connectivity=8)
        border_labels = (
            set(labels2[0, :]) | set(labels2[-1, :]) | set(labels2[:, 0]) | set(labels2[:, -1])
        )
        hole_thresh = max(self.hole_area_min_px, self.hole_area_ratio * main_area)
        filled = free_region.copy()
        for label in range(1, n2):
            if label in border_labels:
                continue
            if stats2[label, cv2.CC_STAT_AREA] < hole_thresh:
                filled[labels2 == label] = 255

        # straighten pixel-jagged walls into clean straight runs: simplify
        # each contour (outer boundary + any real interior obstacle holes)
        # to a low-vertex-count polygon, then snap every edge to horizontal
        # or vertical (this floor is built ~axis-aligned with the pixel
        # grid, so "snap to nearest axis" reads as "straighten the wall"
        # without needing to detect/rotate to a dominant angle first)
        smooth_free = self.straighten_walls(filled, hole_thresh)

        # draw a uniform-thickness wall ring just outside the floor instead
        # of keeping the original noisy occupied pixels
        kwall = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (2 * self.wall_thickness_px + 1, 2 * self.wall_thickness_px + 1)
        )
        dilated = cv2.dilate(smooth_free, kwall, iterations=1)
        wall_ring = cv2.bitwise_and(dilated, cv2.bitwise_not(smooth_free))

        out = np.full(img.shape, UNKNOWN_VALUE, dtype=np.uint8)
        out[smooth_free > 0] = FREE_VALUE
        out[wall_ring > 0] = OCCUPIED_VALUE
        return out

    def straighten_walls(self, filled, hole_thresh):
        contours, hierarchy = cv2.findContours(filled, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        hierarchy = hierarchy[0] if hierarchy is not None else []

        out = np.zeros_like(filled)
        for i, contour in enumerate(contours):
            is_outer = hierarchy[i][3] == -1
            area = cv2.contourArea(contour)
            if not is_outer and area < hole_thresh:
                continue  # small hole -> noise, leave it filled as floor

            approx = cv2.approxPolyDP(contour, self.straighten_epsilon_px, True).reshape(-1, 2)
            if len(approx) < 3:
                continue
            poly = self.rectilinearize(approx)
            cv2.drawContours(out, [poly], -1, 255 if is_outer else 0, thickness=-1)

        # rectilinearizing can very rarely nick the shape into a sliver at
        # the closing seam; keeping only the largest component discards it
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(out, connectivity=8)
        if num_labels > 1:
            largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
            out = np.where(labels == largest, 255, 0).astype(np.uint8)
        return out

    @staticmethod
    def rectilinearize(points, iterations=5):
        """Snap every polygon edge to horizontal or vertical.

        Walks the polygon forward, forcing each edge onto whichever axis it
        already lies closer to; repeating a few times lets the adjustment
        propagate all the way around so the loop closes back up cleanly.
        """
        pts = points.astype(np.float64).copy()
        n = len(pts)
        for _ in range(iterations):
            for i in range(n):
                j = (i + 1) % n
                dx = pts[j, 0] - pts[i, 0]
                dy = pts[j, 1] - pts[i, 1]
                if abs(dx) >= abs(dy):
                    pts[j, 1] = pts[i, 1]
                else:
                    pts[j, 0] = pts[i, 0]
        return np.round(pts).astype(np.int32)

    def crop_to_content(self, clean_img):
        known_mask = (clean_img != UNKNOWN_VALUE).astype(np.uint8)
        ys, xs = np.where(known_mask > 0)
        if len(ys) == 0:
            return clean_img, 0, 0

        pad = self.crop_padding_px
        h, w = clean_img.shape
        y0, y1 = int(max(0, ys.min() - pad)), int(min(h, ys.max() + pad))
        x0, x1 = int(max(0, xs.min() - pad)), int(min(w, xs.max() + pad))
        return clean_img[y0:y1, x0:x1], x0, y0

    def render_floor_plan(self, clean_img):
        render = np.full((*clean_img.shape, 3), 245, dtype=np.uint8)  # background
        render[clean_img == FREE_VALUE] = (255, 255, 255)             # floor
        render[clean_img == OCCUPIED_VALUE] = (60, 60, 60)             # walls
        return render


def main(args=None):
    rclpy.init(args=args)
    node = MakeClearFloorPlanNode()
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
