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
image = cv2.flip(image, 1)

boats_data = []

##need to make code more robust and check for conditions.

##show OG pic
# cv2.imshow("Board State", image)
# cv2.waitKey(2000)  #shows image briefly

####################### DETECT GRID AREA AND CREATE GRID #######################

# Convert to HSV
hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

# Detect corners of board (red, may change)
# this defines the range for red we are searching for
#test pics in GT to see how the lighting affects the performance.
lower_red_1 = np.array([0, 50, 50])
upper_red_1 = np.array([15, 255, 255])

lower_red_2 = np.array([160, 50, 50])
upper_red_2 = np.array([180, 255, 255])

#red has 2 colour ranges so we create a mask for both
# mask sets all red pixels to white and all other pixels to black (0)
mask1 = cv2.inRange(hsv, lower_red_1, upper_red_1)
mask2 = cv2.inRange(hsv, lower_red_2, upper_red_2)
mask = cv2.bitwise_or(mask1, mask2) #OR combines masks
contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE) #finds boundaries of regions in mask

#purely visual:
# cv2.imshow("Board State", mask)
# cv2.waitKey(2000)  #shows image briefly

#get central coordinates of red regions, these will be used as corners of the grid.
coordinates = []
for contour in contours:
    if cv2.contourArea(contour) > 15:  # Ignore small red areas (adjust according to more testing)
        M = cv2.moments(contour)
        if M["m00"] != 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            coordinates.append((cx, cy))
            #print(cx, cy)

# # Sort the corners (Top-left, Top-right, Bottom-right, Bottom-left)
# coordinates = sorted(coordinates, key=lambda p: (p[1], p[0]))  # Sort by Y, then X
# if len(coordinates) != 4:
#     raise ValueError("Could not detect 4 red corner points!")
# print(coordinates)
#
# #now we have 4 sorted points that can be used as the corners of the grid.
#
# #define the ideal grid corner positions
width, height = 500, 500  #defines fixed board size. (not sure if this is ideal but let's see)
# ideal_corners = np.float32([[0, 0], [width, 0], [width, height], [0, height]]) #standard corner pos
# actual_corners = np.float32(coordinates)
#
# #Map the actual corners on to the ideal corners (perspective transformation matrix)
# matrix = cv2.getPerspectiveTransform(actual_corners, ideal_corners)
# warped = cv2.warpPerspective(image, matrix, (width, height))

pts = np.array(coordinates, dtype="float32")

# the idea: sum and diff of (x,y) give you unique signatures
s = pts.sum(axis=1)
diff = np.diff(pts, axis=1)

ordered = np.zeros((4,2), dtype="float32")
ordered[0] = pts[np.argmin(s)]       # top-left  has smallest  x+y
ordered[2] = pts[np.argmax(s)]       # bot-right has largest   x+y
ordered[1] = pts[np.argmin(diff)]    # top-right has smallest  x−y
ordered[3] = pts[np.argmax(diff)]    # bot-left has largest   x−y

ideal = np.float32([[0,0],
                    [width,0],
                    [width,height],
                    [0,height]])
M = cv2.getPerspectiveTransform(ordered, ideal)
warped = cv2.warpPerspective(image, M, (width, height))


#calc size of grid cell
cell_size = width // 10

#create 2D grid array with actual coordinates of the grid (used later to map where the boats are)
grid = [[(col * cell_size, row * cell_size) for col in range(10)] for row in range(10)]

# cv2.imshow("Board State", warped) #purely visualisation
# cv2.waitKey(2000)  #shows image briefly

####################### DETECT GRID AREA AND CREATE GRID #######################

#convert warped image to HSV for black boat detection
warped_hsv = cv2.cvtColor(warped, cv2.COLOR_BGR2HSV)

#define the range for black boats (this may need to be changed depending on testing and we may change boat colour)
lower_black = np.array([0, 0, 0])
upper_black = np.array([180, 255, 80])

# Create mask for black color
black_mask = cv2.inRange(warped_hsv, lower_black, upper_black)

# Find contours of black boats
boat_contours, _ = cv2.findContours(black_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

#if not boat_contours:
    #print("No black boats detected!")

#purely visual:
# cv2.imshow("Board State", black_mask)
# cv2.waitKey(4000)  #shows image briefly

# detect position of black boats

# Perform connected components analysis to handle boats touching each other
num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(black_mask, connectivity=8)

threshold = 0.6
cell_area = cell_size * cell_size

for label in range(1, num_labels):  # Skip label 0 (background)
    component_mask = (labels == label).astype("uint8") * 255
    occupied_cells = set()

    for row in range(10):
        for col in range(10):
            cell_x, cell_y = grid[row][col]
            cell_roi = component_mask[cell_y:cell_y+cell_size, cell_x:cell_x+cell_size]

            overlap_area = cv2.countNonZero(cell_roi)
            
            if overlap_area > threshold * cell_area:
                occupied_cells.add((row, col))

    if occupied_cells:
        boat_size = len(occupied_cells)
        
        rows = [cell[0] for cell in occupied_cells]
        cols = [cell[1] for cell in occupied_cells]

        boat_width = max(cols) - min(cols) + 1
        boat_height = max(rows) - min(rows) + 1
        
        if boat_width > boat_height:
            orientation = "Horizontal"
        elif boat_height > boat_width:
            orientation = "Vertical"
        else:
            orientation = "Single Cell"

        # print(f"Boat at grid cells: {occupied_cells}")
        # print(f"Boat size: {boat_size} grid cells")
        # print(f"Boat orientation: {orientation}")

        # Optional visualization:
        for cell in occupied_cells:
            top_left = (grid[cell[0]][cell[1]][0], grid[cell[0]][cell[1]][1])
            bottom_right = (top_left[0] + cell_size, top_left[1] + cell_size)
            cv2.rectangle(warped, top_left, bottom_right, (255, 0, 0), 2)

            # populate json
            boats_data.append({
                "occupied_cells": sorted(list(occupied_cells)),  # sort for readability
                "size": boat_size,
                "orientation": orientation
            })


    

output = {"boats": boats_data}
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