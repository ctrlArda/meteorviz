# 🔬 MeteorViz: Bilimsel Dokümantasyon ve Metodoloji

Bu doküman, **MeteorViz** projesinin arkasındaki bilimsel modelleri, matematiksel formülleri, kullanılan algoritmaları ve teknik detayları içerir.

## 1. Fiziksel Modeller (Physics Engine)

Projemiz, asteroitlerin atmosferik girişini ve çarpışma etkilerini simüle etmek için literatürde kabul görmüş deterministik fizik modellerini kullanır.

### 1.1. Atmosferik Giriş ve "Pancake Effect"
Asteroit atmosferden geçerken maruz kaldığı aerodinamik kuvvetler, cismin parçalanmasına ve yassılaşmasına (pancake effect) neden olur. Bu süreç `validate_model.py` dosyasında **Chyba et al. (1993)** ve **Collins et al. (2005)** çalışmalarına dayandırılarak modellenmiştir.

**Temel Denklemler:**

1.  **Sürüklenme Kuvveti (Drag Force):**
    $$F_d = \frac{1}{2} C_d \rho_a v^2 A$$
    *   $C_d$: Sürüklenme katsayısı (Küre için ~0.47)
    *   $\rho_a$: Atmosfer yoğunluğu (Yüksekliğe bağlı olarak değişir: $\rho_a = \rho_0 e^{-h/H}$)
    *   $v$: Hız
    *   $A$: Kesit alanı

2.  **Ablasyon (Kütle Kaybı):**
    Sürtünmeden kaynaklanan ısı, asteroitin kütlesini buharlaştırır.
    $$\frac{dm}{dt} = -\sigma F_d v$$
    *   $\sigma$: Ablasyon katsayısı

3.  **Parçalanma (Fragmentation):**
    Aerodinamik basınç ($P = \rho_a v^2$), asteroitin içsel dayanıklılığını ($S$) aştığında parçalanma başlar.
    $$P > S \implies \text{Parçalanma}$$

### 1.2. Krater Oluşumu
Yere çarpan cismin oluşturacağı kraterin çapı, enerji ölçekleme yasaları (scaling laws) ile hesaplanır.

**Formül:**
$$D_{krater} = 1.161 \cdot \left(\frac{\rho_i}{\rho_t}\right)^{1/3} \cdot \left(\frac{E}{g \cdot \rho_t}\right)^{0.25} \cdot (\sin \theta)^{1/3}$$

*   $\rho_i$: Çarpan cismin yoğunluğu
*   $\rho_t$: Hedef zeminin yoğunluğu (Dünya kabuğu ~2700 kg/m³)
*   $E$: Çarpışma anındaki kinetik enerji ($Joule$)
*   $g$: Yerçekimi ivmesi ($9.81 m/s^2$)
*   $\theta$: Çarpışma açısı

## 2. Makine Öğrenmesi Metodolojisi (ML Pipeline)

Fiziksel simülasyonlar hesaplama açısından maliyetli olabilir. Bu nedenle, fizik motorumuzdan elde edilen verilerle bir yapay zeka modeli eğitilerek anlık tahmin yeteneği kazanılmıştır.

### 2.1. Veri Seti Oluşturma (`create_dataset_from_nasa.py`)
*   **Kaynak:** NASA NeoWs API.
*   **Süreç:** API'den çekilen gerçek asteroit verileri (çap, hız), rastgele atanan fiziksel özelliklerle (yoğunluk, açı) zenginleştirilir.
*   **Simülasyon:** Her bir veri noktası için fizik motoru çalıştırılarak "Gerçek Krater Çapı" (Target Variable) hesaplanır ve `nasa_impact_dataset.csv` dosyasına kaydedilir.

#### 2.1.1. Kullanılan Alanlar (Öznitelik Vektörü)
Veri seti her bir NEO (Near-Earth Object) için aşağıdaki grupları içerir:

**Tanımlayıcılar**
- `id`: Asteroit ID’si (NASA NEO ID)
- `designation`: Uluslararası isimlendirme kodu / referans kimliği (varsa)
- `name`: Nesne adı

**Fiziksel Özellikler**
- `absolute_magnitude_h` (H): Mutlak parlaklık büyüklüğü
- `is_potentially_hazardous` (PHA): Potansiyel tehlike bayrağı

**Yörünge Elemanları** (NeoWs `orbital_data`)
- Dış merkezlik: `eccentricity` ($e$)
- Yarı büyük eksen: `semi_major_axis` ($a$)
- Eğim: `inclination` ($i$)
- Yörünge periyodu: `orbital_period` ($P$)
- Günberi / günöte: `perihelion_distance` ($q$), `aphelion_distance` ($Q$)
- Ortalama anomali / ortalama hareket: `mean_anomaly` ($M$), `mean_motion` ($n$)

**Yaklaşım Dinamikleri**
- Bağıl hız: `velocity_kms` ($V_{rel}$)
- Minimum yörünge kesişim mesafesi: `moid_au` (MOID)

#### 2.1.2. Veri Genişletme ve Fiziksel Parametre Tahmini
NeoWs verilerinde bazı fiziksel parametreler eksik/heterojen olabildiği için, eğitim verisini zenginleştirmek amacıyla ampirik yaklaşımlar ve stokastik modeller kullanılır:

**(A) Materyal bileşimi ve yoğunluk ($\rho$)**
Üç ana materyal sınıfı tanımlanır ve yoğunluk atanır:
- Buz: $\rho_{ice} = 1000\;\mathrm{kg/m^3}$
- Kaya (silikat): $\rho_{rock} = 3000\;\mathrm{kg/m^3}$
- Demir (metalik): $\rho_{iron} = 7800\;\mathrm{kg/m^3}$

**(B) Çap tahmini (H–albedo bağıntısı)**
NASA çap tahmini yoksa, standart ilişkiyle çap türetilir:
$$D_{km} = \frac{1329}{\sqrt{p}}\,10^{-H/5}$$
Burada $p$ geometrik albedo değeridir. Uygulamada albedo, materyal tipine göre tipik bir değerin etrafında küçük bir oynama ile örneklenir.

**(C) Kinematik parametreler (stochastic)**
Çarpışma senaryolarının çeşitliliği için:
- Çarpışma açısı: $\theta \sim U(0^\circ, 90^\circ)$
- Giriş hızı (yaklaşım verisi eksikse):
$$V_i \sim \mathcal{N}(\mu=20,\sigma=5)\;\mathrm{km/s},\quad V_i\in[11,72]\;\mathrm{km/s}$$

**(D) Kütle ve enerji**
Küre varsayımı ile:
$$m = \frac{4}{3}\pi r^3\rho$$
Kinetik enerji:
$$E_k = \frac{1}{2}mv^2$$

**(E) Krater çapı**
Krater boyutları enerji ölçekleme yasalarıyla modellenir. Bu projede pratikte kullanılan form, Collins et al. (2005) tabanlı ölçekleme ile (bkz. Bölüm 1.2) hesaplanan krater çapıdır.

#### 2.1.3. Veri Temizleme ve Ön İşleme
Ham veri seti, modelin yakınsamasını iyileştirmek ve gürültüye dayanıklılığı artırmak için çok aşamalı ön işleme tabi tutulur:

**Eksik Veri İmputasyonu**
- Sayısal öznitelikler: medyan ile doldurma
- Kategorik değişkenler (örn. `composition`): mod; yoksa varsayılan `rock`

**Aykırı Değer Yönetimi (Winsorization)**
Z-skoru ile $|Z|>3$ olan ekstrem gözlemler, dağılımın üst sınırını temsil eden 99. persentile kırpılır.

**Özellik Dönüşümü ve Kodlama**
- Log dönüşümü: `log_mass = log(1+mass)`, `log_energy = log(1+E)`
- One-Hot Encoding: `composition` → `comp_ice`, `comp_rock`, `comp_iron`

Not: Özellik mühendisliğinin bir bölümü doğrudan eğitim kodunda (`train_model.py`) uygulanır.

### 2.2. Özellik Mühendisliği (Feature Engineering)
Modelin başarısını artırmak için ham verilerden yeni, fiziksel anlamı olan özellikler türetilmiştir:
*   **Log-Mass:** Kütlenin logaritması (Veri dağılımını düzeltmek için).
*   **Log-Energy:** Enerjinin logaritması.
*   **Momentum:** $p = m \cdot v$

### 2.3. Kullanılan Algoritmalar (`train_model.py`)
Projede aşağıdaki regresyon modelleri kıyaslanmıştır:
1.  **Linear Regression & Ridge:** Temel doğrusal ilişkileri yakalamak için.
2.  **Random Forest Regressor:** Lineer olmayan karmaşık ilişkileri ve özellik etkileşimlerini öğrenmek için (Ensemble Learning).
3.  **Gradient Boosting Regressor:** Hataları ardışık olarak düzelterek yüksek hassasiyet sağlamak için.

### 2.4. Model Doğrulama ve Performans
Modeller **5-Fold Cross-Validation** (5 Katlı Çapraz Doğrulama) ile test edilmiştir.
*   **Metrik:** $R^2$ (Belirleme Katsayısı)
*   **Başarı:** Gelişmiş modellerimiz (Random Forest / Gradient Boosting), test setlerinde **0.95+ $R^2$** skoru elde ederek fiziksel formülleri başarıyla "öğrendiğini" kanıtlamıştır.

## 3. Yazılım Mimarisi
*   **Backend:** Python (Flask) - API yönetimi ve model servisi.
*   **Veri İşleme:** Pandas, NumPy - Vektörel hesaplamalar.
*   **Coğrafi Analiz:** Rasterio, GeoPandas - Uydu verileri ve harita işlemleri.
*   **Frontend:** HTML5, CSS3, JavaScript - Kullanıcı etkileşimi.

## 4. Referanslar
1.  *Collins, G. S., Melosh, H. J., & Marcus, R. A. (2005). Earth Impact Effects Program: A Web-based computer program for calculating the regional environmental consequences of a meteoroid impact on Earth.*
2.  *Chyba, C. F., Thomas, P. J., & Zahnle, K. J. (1993). The 1908 Tunguska explosion: Atmospheric disruption of a stony asteroid.*
