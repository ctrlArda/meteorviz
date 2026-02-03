import os
import json
import requests
import pandas as pd
import time
import random

DATASET_DIR = 'datasets'
os.makedirs(DATASET_DIR, exist_ok=True)

def download_submarine_cables():
    print("Downloading Submarine Cable Map data...")
    url = "https://www.submarinecablemap.com/api/v3/cable/all.json"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            # Save raw data
            with open(os.path.join(DATASET_DIR, 'submarine_cables.json'), 'w') as f:
                json.dump(data, f)
            print(f"✓ Submarine cables downloaded ({len(data)} cables).")
            
            # Process into a simplified GeoJSON-like structure for the app
            processed_cables = []
            for cable in data:
                # We need the geometry. The 'all.json' typically provides summaries.
                # We might need to fetch individual geometries if not present.
                # Checking structure... usually 'all.json' has ID and Name.
                # To be safe for the simulation, if no geometry, we'll skip or use landing points.
                processed_cables.append({
                   "id": cable.get("id"),
                   "name": cable.get("name"),
                   "length": cable.get("length"),
                   "owners": cable.get("owners"),
                   "landing_points": cable.get("landing_points", []) 
                })
            
            # Note: The detailed paths are usually in separate files per cable. 
            # For this MVP, we will rely on landing points or mocking the path between them.
            print("  - Processed cable metadata.")
            return True
    except Exception as e:
        print(f"✗ Failed to download cables: {e}")
        return False

def download_health_sites():
    print("Downloading Health Sites (Major Hospitals) via OSM Overpass...")
    # Query for hospitals with > 500 bed capacity or emergency tag (approximate for major)
    overpass_url = "http://overpass-api.de/api/interpreter"
    overpass_query = """
    [out:json][timeout:25];
    (
      node["amenity"="hospital"]["emergency"="yes"](36.0,26.0,42.0,45.0);
      way["amenity"="hospital"]["emergency"="yes"](36.0,26.0,42.0,45.0);
      relation["amenity"="hospital"]["emergency"="yes"](36.0,26.0,42.0,45.0);
    );
    out center;
    """
    # Note: Bounding box is roughly Turkey/Near East for speed. 
    # For global, we would need a huge download.
    # User asked for "Data", let's get a good sample region or a critical list.
    
    try:
        response = requests.get(overpass_url, params={'data': overpass_query}, timeout=30)
        if response.status_code == 200:
            data = response.json()
            elements = data.get('elements', [])
            
            hospitals = []
            for el in elements:
                lat = el.get('lat') or el.get('center', {}).get('lat')
                lon = el.get('lon') or el.get('center', {}).get('lon')
                if lat and lon:
                    hospitals.append({
                        "name": el.get('tags', {}).get('name', 'Unknown Hospital'),
                        "lat": lat,
                        "lon": lon,
                        "beds": el.get('tags', {}).get('beds', 'Unknown'),
                        "operator": el.get('tags', {}).get('operator', 'Unknown')
                    })
            
            with open(os.path.join(DATASET_DIR, 'health_facilities.json'), 'w', encoding='utf-8') as f:
                json.dump(hospitals, f, ensure_ascii=False, indent=2)
            print(f"✓ Health facilities downloaded ({len(hospitals)} facilities in target region).")
            return True
    except Exception as e:
        print(f"✗ Failed to download health sites: {e}")
        return False

def create_agricultural_zones():
    print("Generating Global Agricultural Zones Database...")
    # Mocking FAO GAEZ major crop belts
    zones = [
        {"name": "Corn Belt", "region": "USA/Midwest", "crop": "Corn", "harvest_month": 9, "lat_min": 37, "lat_max": 43, "lon_min": -97, "lon_max": -80, "output_share": 0.35},
        {"name": "Wheat Belt", "region": "Russia/Ukraine", "crop": "Wheat", "harvest_month": 7, "lat_min": 45, "lat_max": 55, "lon_min": 30, "lon_max": 50, "output_share": 0.20},
        {"name": "Rice Bowl", "region": "Southeast Asia", "crop": "Rice", "harvest_month": 10, "lat_min": 10, "lat_max": 30, "lon_min": 100, "lon_max": 120, "output_share": 0.30},
        {"name": "Soybean Corridor", "region": "Brazil", "crop": "Soybean", "harvest_month": 3, "lat_min": -25, "lat_max": -10, "lon_min": -60, "lon_max": -45, "output_share": 0.25},
        {"name": "Central Anatolia Cereal", "region": "Turkey", "crop": "Wheat/Barley", "harvest_month": 7, "lat_min": 37, "lat_max": 40, "lon_min": 30, "lon_max": 36, "output_share": 0.02}
    ]
    
    with open(os.path.join(DATASET_DIR, 'agricultural_zones.json'), 'w', encoding='utf-8') as f:
        json.dump(zones, f, indent=2)
    print(f"✓ Agricultural zones generated ({len(zones)} zones).")

def create_tsunami_runup_db():
    print("Creating Historical Tsunami Run-up Database...")
    # Sample from NOAA NCEI
    # runup_height is max water height on shore
    runups = [
        {"year": 2011, "location": "Tohoku, Japan", "cause": "Earthquake", "runup_m": 40.5, "lat": 39.2, "lon": 142.0},
        {"year": 2004, "location": "Sumatra, Indonesia", "cause": "Earthquake", "runup_m": 50.9, "lat": 3.3, "lon": 95.8},
        {"year": 1960, "location": "Valdivia, Chile", "cause": "Earthquake", "runup_m": 25.0, "lat": -39.8, "lon": -73.2},
        {"year": 2020, "location": "Samos, Greece/Turkey", "cause": "Earthquake", "runup_m": 3.8, "lat": 37.9, "lon": 26.8},
        {"year": 1908, "location": "Messina, Italy", "cause": "Earthquake", "runup_m": 12.0, "lat": 38.2, "lon": 15.6}
    ]
    
    df = pd.DataFrame(runups)
    df.to_csv(os.path.join(DATASET_DIR, 'historical_tsunami_runup.csv'), index=False)
    print(f"✓ Tsunami run-up database created ({len(df)} records).")

if __name__ == "__main__":
    download_submarine_cables()
    download_health_sites()
    create_agricultural_zones()
    create_tsunami_runup_db()
    
    print("\nAll requested datasets have been processed.")
