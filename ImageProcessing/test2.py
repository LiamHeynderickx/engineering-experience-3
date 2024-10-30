import cv2
import numpy as np

# Load the image
img = cv2.imread('drawnGrid.jpeg')

# Convert the image to grayscale
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# Invert the image (optional, for better black line detection)
inverted = cv2.bitwise_not(gray)

# Apply Gaussian Blur to reduce noise
blurred = cv2.GaussianBlur(inverted, (5, 5), 0)

# Apply adaptive thresholding to better highlight the lines
thresholded = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                    cv2.THRESH_BINARY, 11, 2)

# Use Canny edge detection to detect edges in the image
edges = cv2.Canny(thresholded, 30, 100, apertureSize=3)

# Use Hough Line Transform to detect straight lines (the grid lines)
lines = cv2.HoughLinesP(edges, rho=1, theta=np.pi / 180, threshold=80, minLineLength=50, maxLineGap=20)

# Function to merge similar lines (if needed)
def merge_similar_lines(lines, img_shape):
    merged_lines = []
    for current_line in lines:
        x1, y1, x2, y2 = current_line[0]
        added = False
        for merged_line in merged_lines:
            mx1, my1, mx2, my2 = merged_line
            dist1 = np.sqrt((x1 - mx1) ** 2 + (y1 - my1) ** 2)
            dist2 = np.sqrt((x2 - mx2) ** 2 + (y2 - my2) ** 2)
            angle_diff = abs(np.arctan2(y2 - y1, x2 - x1) - np.arctan2(my2 - my1, mx2 - mx1))

            if (dist1 < 25 and dist2 < 25 and angle_diff < np.pi / 36):
                merged_line[0] = (x1 + mx1) // 2
                merged_line[1] = (y1 + my1) // 2
                merged_line[2] = (x2 + mx2) // 2
                merged_line[3] = (y2 + my2) // 2
                added = True
                break
        if not added:
            merged_lines.append([x1, y1, x2, y2])
    return merged_lines

# Merge similar lines (optional)
if lines is not None:
    merged_lines = merge_similar_lines(lines, img.shape)

    # Draw the merged lines on the original image
    for line in merged_lines:
        x1, y1, x2, y2 = line
        cv2.line(img, (x1, y1), (x2, y2), (0, 255, 0), 2)

# Resize image for better visualization
imgR = cv2.resize(img, (0, 0), fx = 0.5, fy = 0.3)

# Display the original image with detected grid lines
cv2.imshow('Detected Grid Lines', imgR)
cv2.waitKey(0)
cv2.destroyAllWindows()
