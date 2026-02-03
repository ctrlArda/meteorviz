
import sys
import os
sys.path.append(os.getcwd())
from app import calculate_coastal_depth_profile, get_bathymetry_depth

# Define a point known to be in the ocean but near land
# e.g. Off the coast of Japan or Turkey
# Mediterranean: Lat 36, Lon 30 (South of Turkey)
lat = 36.0
lon = 30.0

print(f"Testing point: {lat}, {lon}")
depth = get_bathymetry_depth(lat, lon)
print(f"Depth at point: {depth}m")

# The current function scans NORTH.
# Let's see what it finds.
profile = calculate_coastal_depth_profile(lat, lon, distance_km=200, num_points=10)
print("Profile (North Check):")
for p in profile:
    print(p)
