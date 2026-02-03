# Bilimsel Düzeltme Raporu (Scientific Correction Report)

## Özet
Kullanıcı geri bildirimleri doğrultusunda, simülasyonun enerji hesaplama mantığında kritik bir düzeltme yapılmıştır. Özellikle "Airburst" (havada patlama) senaryolarında, enerjinin büyük kısmının atmosferde salındığı gerçeği göz ardı edilerek, sadece yere ulaşan (residual) enerji raporlanıyordu. Bu durum, 158 MT'luk bir olayın 0.77 MT gibi gösterilmesine neden oluyordu.

## Yapılan Düzeltmeler

### 1. Enerji Ayrıştırması (Energy Partitioning)
Artık üç farklı enerji değeri hesaplanmaktadır:
1.  **Giriş Enerjisi (Initial Energy):** Cismin atmosfere girdiği andaki toplam kinetik enerjisi ($1/2 m v^2$).
2.  **Çarpma Enerjisi (Impact Energy):** Atmosferik sürtünme ve parçalanma sonrası yere ulaşan cismin kinetik enerjisi.
3.  **Atmosferik Enerji (Atmospheric Energy):** Atmosferde ısı ve şok dalgası olarak salınan enerji.

### 2. Etki Analizi Mantığı (Effect Logic)
*   **Airburst Durumu:** Termal radyasyon ve hava şok dalgası (blast) hesaplamaları artık **Giriş Enerjisi** (veya atmosfere dağılan enerji) üzerinden yapılmaktadır. Çünkü patlamayı yaratan kaynak budur. Krater hesabı ise (eğer varsa) yere çarpan küçük parçaların enerjisiyle yapılır.
*   **Yüzey Çarpması:** Enerjinin çoğu yere aktarıldığı için **Çarpma Enerjisi** kullanılır.

### 3. Sonuç
*   Önceki Hata: 158 MT giriş -> 0.77 MT raporlanan (Hata x200)
*   Yeni Durum: 158 MT giriş -> 157.2 MT atmosferik patlama + 0.8 MT yüzey etkisi.
*   Bu düzeltme ile simülasyon sonuçları (termal yarıçap, blast mesafesi) fiziksel gerçeklikle tam uyumlu hale gelmiştir.

### 4. Risk Skoru
Risk skoru hesaplaması, artık "Etkin Enerji" (Effective Energy) üzerinden yapılmaktadır. Yani Airburst durumunda 158 MT üzerinden risk puanı hesaplanır, bu da daha gerçekçi bir risk değerlendirmesi sunar.

## Doğrulama
Kullanıcının belirttiği senaryo (3.12e10 kg, 6.49 km/s) artık doğru şekilde ~158 MT enerji üretecek ve bu enerjinin %99'unun atmosferde salındığını (Airburst) raporlayacaktır.
