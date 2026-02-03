
import sys
import os
import pandas as pd
import numpy as np
from flask import Flask

# app.py'nin bulunduğu dizini ekle
sys.path.append(r'c:\Users\ardau\Desktop\NASA')

# app.py'den fonksiyonları import etmeye çalış
# Tam import yaparsak app.py'deki kodlar çalışır (veri yükleme vs.)
# Bu yüzden try-except bloğu ile yapalım

print("Testing app.py imports and new functionality...")

try:
    from app import check_infrastructure_impact, POWER_PLANT_DF
    
    print("Successfully imported app.py resources.")
    
    if POWER_PLANT_DF is not None and not POWER_PLANT_DF.empty:
        print(f"Power Plant Data Loaded: {len(POWER_PLANT_DF)} records.")
        
        # Test Case: New York yakınlarında bir koordinat (yaklaşık)
        lat = 40.7128
        lon = -74.0060
        radius = 50 # km
        
        print(f"Testing check_infrastructure_impact for Lat: {lat}, Lon: {lon}, Radius: {radius}km")
        
        impacts = check_infrastructure_impact(lat, lon, radius)
        print(f"Found {len(impacts)} power plants.")
        for p in impacts[:3]:
            print(f" - {p['name']} ({p['capacity_mw']} MW) at {p['distance_km']} km")
            
    else:
        print("ERROR: POWER_PLANT_DF is not loaded.")

except Exception as e:
    print(f"Import or Execution Error: {e}")
    import traceback
    traceback.print_exc()
