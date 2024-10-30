# import cv2
# import numpy as np
#
# # Load the image
# img = cv2.imread('grid.png')
#
# # Convert the image to grayscale
# gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
#
# # Invert the image (optional, for better black line detection)
# inverted = cv2.bitwise_not(gray)
#
# # Use Canny edge detection to detect edges in the image
# edges = cv2.Canny(inverted, 50, 150, apertureSize=3)
#
# # Use Hough Line Transform to detect straight lines (the grid lines)
# lines = cv2.HoughLinesP(edges, rho=1, theta=np.pi/180, threshold=100, minLineLength=40, maxLineGap=10)
#
# # Draw the detected lines on the original image
# if lines is not None:
#     for line in lines:
#         x1, y1, x2, y2 = line[0]
#         cv2.line(img, (x1, y1), (x2, y2), (0, 255, 0), 1)
#
# # Display the original image with detected grid lines (optional)
# cv2.imshow('Detected Grid Lines', img)
# cv2.waitKey(0)
# cv2.destroyAllWindows()

import cv2
import numpy as np


def merge_similar_lines(lines, img_shape):
    """
    This function merges lines that are close to each other in terms of distance and angle.
    """
    merged_lines = []

    for current_line in lines:
        x1, y1, x2, y2 = current_line[0]

        # Check if current line is close to any existing merged lines
        added = False
        for merged_line in merged_lines:
            mx1, my1, mx2, my2 = merged_line

            # Calculate the distance between the starting points and the angles of the lines
            dist1 = np.sqrt((x1 - mx1) ** 2 + (y1 - my1) ** 2)
            dist2 = np.sqrt((x2 - mx2) ** 2 + (y2 - my2) ** 2)

            angle_diff = abs(np.arctan2(y2 - y1, x2 - x1) - np.arctan2(my2 - my1, mx2 - mx1))

            # If distance and angle difference is small, merge the lines
            if (dist1 < 25 and dist2 < 25 and angle_diff < np.pi / 36):  # Adjust tolerance for distance and angle
                # Average the points to merge the lines
                merged_line[0] = (x1 + mx1) // 2
                merged_line[1] = (y1 + my1) // 2
                merged_line[2] = (x2 + mx2) // 2
                merged_line[3] = (y2 + my2) // 2
                added = True
                break

        if not added:
            merged_lines.append([x1, y1, x2, y2])

    return merged_lines


# Load the image
img = cv2.imread('drawnGrid.jpeg')

# Convert the image to grayscale
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# Invert the image (optional, for better black line detection)
inverted = cv2.bitwise_not(gray)

# Use Canny edge detection to detect edges in the image
edges = cv2.Canny(inverted, 50, 150, apertureSize=3)

# Use Hough Line Transform to detect straight lines (the grid lines)
lines = cv2.HoughLinesP(edges, rho=1, theta=np.pi / 180, threshold=100, minLineLength=40, maxLineGap=10)

# Merge similar lines to avoid detecting 1 line as multiple lines
if lines is not None:
    merged_lines = merge_similar_lines(lines, img.shape)

    # Draw the merged lines on the original image
    for line in merged_lines:
        x1, y1, x2, y2 = line
        cv2.line(img, (x1, y1), (x2, y2), (0, 255, 0), 2)

# Display the original image with detected grid lines (optional)
imgR = cv2.resize(img, (0, 0), fx = 0.7, fy = 0.7)
cv2.imshow('Detected Grid Lines', imgR)
cv2.waitKey(0)
cv2.destroyAllWindows()


