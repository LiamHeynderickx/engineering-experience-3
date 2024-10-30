import cv2
import numpy as np

img = cv2.imread('drawnGrid.jpeg')
gray = cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
edges = cv2.Canny(gray,50,150,apertureSize = 3)
minLineLength = 100
maxLineGap = 10
lines = cv2.HoughLinesP(edges,1,np.pi/180,100,minLineLength,maxLineGap)
for x1,y1,x2,y2 in lines[0]:
    cv2.line(img,(x1,y1),(x2,y2),(0,255,0),2)

cv2.imwrite('houghlines5.jpg',img)

imgR = cv2.resize(img, (0, 0), fx = 0.7, fy = 0.7)

cv2.imshow('Detected Grid with Numbers', imgR)


cv2.waitKey(0)
cv2.destroyAllWindows()