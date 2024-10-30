import cv2
import numpy as np


# Function to detect and extend lines to cover the whole image
def extend_line(line, img_shape, axis):
    if axis == 'vertical':
        # Extend vertical line to the full height of the image
        x = line[0]
        return [x, 0, x, img_shape[0]]
    elif axis == 'horizontal':
        # Extend horizontal line to the full width of the image
        y = line[1]
        return [0, y, img_shape[1], y]


# Load the image
img = cv2.imread('drawnGrid.jpeg')

# Convert the image to grayscale
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# Apply Gaussian Blur to reduce noise
blurred = cv2.GaussianBlur(gray, (5, 5), 0)

# Use Canny edge detection to detect edges
edges = cv2.Canny(blurred, 50, 150, apertureSize=3)

# Use Hough Line Transform to detect lines
lines = cv2.HoughLinesP(edges, rho=1, theta=np.pi / 180, threshold=100, minLineLength=100, maxLineGap=10)

# Separate vertical and horizontal lines
vertical_lines = []
horizontal_lines = []

if lines is not None:
    for line in lines:
        x1, y1, x2, y2 = line[0]
        # Calculate the angle of the line
        angle = np.arctan2(y2 - y1, x2 - x1)
        if abs(angle) < np.pi / 4:  # Horizontal lines (angle near 0 degrees)
            horizontal_lines.append([x1, y1, x2, y2])
        elif abs(angle) > np.pi / 2 - np.pi / 4:  # Vertical lines (angle near 90 degrees)
            vertical_lines.append([x1, y1, x2, y2])

# Get the image dimensions
img_height, img_width = img.shape[:2]

# Extend vertical and horizontal lines to cover the whole image
extended_vertical_lines = [extend_line([x1, y1, x2, y2], img.shape[:2], 'vertical') for x1, y1, x2, y2 in
                           vertical_lines]
extended_horizontal_lines = [extend_line([x1, y1, x2, y2], img.shape[:2], 'horizontal') for x1, y1, x2, y2 in
                             horizontal_lines]

# Draw the extended lines on the image
for line in extended_vertical_lines:
    x1, y1, x2, y2 = line
    cv2.line(img, (x1, y1), (x2, y2), (0, 255, 0), 2)

for line in extended_horizontal_lines:
    x1, y1, x2, y2 = line
    cv2.line(img, (x1, y1), (x2, y2), (0, 255, 0), 2)

# Find the intersection points of vertical and horizontal lines
intersection_points = []

for vline in extended_vertical_lines:
    for hline in extended_horizontal_lines:
        x_v = vline[0]  # Vertical line's x-coordinate (it's constant)
        y_h = hline[1]  # Horizontal line's y-coordinate (it's constant)
        intersection_points.append((x_v, y_h))

# Assign numbers to each grid cell
cell_number = 1
grid_size = 10  # Assuming a 10x10 grid

for i in range(1, grid_size):
    for j in range(1, grid_size):
        # Get the top-left corner of each grid cell
        top_left_x = extended_vertical_lines[i - 1][0]
        top_left_y = extended_horizontal_lines[j - 1][1]

        # Draw the cell number at the center of each grid cell
        center_x = (top_left_x + extended_vertical_lines[i][0]) // 2
        center_y = (top_left_y + extended_horizontal_lines[j][1]) // 2
        cv2.putText(img, str(cell_number), (center_x - 10, center_y + 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)

        cell_number += 1

# Show the image with detected grid and numbers
imgR = cv2.resize(img, (0, 0), fx = 0.7, fy = 0.7)

cv2.imshow('Detected Grid with Numbers', imgR)

# Save the result if needed
# cv2.imwrite('image_with_grid_and_numbers.jpg', img)

cv2.waitKey(0)
cv2.destroyAllWindows()
