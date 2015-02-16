import math
import numpy

def bearing(p0, p1):
    rise = p1[1] - p0[1]
    run = p1[0] - p0[0]
    return math.degrees(math.atan2(rise, run))

def distance(p0, p1):
    dLon = p1[0] - p0[0]
    dLat = p1[1] - p0[1]
    return math.sqrt(dLon*dLon + dLat*dLat)

def move(p0, bearing, distance):
    bearing = math.radians(bearing)
    lat = p0[1] + distance*math.sin(bearing)
    lon = p0[0] + distance*math.cos(bearing)
    return (lon, lat)

def centroid(points):
    centroid = sum([p[0] for p in points])/len(points), sum([p[1] for p in points])/len(points)
    radius = distance(centroid, points[0])
    for p in points[1:]:
        d = distance(centroid, p)
        if d > radius:
            radius = d
    return (centroid, radius)

def inside_circle(center, radius, point):
    d = distance(center, point)
    return d < radius

def radial_sort(point_list, centroid):
    return sorted([[bearing(centroid, p), distance(centroid, p)] for p in point_list], key=lambda p: p[0])

def is_outside(point, contour):

    ppx = point[0]
    ppy = point[1]

    k = 0
    for v0, v1 in zip(contour, contour[1:] + [contour[0]]):

        v0x = v0[0]
        v0y = v0[1]

        v1x = v1[0]
        v1y = v1[1]

        # ignore horizontals
        if v0y != v1y:

            # how far along the ray v0 -> v1 -> infinify is the intercept with y = pp[1]?
            d = (ppy - v0y) / (v1y - v0y)

            # if its inside the segment [v0, v1), then...
            if 0 <= d and 1 > d:

                # where is the X crossing?
                x = v0x + d*(v1x - v0x)

                # is it to the right of pp?
                if x > ppx:
                    k += 1

    # if there were an even number of crossings, then its outside
    return (k % 2) == 0


def fltr(linear, f, w):
    y = linear[-w:] + linear + linear[:w]
    if f == 'flat':
        k = numpy.ones(w)
    else:
        k = eval('numpy.' + f + '(w)')
    smooth = numpy.convolve(y, k/k.sum(), mode='same')[w:-w]
    return smooth


