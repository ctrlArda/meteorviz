# Veri Seti Kalite Raporu (Data Quality Report)

## Özet
`nasa_impact_dataset.csv` dosyası üzerinde yapılan incelemeler sonucunda, veri setinin doğruluğunu ve güvenilirliğini etkileyen önemli bulgulara rastlanmıştır. Özellikle veri setinin sonuna eklenmiş olan bazı kayıtlar, fiziksel gerçeklikle ve "Dünya'ya Yakın Nesne" (NEO) tanımıyla uyuşmamaktadır.

## Tespit Edilen Sorunlar

### 1. Kapsam Dışı Nesneler (Out-of-Scope Objects)
Veri setinde, Dünya'ya Yakın Nesne (NEO) sınıfına girmeyen, Ana Kuşak Asteroitleri ve Cüce Gezegenler bulunmaktadır. Bu nesnelerin Dünya'ya çarpma ihtimali, mevcut yörünge dinamikleri çerçevesinde değerlendirilmemelidir.

*   **Örnekler:**
    *   `1 Ceres` (Cüce Gezegen / Ana Kuşak)
    *   `4 Vesta` (Ana Kuşak)
    *   `2 Pallas` (Ana Kuşak)
    *   `10 Hygiea` (Ana Kuşak)

Bu nesneler `9000xxx` şeklinde özel ID'lerle veri setine eklenmiştir (Satır 2204 - 2253 arası).

### 2. Fiziksel Olarak İmkansız Değerler (Physically Impossible Values)
Veri setindeki bu büyük nesneler için hesaplanan "Krater Çapı" (`crater_diameter_m`) değerleri fiziksel olarak imkansız seviyelerdedir.

*   **Ceres:** Hesaplanan krater çapı **14,085 km**.
    *   *Karşılaştırma:* Dünya'nın çapı yaklaşık **12,742 km**'dir.
    *   *Sonuç:* Ceres büyüklüğünde bir cismin çarpması bir krater oluşturmaz, gezegeni tamamen yok eder veya yeniden şekillendirir. Mevcut krater formülü bu ölçekteki çarpışmalar için geçerli değildir.

### 3. Model Eğitimine Etkisi
Bu aykırı değerler (outliers), makine öğrenmesi modellerini (özellikle Regresyon modellerini) ciddi şekilde yanıltacaktır.
*   Model, krater çapını tahmin etmeye çalışırken bu devasa ve gerçek dışı değerleri öğrenmeye çalışacak, bu da normal NEO'lar (10m - 5km arası) için tahmin başarısını düşürecektir.
*   `mass_kg` ve `impact_energy_joules` değerleri de diğer verilerden katbekat büyüktür (10^20 kg mertebesinde), bu da veri dağılımını bozar.

## Öneriler

1.  **Veri Temizliği:** ID'si `9000000`'dan büyük olan veya `name` alanında Ana Kuşak asteroitlerini içeren satırların veri setinden çıkarılması önerilir.
2.  **Filtreleme:** Eğer bu nesneler "karşılaştırma" amaçlı tutulacaksa, model eğitimi (`train_model.py`) sırasında mutlaka filtrelenmelidir.
3.  **Formül Gözden Geçirme:** Krater hesaplama formülü, sadece belirli bir enerji aralığı için geçerli olabilir. Çok büyük çarpışmalar için farklı fiziksel modeller gerekir.

## İstatistiksel Özet (Aykırı Değerler Dahil)
*   **Maksimum Kütle:** ~9.39e20 kg (Ceres)
*   **Maksimum Krater:** ~14,085 km (Dünya'dan büyük!)
*   **Etkilenen Satır Sayısı:** Yaklaşık 50 adet (ID 9000001 - 9000050)

Bu kayıtların temizlenmesi, analiz ve modelleme çalışmalarının doğruluğu için kritiktir.
