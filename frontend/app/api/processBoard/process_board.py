import cv2
import numpy as np
import argparse
import json

# Parse command-line argument for image path.
parser = argparse.ArgumentParser(description="Process board image to JSON")
parser.add_argument("--image", required=True, help="Path to input image")
args = parser.parse_args()

imageName = args.image
image = cv2.imread(imageName)
if image is None:
    print(json.dumps({"error": f"Could not read image: {imageName}"}))
    exit()

image = cv2.flip(image, 1)

boats_data = []

##need to make code more robust and check for conditions.

##show OG pic
# cv2.imshow("Board State", image)
# cv2.waitKey(2000)  #shows image briefly

####################### DETECT GRID AREA AND CREATE GRID #######################

# Convert to HSV
hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

# Define red ranges for corner detection (adjust if needed)
lower_red_1 = np.array([0, 80, 80])
upper_red_1 = np.array([15, 255, 255])
lower_red_2 = np.array([150, 80, 80])
upper_red_2 = np.array([180, 255, 255])

# Create mask for red corners
mask1 = cv2.inRange(hsv, lower_red_1, upper_red_1)
mask2 = cv2.inRange(hsv, lower_red_2, upper_red_2)
mask = cv2.bitwise_or(mask1, mask2)

# Find contours of red corners
contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

# Get center coordinates of red corners
coordinates = []
for contour in contours:
    if cv2.contourArea(contour) > 10:
        M = cv2.moments(contour)
        if M["m00"] != 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            coordinates.append((cx, cy))

# Check if we found 4 corners
if len(coordinates) != 4:
    print(json.dumps({"error": f"Expected 4 red corners, but found {len(coordinates)}"}))
    exit()

# Order the corners: TL, TR, BR, BL
pts = np.array(coordinates, dtype="float32")
s = pts.sum(axis=1)
diff = np.diff(pts, axis=1)
ordered = np.zeros((4, 2), dtype="float32")
ordered[0] = pts[np.argmin(s)]      # Top-left
ordered[2] = pts[np.argmax(s)]      # Bottom-right
ordered[1] = pts[np.argmin(diff)]   # Top-right
ordered[3] = pts[np.argmax(diff)]   # Bottom-left

# Warp the perspective
width, height = 500, 500
ideal = np.float32([[0, 0], [width, 0], [width, height], [0, height]])
M = cv2.getPerspectiveTransform(ordered, ideal)
warped = cv2.warpPerspective(image, M, (width, height))

# Calculate grid cell size and define grid coordinates
cell_size = width // 10
grid = [[(col * cell_size, row * cell_size) for col in range(10)] for row in range(10)]

# cv2.imshow("Board State", warped) #purely visualisation
# cv2.waitKey(2000)  #shows image briefly

####################### DETECT BOATS #######################

# Convert warped image to HSV for black boat detection
warped_hsv = cv2.cvtColor(warped, cv2.COLOR_BGR2HSV)

# Define range for black boats (adjust if needed)
lower_black = np.array([0, 0, 0])
upper_black = np.array([180, 255, 120]) # Increased upper brightness slightly

# Create mask for black color
black_mask = cv2.inRange(warped_hsv, lower_black, upper_black)

# Optional: Apply morphological operations to clean up mask
kernel = np.ones((3,3), np.uint8)
black_mask = cv2.morphologyEx(black_mask, cv2.MORPH_OPEN, kernel, iterations=1)
black_mask = cv2.morphologyEx(black_mask, cv2.MORPH_CLOSE, kernel, iterations=1)

# Find all potentially occupied cells based on overlap
threshold = 0.55 # Adjusted threshold slightly
cell_area = cell_size * cell_size
all_occupied_cells = set()

for row in range(10):
    for col in range(10):
        cell_x, cell_y = grid[row][col]
        cell_roi = black_mask[cell_y:cell_y+cell_size, cell_x:cell_x+cell_size]
        overlap_area = cv2.countNonZero(cell_roi)

        if overlap_area > threshold * cell_area:
            all_occupied_cells.add((row, col))

# --- Simplified Boat Finding Logic with Fallback ---
expected_boat_sizes = [5, 4, 3, 3, 2]
found_boats_details = []
remaining_cells = all_occupied_cells.copy()
found_boat_sizes = []

# Helper to check for contiguous cells
def get_boat_cells(start_row, start_col, size, is_vertical):
    cells = []
    for i in range(size):
        row = start_row + i if is_vertical else start_row
        col = start_col if is_vertical else start_col + i
        if 0 <= row < 10 and 0 <= col < 10:
            cells.append((row, col))
        else:
            return [] # Out of bounds
    return cells

# --- Pass 1: Greedy search for clear boat shapes ---
def find_and_remove_boat(size, cells_pool):
    # Try vertical first
    for r in range(10 - size + 1):
        for c in range(10):
            potential_boat = get_boat_cells(r, c, size, is_vertical=True)
            if potential_boat and all(cell in cells_pool for cell in potential_boat):
                for cell in potential_boat:
                    cells_pool.discard(cell)
                return {"occupied_cells": sorted(potential_boat), "size": size, "orientation": "Vertical"}
    # Try horizontal if no vertical found
    for r in range(10):
        for c in range(10 - size + 1):
            potential_boat = get_boat_cells(r, c, size, is_vertical=False)
            if potential_boat and all(cell in cells_pool for cell in potential_boat):
                for cell in potential_boat:
                    cells_pool.discard(cell)
                return {"occupied_cells": sorted(potential_boat), "size": size, "orientation": "Horizontal"}
    return None # No boat of this size found

# Try to find boats greedily, largest first
temp_expected = sorted(expected_boat_sizes, reverse=True)
for boat_size in temp_expected:
    boat_info = find_and_remove_boat(boat_size, remaining_cells)
    if boat_info:
        found_boats_details.append(boat_info)
        found_boat_sizes.append(boat_size)

# --- Pass 2: Fallback for missing boats using remaining cells ---
missing_boat_sizes = sorted(expected_boat_sizes, reverse=True)
for size in found_boat_sizes:
    if size in missing_boat_sizes:
        missing_boat_sizes.remove(size)

if missing_boat_sizes and remaining_cells:
    # Try to form missing boats from remaining scattered cells
    # This is a simple heuristic: group connected components
    
    # Group remaining cells into connected components (clusters)
    clusters = []
    visited = set()
    temp_remaining = remaining_cells.copy()

    while temp_remaining:
        cluster = []
        q = [temp_remaining.pop()] # Start BFS from an arbitrary cell
        visited.add(q[0])
        cluster.append(q[0])

        head = 0
        while head < len(q):
            r, c = q[head]
            head += 1
            # Check neighbors (up, down, left, right)
            for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                nr, nc = r + dr, c + dc
                neighbor = (nr, nc)
                if neighbor in remaining_cells and neighbor not in visited:
                    visited.add(neighbor)
                    q.append(neighbor)
                    cluster.append(neighbor)
                    temp_remaining.discard(neighbor) # Remove from pool
        clusters.append(cluster)

    # Try to assign clusters to missing boat sizes
    clusters.sort(key=len, reverse=True) # Process larger clusters first
    assigned_clusters = set()

    for size_needed in sorted(missing_boat_sizes, reverse=True):
        best_cluster_match = None
        for i, cluster in enumerate(clusters):
            if i not in assigned_clusters and len(cluster) >= size_needed: # Allow larger clusters for smaller boats
                 # Basic check: If cluster size is close enough or larger
                 # More sophisticated checks could be added (e.g., linearity)
                 best_cluster_match = i
                 break # Take the first suitable cluster

        if best_cluster_match is not None:
            cluster_cells = clusters[best_cluster_match]
            assigned_clusters.add(best_cluster_match)
            
            # If cluster is larger than needed, take a subset (e.g., first 'size_needed' cells)
            boat_cells = sorted(cluster_cells)[:size_needed]
            
            # Determine orientation based on bounding box of the chosen cells
            rows = [cell[0] for cell in boat_cells]
            cols = [cell[1] for cell in boat_cells]
            orientation = "Vertical" if (max(rows) - min(rows) + 1) > (max(cols) - min(cols) + 1) else "Horizontal"
            if len(rows) == 1 and len(cols) == 1: orientation = "Vertical" # Default for single cell

            found_boats_details.append({
                "occupied_cells": boat_cells,
                "size": size_needed, # Report the size we NEEDED
                "orientation": orientation
            })
            # Remove these cells from the main remaining_cells set as well
            for cell in boat_cells:
                 remaining_cells.discard(cell)
            missing_boat_sizes.remove(size_needed) # Mark this size as fulfilled

# --- End Fallback Logic ---

# Ensure exactly 5 boats are in the output, padding if necessary (last resort)
final_boats_output = found_boats_details[:len(expected_boat_sizes)] # Take max 5 found
num_found = len(final_boats_output)
if num_found < len(expected_boat_sizes):
     # Add dummy boats for any still missing - place them off-grid? Or first available?
     # This indicates a significant detection failure.
     still_missing_sizes = sorted(expected_boat_sizes, reverse=True)
     for fb in final_boats_output:
         if fb['size'] in still_missing_sizes:
             still_missing_sizes.remove(fb['size'])
     
     # Add placeholder boats (e.g., at [-1,-1]) for missing sizes
     for missing_size in still_missing_sizes:
         final_boats_output.append({
             "occupied_cells": [[-1, -1]] * missing_size, # Invalid cells
             "size": missing_size,
             "orientation": "Unknown"
         })

# Prepare JSON output
output = {"boats": final_boats_output}
print(json.dumps(output, indent=4))

####################### DISPLAY IMAGE ANG GRID INFO #######################
####################### ALL CODE BELOW IS PURELY FOR VISUALISATION AND IS NOT NEEDED #######################

# #draw grid lines
# for row in range(11):
#     cv2.line(warped, (0, row * cell_size), (width, row * cell_size), (0, 255, 0), 1)
#     cv2.line(warped, (row * cell_size, 0), (row * cell_size, height), (0, 255, 0), 1)
#
# #number the grid cells at centre of cell
# for row in range(10):
#     for col in range(10):
#         cell_x = col * cell_size + cell_size // 2
#         cell_y = row * cell_size + cell_size // 2
#         cv2.putText(warped, f"{row},{col}", (cell_x - 10, cell_y + 5),
#                     cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1, cv2.LINE_AA)
#
# resized_image = cv2.resize(warped, (0, 0), fx=1, fy=1)

# cv2.imshow('Board State', resized_image)
# cv2.waitKey(0) #change to close script immediately but keep image open
# cv2.destroyAllWindows()

#code to save image below
# cv2.imwrite("GameStateOutput.png", resized_image)
# cv2.imshow("Board State", resized_image)
# cv2.waitKey(3000)  #shows image briefly before termination, image can be opened after (GameStateOutput.png)