import numpy as np
import rasterio
from rasterio.transform import from_origin
import os

def create_emergency_data():
    print("⚠️ NOAA sunucuları yanıt vermiyor. Acil durum protokolü devrede.")
    print("⚙️ Sentetik Topografya ve Batimetri verisi üretiliyor...")

    # 1. Dosya İsimleri
    dem_file = "global_dem.tif"
    bath_file = "global_bathymetry.tif"

    # 2. Düşük Çözünürlüklü Dünya Izgarası Oluştur (360x180 - 1 Derece)
    # Bu sayede dosya boyutu çok küçük olur ve hemen oluşur.
    width = 360
    height = 180
    
    # Basit bir veri seti:
    # Karalar pozitif (+100m), Denizler negatif (-3000m)
    # Varsayılan olarak her yeri 'Deniz' yapalım, app.py çökmesin.
    data = np.full((height, width), -3000.0, dtype=np.float32)
    
    # Basit bir "Türkiye" yükseltisi ekleyelim (Kabaca 36-42N, 26-45E)
    # Enlem (Y ekseni): 90 - lat
    # Boylam (X ekseni): 180 + lon (veya 0-360 projeksiyonuna göre)
    # Rasterio varsayılan: Üst-Sol (-180, 90)
    
    # Türkiye Kutusunu 'Kara' yap (+1000m)
    # Enlem indeksleri (90 - 42) ile (90 - 36) arası -> 48 ile 54 arası
    # Boylam indeksleri (180 + 26) ile (180 + 45) arası -> 206 ile 225 arası
    data[48:54, 206:225] = 1000.0

    # 3. GeoTIFF Özellikleri
    transform = from_origin(-180, 90, 1.0, 1.0) # Batı, Kuzey, X-Çözünürlük, Y-Çözünürlük
    
    # 4. Dosyayı Yaz (DEM)
    with rasterio.open(
        dem_file,
        'w',
        driver='GTiff',
        height=height,
        width=width,
        count=1,
        dtype=data.dtype,
        crs='+proj=latlong',
        transform=transform,
        nodata=-9999
    ) as dst:
        dst.write(data, 1)
    
    print(f"✅ {dem_file} oluşturuldu.")

    # 5. Dosyayı Yaz (Batimetri - Aynısı)
    # Batimetri için denizleri daha derin yapabiliriz ama şimdilik kopya yeterli.
    import shutil
    shutil.copy(dem_file, bath_file)
    print(f"✅ {bath_file} oluşturuldu.")
    
    print("\n🚀 İŞLEM TAMAM! Linklerle uğraşmana gerek kalmadı.")
    print("ARTIK SİMÜLASYONU BAŞLATABİLİRSİN: 'python app.py'")

if __name__ == "__main__":
    create_emergency_data()