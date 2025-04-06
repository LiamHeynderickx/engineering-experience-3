#!/usr/bin/env python3
import cv2
import numpy as np
import argparse
import json

# Parse command-line argument for image path.
parser = argparse.ArgumentParser(description="Process board image to JSON")
parser.add_argument("--image", required=True, help="Path to input image")
args = parser.parse_args()

imageName = args.image  # Use the image path provided
image = cv2.imread(imageName)

# (Optional) If you want to save or log the original image, you can do so.
# cv2.imshow("Board State", image)
# cv2.waitKey(2000)

####################### DETECT GRID AREA AND CREATE GRID #######################
hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

lower_red_1 = np.array([0, 80, 80])
upper_red_1 = np.array([15, 255, 255])
lower_red_2 = np.array([150, 80, 80])
upper_red_2 = np.array([180, 255, 255])

mask1 = cv2.inRange(hsv, lower_red_1, upper_red_1)
mask2 = cv2.inRange(hsv, lower_red_2, upper_red_2)
mask = cv2.bitwise_or(mask1, mask2)
contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

# (Comment out visual displays)
# cv2.imshow("Board State", mask)
# cv2.waitKey(2000)

coordinates = []
for contour in contours:
    if cv2.contourArea(contour) > 10:
        M = cv2.moments(contour)
        if M["m00"] != 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            coordinates.append((cx, cy))

coordinates = sorted(coordinates, key=lambda p: (p[1], p[0]))
if len(coordinates) != 4:
    raise ValueError("Could not detect 4 red corner points!")

width, height = 500, 500
ideal_corners = np.float32([[0, 0], [width, 0], [width, height], [0, height]])
actual_corners = np.float32(coordinates)

matrix = cv2.getPerspectiveTransform(actual_corners, ideal_corners)
warped = cv2.warpPerspective(image, matrix, (width, height))

cell_size = width // 10
grid = [[(col * cell_size, row * cell_size) for col in range(10)] for row in range(10)]

# cv2.imshow("Board State", warped)
# cv2.waitKey(2000)

####################### DETECT GRID AND BOAT POSITIONS #######################
warped_hsv = cv2.cvtColor(warped, cv2.COLOR_BGR2HSV)
lower_green = np.array([30, 80, 80])
upper_green = np.array([90, 255, 255])
green_mask = cv2.inRange(warped_hsv, lower_green, upper_green)
boat_contours, _ = cv2.findContours(green_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

boat_data = []
for contour in boat_contours:
    x, y, w, h = cv2.boundingRect(contour)
    boat_center_x = x + w // 2
    boat_center_y = y + h // 2
    occupied_cells = set()
    threshold = 0.5
    cell_area = cell_size * cell_size

    for row in range(10):
        for col in range(10):
            cell_x, cell_y = grid[row][col]
            cell_bottom_right_x = cell_x + cell_size
            cell_bottom_right_y = cell_y + cell_size

            overlap_x1 = max(x, cell_x)
            overlap_y1 = max(y, cell_y)
            overlap_x2 = min(x + w, cell_bottom_right_x)
            overlap_y2 = min(y + h, cell_bottom_right_y)

            if overlap_x2 > overlap_x1 and overlap_y2 > overlap_y1:
                overlap_area = (overlap_x2 - overlap_x1) * (overlap_y2 - overlap_y1)
                if overlap_area > threshold * cell_area:
                    occupied_cells.add((row, col))

    if not occupied_cells:
        continue

    boat_size = len(occupied_cells)
    min_row = min(cell[0] for cell in occupied_cells)
    max_row = max(cell[0] for cell in occupied_cells)
    min_col = min(cell[1] for cell in occupied_cells)
    max_col = max(cell[1] for cell in occupied_cells)
    boat_width = max_col - min_col + 1
    boat_height = max_row - min_row + 1

    orientation = "Horizontal" if boat_width > boat_height else "Vertical"
    boat_data.append({
        "occupied_cells": list(occupied_cells),
        "size": boat_size,
        "orientation": orientation
    })

# Output the board data as JSON
print(json.dumps({"boats": boat_data}))
