/* ================================================================
   SahteAliskanliklar (MockHabits).js — Örnek Alışkanlık Verisi
   ================================================================ */

export const DURUM = {
  TAMAMLANDI: 'tamamlandi',
  BEKLEMEDE:  'beklemede',
  ATLANDI:    'atlandi',
}

export const ZAMAN_DILIMI = {
  SABAH:  'sabah',
  IS:     'is',
  AKSAM:  'aksam',
}

export const SahteAliskanliklar = [
  {
    id: 1,
    ad: 'Sabah Meditasyonu',
    not: 'Nefes egzersizleri ve zihin boşaltma. 10 dakika boyunca gözler kapalı sessiz ortamda yapılmalı.',
    kategori: 'Zihinsel Sağlık',
    zamanDilimi: ZAMAN_DILIMI.SABAH,
    miktar: '10 dk',
    durum: DURUM.TAMAMLANDI,
    seri: 12,
    hedefGun: 30,         
    gecmis: [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1], 
  },
  {
    id: 2,
    ad: 'Su İç (2L)',
    not: 'Güne 1 büyük bardak ılık su ile başla. Gün içine yayarak 2 litreyi tamamla.',
    kategori: 'Sağlık',
    zamanDilimi: ZAMAN_DILIMI.SABAH,
    miktar: '2 L',
    durum: DURUM.TAMAMLANDI,
    seri: 7,
    hedefGun: 21,
    gecmis: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  {
    id: 3,
    ad: 'Günlük Yürüyüş',
    not: 'Tempolu 30 dakika açık hava yürüyüşü.',
    kategori: 'Spor',
    zamanDilimi: ZAMAN_DILIMI.SABAH,
    miktar: '30 dk',
    durum: DURUM.BEKLEMEDE,
    seri: 4,
    hedefGun: 30,
    gecmis: [1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1],
  },
  {
    id: 4,
    ad: 'Deep Work Seansı',
    not: 'Telefon sessizde, bildirimler kapalı tam odak çalışma seansı.',
    kategori: 'Verimlilik',
    zamanDilimi: ZAMAN_DILIMI.IS,
    miktar: '90 dk',
    durum: DURUM.TAMAMLANDI,
    seri: 21,
    hedefGun: 60,
    gecmis: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  {
    id: 5,
    ad: 'Kitap Okuma',
    not: 'Şu an okunan: Atomik Alışkanlıklar - James Clear',
    kategori: 'Kişisel Gelişim',
    zamanDilimi: ZAMAN_DILIMI.AKSAM,
    miktar: '20 sayfa',
    durum: DURUM.BEKLEMEDE,
    seri: 9,
    hedefGun: 30,
    gecmis: [1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1],
  },
]

export const GunlukOzet = {
  toplamAliskanlik: SahteAliskanliklar.length,
  tamamlanan: SahteAliskanliklar.filter(a => a.durum === DURUM.TAMAMLANDI).length,
  bekleyen: SahteAliskanliklar.filter(a => a.durum === DURUM.BEKLEMEDE).length,
  atlanan: SahteAliskanliklar.filter(a => a.durum === DURUM.ATLANDI).length,
  yuzde: Math.round(
    (SahteAliskanliklar.filter(a => a.durum === DURUM.TAMAMLANDI).length /
     SahteAliskanliklar.length) * 100
  ),
}

export const OdakVerileri = {
  toplamSure: 120,
  tamamlananDongu: 4,
  gunlukHedef: 8,
}
