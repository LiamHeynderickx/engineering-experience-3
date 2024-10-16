# # Importing the OpenCV library
# import cv2
# # Reading the image using imread() function
# image = cv2.imread('test.jpg')
#
# # Extracting the height and width of an image
# h, w = image.shape[:2]
# # Displaying the height and width
# print("Height = {}, Width = {}".format(h, w))
#
# # We will calculate the region of interest
# # by slicing the pixels of the image
# roi = image[100 : 500, 200 : 700]
# cv2.imshow("ROI", roi)
# cv2.waitKey(0)
# cv2.imshow("full", image)
# cv2.waitKey(0)
#
# # We are copying the original image,
# # as it is an in-place operation.
# output = image.copy()
#
# # Using the rectangle() function to create a rectangle.
# rectangle = cv2.rectangle(image, (1000, 700),
#                         (600, 400), (255, 0, 0), 2)
# cv2.imshow("full", image)
# cv2.waitKey(0)


import cv2
import numpy as np

# Load the image
img = cv2.imread('grid.png')

# Convert the image to HSV color space
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

# Define the range for the color you want to detect (in this case, blue)
# You can adjust the range depending on the color you're interested in
lower_blue = np.array([100, 150, 50])  # Lower bound of blue in HSV
upper_blue = np.array([140, 255, 255])  # Upper bound of blue in HSV

# Create a mask that isolates the blue color
mask = cv2.inRange(hsv, lower_blue, upper_blue)

# Find contours in the mask (or non-zero points)
contours, _ = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

# Loop through the contours to detect positions
for contour in contours:
    # Calculate the position of the detected color
    x, y, w, h = cv2.boundingRect(contour)
    # You can draw a rectangle around the detected color (optional)
    cv2.rectangle(img, (x, y), (x+w, y+h), (0, 255, 0), 2)
    # Print out or store the position
    print(f'blue found at position: x={x}, y={y}, width={w}, height={h}')


# Show the result (optional)
cv2.imshow('Detected Color', img)
cv2.waitKey(0)
cv2.destroyAllWindows()


