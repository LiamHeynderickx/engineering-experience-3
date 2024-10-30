import cv2
import numpy as np


img = cv2.imread('paper2.jpeg')

hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

lower_blue = np.array([100, 150, 50])
upper_blue = np.array([140, 255, 255])
# Example of striding through the HSV image every 2 pixels
stride = 25  # Change this value to increase the step size
subsampled_hsv = hsv[::stride, ::stride]  # Select every 'stride' pixel in both directions

# Apply the mask to the subsampled image
mask = cv2.inRange(subsampled_hsv, lower_blue, upper_blue)

# Optionally, resize the mask back to the original size
mask = cv2.resize(mask, (hsv.shape[1], hsv.shape[0]), interpolation=cv2.INTER_NEAREST)
contours, _ = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)


for contour in contours:
    # Calculate the position of the detected color
    x, y, w, h = cv2.boundingRect(contour)
    # You can draw a rectangle around the detected color (optional)
    cv2.rectangle(img, (x, y), (x+w, y+h), (0, 255, 0), 10)
    # Print out or store the position
    print(f'blue found at position: x={x}, y={y}, width={w}, height={h}')


# Show the result (optional)
imgR = cv2.resize(img, (0, 0), fx = 0.5, fy = 0.3)
cv2.imshow('Detected Color', imgR)
cv2.waitKey(0)
cv2.destroyAllWindows()