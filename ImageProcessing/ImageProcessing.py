import cv2
import numpy as np

# Load image
imageName = "imageVGA_withBoat_edited.png"
image = cv2.imread(imageName)

# Convert to HSV
hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

# Detect red markers (corners of the board)
lower_red_1 = np.array([0, 80, 80])
upper_red_1 = np.array([15, 255, 255])
lower_red_2 = np.array([150, 80, 80])
upper_red_2 = np.array([180, 255, 255])

mask1 = cv2.inRange(hsv, lower_red_1, upper_red_1)
mask2 = cv2.inRange(hsv, lower_red_2, upper_red_2)
mask = cv2.bitwise_or(mask1, mask2)
contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

coordinates = []
for contour in contours:
    if cv2.contourArea(contour) > 10:  # Ignore small detections
        M = cv2.moments(contour)
        if M["m00"] != 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            coordinates.append((cx, cy))

# Ensure correct sorting of corners (Top-left, Top-right, Bottom-right, Bottom-left)
coordinates = sorted(coordinates, key=lambda p: (p[1], p[0]))  # Sort by Y, then X
if len(coordinates) != 4:
    raise ValueError("Could not detect 4 red corner points!")

# Define the ideal grid corner positions
width, height = 500, 500  # Standardized board size
ideal_corners = np.float32([[0, 0], [width, 0], [width, height], [0, height]])
actual_corners = np.float32(coordinates)

# Compute perspective transformation matrix
matrix = cv2.getPerspectiveTransform(actual_corners, ideal_corners)
warped = cv2.warpPerspective(image, matrix, (width, height))

# Grid calculations
cell_size = width // 10

# Create 2D grid array with actual coordinates
grid = [[(col * cell_size, row * cell_size) for col in range(10)] for row in range(10)]

# ------------------------------------------------
# Detect green boats and map them to the grid
# ------------------------------------------------

# Convert warped image to HSV for green boat detection
warped_hsv = cv2.cvtColor(warped, cv2.COLOR_BGR2HSV)

# Define the range for green boats in HSV
lower_green = np.array([30, 80, 80])   # Lowered H from 35 to 30, S & V from 100 to 80
upper_green = np.array([90, 255, 255]) # Increased H from 85 to 90

# Create mask for green color
green_mask = cv2.inRange(warped_hsv, lower_green, upper_green)

# Find contours of green boats
boat_contours, _ = cv2.findContours(green_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

if not boat_contours:
    print("No green boats detected!")

for contour in boat_contours:
    x, y, w, h = cv2.boundingRect(contour)
    boat_center_x = x + w // 2
    boat_center_y = y + h // 2

    # Store occupied grid cells
    occupied_cells = set()

    # Define a threshold (e.g., 50% of the grid cell area)
    threshold = 0.5
    cell_area = cell_size * cell_size

    # Check which grid cells the boat occupies with majority overlap
    for row in range(10):
        for col in range(10):
            # Get the top-left corner of the grid cell
            cell_x, cell_y = grid[row][col]

            # Define the grid cell's boundaries (top-left and bottom-right corners)
            cell_bottom_right_x = cell_x + cell_size
            cell_bottom_right_y = cell_y + cell_size

            # Calculate the overlap between the grid cell and the boat's bounding box
            overlap_x1 = max(x, cell_x)
            overlap_y1 = max(y, cell_y)
            overlap_x2 = min(x + w, cell_bottom_right_x)
            overlap_y2 = min(y + h, cell_bottom_right_y)

            # Check if there's any overlap at all
            if overlap_x2 > overlap_x1 and overlap_y2 > overlap_y1:
                overlap_area = (overlap_x2 - overlap_x1) * (overlap_y2 - overlap_y1)
                # If the overlap area is greater than the threshold, consider the grid cell occupied
                if overlap_area > threshold * cell_area:
                    occupied_cells.add((row, col))

    # If no grid cells are occupied, skip processing this boat
    if not occupied_cells:
        print(f"No grid cells occupied for boat at ({boat_center_x}, {boat_center_y}), boat out of board range")
        continue

    # Determine the size of the boat in grid cells
    boat_size = len(occupied_cells)

    # Determine orientation (width vs height in grid cells)
    min_row = min(cell[0] for cell in occupied_cells)
    max_row = max(cell[0] for cell in occupied_cells)
    min_col = min(cell[1] for cell in occupied_cells)
    max_col = max(cell[1] for cell in occupied_cells)

    boat_width = max_col - min_col + 1
    boat_height = max_row - min_row + 1

    if boat_width > boat_height:
        orientation = "Horizontal"
    elif boat_height > boat_width:
        orientation = "Vertical"
    else:
        orientation = "Unknown"

    # Print boat info
    print(f"Boat at grid cells: {occupied_cells}")
    print(f"Boat size: {boat_size} grid cells")
    print(f"Boat orientation: {orientation}")

    # Draw bounding box and label with size/orientation
    cv2.rectangle(warped, (x, y), (x + w, y + h), (255, 0, 0), 2)
    cv2.putText(warped, f"{boat_size} cells", (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
    cv2.putText(warped, orientation, (x, y - 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)

# ------------------------------------------------
# Draw and number the grid on the warped image
# ------------------------------------------------
for row in range(11):  # One extra for the final boundary line
    # Draw horizontal lines
    cv2.line(warped, (0, row * cell_size), (width, row * cell_size), (0, 255, 0), 1)
    # Draw vertical lines
    cv2.line(warped, (row * cell_size, 0), (row * cell_size, height), (0, 255, 0), 1)

# Number the grid cells
for row in range(10):
    for col in range(10):
        # Calculate the center of each grid cell
        cell_x = col * cell_size + cell_size // 2
        cell_y = row * cell_size + cell_size // 2
        # Add the grid cell number
        cv2.putText(warped, f"{row},{col}", (cell_x - 10, cell_y + 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1, cv2.LINE_AA)

# ------------------------------------------------
# Show the final output
# ------------------------------------------------
# Resize the image to 50% of its original size
resized_image = cv2.resize(warped, (0, 0), fx=1, fy=1)

# Show the resized output
cv2.imshow('Warped Grid with Green Boats', resized_image)
cv2.waitKey(0) #change to close script immediately but keep image open
cv2.destroyAllWindows()
