# 🚀 NASA Space Apps Challenge: MeteorViz - Asteroit Etki Tahmin ve Analiz Platformu

## 🌟 Proje Özeti
**MeteorViz**, NASA'nın gerçek zamanlı verilerini kullanarak Dünya'ya yaklaşan asteroitlerin (NEO) potansiyel çarpışma etkilerini analiz eden, yapay zeka destekli bilimsel bir simülasyon platformudur. Projemiz, sadece basit bir enerji hesabı yapmakla kalmaz; atmosferik giriş fiziğini, parçalanma mekaniklerini ve krater oluşum süreçlerini **Makine Öğrenmesi (ML)** ve **Fizik Tabanlı Modelleme** ile birleştirerek sunar.

## 🏆 Neden Bu Proje? (Güçlü Yönlerimiz)
Bu projeyi diğerlerinden ayıran temel özellikler şunlardır:

1.  **Hibrit Modelleme Yaklaşımı:**
    *   **Fizik Motoru:** Collins et al. (2005) ve Chyba et al. (1993) tarafından geliştirilen bilimsel makalelere dayalı "Pancake Effect" (Yassılaşma ve Parçalanma) modelini kullanır.
    *   **Yapay Zeka:** Fiziksel simülasyonlardan elde edilen verilerle eğitilmiş, yüksek doğruluklu (R² > 0.95) Makine Öğrenmesi modelleri (Random Forest / Gradient Boosting) ile anlık tahminler yapar.

2.  **Gerçek NASA Verisi:**
    *   NASA **NeoWs (Near Earth Object Web Service)** API'si kullanılarak gerçek asteroit verileri (çap, hız, yörünge) anlık olarak çekilir.
    *   Sentetik veri yerine, gerçek evren verileriyle çalışır.

3.  **Kapsamlı Etki Analizi:**
    *   Sadece krater çapını değil; atmosferde parçalanma yüksekliğini, enerji boşalımını ve tsunami/deprem risklerini de değerlendirir.
    *   Farklı asteroit tiplerini (Demir, Kaya, Buz) ve yoğunluklarını hesaba katar.

4.  **Kullanıcı Dostu Arayüz:**
    *   Karmaşık bilimsel verileri, herkesin anlayabileceği görselleştirmelere dönüştüren modern bir web arayüzü sunar.

## 🛠️ Kullanılan Teknolojiler ve Algoritmalar

### 🧠 Yapay Zeka ve Veri Bilimi
*   **Algoritmalar:**
    *   **Random Forest Regressor:** Karmaşık ve lineer olmayan ilişkileri modellemek için.
    *   **Gradient Boosting:** Hata oranını minimize etmek ve tahmin hassasiyetini artırmak için.
    *   **Linear & Ridge Regression:** Temel kıyaslama (benchmark) modelleri olarak.
*   **Validasyon:** 5-Katlı Çapraz Doğrulama (5-Fold Cross-Validation) ile modelin genelleme yeteneği test edilmiştir.
*   **Özellik Mühendisliği (Feature Engineering):** Kütle, Logaritmik Enerji, Momentum gibi fiziksel anlamlı türetilmiş veriler modele girdi olarak verilir.

### ⚛️ Fiziksel Modeller
*   **Atmosferik Giriş:** Sürüklenme (Drag), Ablasyon (Kütle Kaybı) ve Aerodinamik Parçalanma denklemleri.
*   **Krater Oluşumu:** Enerji ölçekleme yasaları (Scaling Laws).
*   **Kinetik Enerji:** $E_k = \frac{1}{2}mv^2$

## 🎯 Projenin Amacı ve Faydası
*   **Bilimsel Farkındalık:** Toplumu ve öğrencileri asteroit tehditleri konusunda bilimsel verilerle bilgilendirmek.
*   **Erken Uyarı Simülasyonu:** Olası bir çarpışma senaryosunda hasarın boyutunu saniyeler içinde tahmin ederek karar destek mekanizmalarına yardımcı olmak.
*   **Eğitim:** Fizik ve veri bilimi kavramlarını interaktif bir şekilde öğretmek.

## 📊 Model Doğruluğu
Eğitilen modellerimiz, test veri setleri üzerinde **%95'in üzerinde R² skoru** elde etmiştir. Bu, modelimizin fiziksel simülasyon sonuçlarını neredeyse birebir tahmin edebildiğini ve karmaşık fiziksel hesaplamaları milisaniyeler seviyesine indirdiğini gösterir.

---
*Bu proje, NASA Space Apps Challenge kapsamında geliştirilmiştir.*
