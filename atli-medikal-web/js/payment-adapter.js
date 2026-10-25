/**
 * ATLI MEDİKAL — ÖDEME GEÇİDİ ADAPTÖRÜ (PAYMENT GATEWAY ADAPTER)
 * İyzico / PayTR 3D Secure Kredi Kartı • Havale/EFT • Kapıda Ödeme • WhatsApp Sipariş
 * Sürüm: 3.0.0 (Milestone 3)
 */

(function (window) {
  'use strict';

  const PaymentGatewayAdapter = {
    provider: 'iyzico', // 'iyzico' | 'paytr'
    sandboxMode: true,
    whatsappPhone: '905363527416',

    // Banka Hesap Bilgileri
    bankAccounts: [
      {
        id: 'ziraat',
        bankName: 'T.C. Ziraat Bankası',
        accountName: 'Atlı Medikal Tıbbi Cihazlar San. ve Tic. Ltd. Şti.',
        branch: 'Aydınlıkevler Şubesi (Şube Kodu: 1420)',
        iban: 'TR56 0001 0001 2345 6789 5001',
        rawIban: 'TR5600010001234567895001',
        icon: 'fa-university'
      },
      {
        id: 'isbank',
        bankName: 'Türkiye İş Bankası',
        accountName: 'Atlı Medikal Tıbbi Cihazlar San. ve Tic. Ltd. Şti.',
        branch: 'Hasköy/Aydınlıkevler Şubesi (Şube Kodu: 4210)',
        iban: 'TR64 0006 4000 0012 3456 7890 01',
        rawIban: 'TR640006400000123456789001',
        icon: 'fa-building-columns'
      },
      {
        id: 'vakifbank',
        bankName: 'VakıfBank',
        accountName: 'Atlı Medikal Tıbbi Cihazlar San. ve Tic. Ltd. Şti.',
        branch: 'Altındağ Şubesi (Şube Kodu: 0725)',
        iban: 'TR18 0001 5001 5800 7300 8920 01',
        rawIban: 'TR180001500158007300892001',
        icon: 'fa-landmark'
      }
    ],

    /**
     * Kredi Kartı Numarası Doğrulama (Luhn Algoritması) ve Kart Tipi Tespiti
     */
    validateCard(cardData) {
      const rawNumber = (cardData.number || cardData.cardNumber || '').toString().replace(/\D/g, '');
      const expiry = (cardData.expiry || `${cardData.expiryMonth || ''}/${cardData.expiryYear || ''}`).trim();
      const cvc = (cardData.cvc || '').toString().trim();
      const holder = (cardData.holder || cardData.cardholderName || '').toString().trim();

      const errors = [];
      let brand = 'unknown';

      // Marka tespiti
      if (/^4/.test(rawNumber)) {
        brand = 'visa';
      } else if (/^(5[1-5]|2[2-7])/.test(rawNumber)) {
        brand = 'mastercard';
      } else if (/^9792/.test(rawNumber)) {
        brand = 'troy';
      } else if (/^3[47]/.test(rawNumber)) {
        brand = 'amex';
      }

      // Kart Sahibi
      if (holder && holder.length < 3) {
        errors.push('Kart üzerindeki isim en az 3 karakter olmalıdır.');
      }

      // Kart Numarası Luhn Algoritması
      if (!/^\d{15,16}$/.test(rawNumber)) {
        errors.push('Kart numarası 16 haneli (Amex için 15) olmalıdır.');
      } else {
        let sum = 0;
        let shouldDouble = false;
        for (let i = rawNumber.length - 1; i >= 0; i--) {
          let digit = parseInt(rawNumber.charAt(i), 10);
          if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
          }
          sum += digit;
          shouldDouble = !shouldDouble;
        }
        if (sum % 10 !== 0) {
          errors.push('Geçersiz kart numarası (Luhn doğrulama hatası).');
        }
      }

      // Son Kullanma Tarihi Doğrulama
      const expMatch = expiry.match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/);
      if (!expMatch) {
        errors.push('Son kullanma tarihi AA/YY formatında olmalıdır.');
      } else {
        const month = parseInt(expMatch[1], 10);
        let year = parseInt(expMatch[2], 10);
        if (year < 100) year += 2000;

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        if (month < 1 || month > 12) {
          errors.push('Geçersiz son kullanma ayı (01-12).');
        } else if (year < currentYear || (year === currentYear && month < currentMonth)) {
          errors.push('Kartınızın son kullanma tarihi geçmiş.');
        } else if (year > currentYear + 15) {
          errors.push('Geçersiz son kullanma yılı.');
        }
      }

      // CVC / CVV Doğrulama
      const expectedCvcLen = brand === 'amex' ? 4 : 3;
      if (!new RegExp(`^\\d{${expectedCvcLen}}$`).test(cvc)) {
        errors.push(`Güvenlik kodu (CVC) ${expectedCvcLen} haneli olmalıdır.`);
      }

      return {
        valid: errors.length === 0,
        brand,
        errors
      };
    },

    /**
     * Türk Bankaları Taksit Tablosu Hesaplayıcı (Bonus, Maximum, World, Axess, CardFinans, Bankkart)
     */
    calculateInstallments(amount) {
      const validAmount = Number(amount) || 0;
      const plans = [
        { installments: 1, rate: 0, label: 'Tek Çekim (Peşin Fiyatına)' },
        { installments: 3, rate: 0, label: '3 Taksit (Peşin Fiyatına)' },
        { installments: 6, rate: 0.045, label: '6 Taksit (%4.5 Vade Farkı)' },
        { installments: 9, rate: 0.085, label: '9 Taksit (%8.5 Vade Farkı)' }
      ];

      return plans.map(p => {
        const total = Math.round(validAmount * (1 + p.rate) * 100) / 100;
        const monthly = Math.round((total / p.installments) * 100) / 100;
        return {
          installments: p.installments,
          monthly,
          total,
          ratePercent: Math.round(p.rate * 1000) / 10,
          label: p.label,
          hasInterest: p.rate > 0
        };
      });
    },

    /**
     * İyzico / PayTR 3D Secure Başlatma Stub'ı
     */
    async initPayment(payload) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            provider: this.provider,
            token: `atli_token_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
            redirectUrl: null,
            orderId: payload.orderId
          });
        }, 350);
      });
    },

    /**
     * Ödeme İşleme Stub'ı (İstemci Doğrulaması ve Simüle 3D Secure Yanıtı)
     */
    async processPayment(orderPayload, cardData) {
      return new Promise((resolve) => {
        setTimeout(() => {
          if (cardData) {
            const validation = this.validateCard(cardData);
            if (!validation.valid) {
              resolve({
                success: false,
                orderId: orderPayload.orderId,
                errorMessage: validation.errors.join(' ')
              });
              return;
            }
          }

          resolve({
            success: true,
            provider: this.provider,
            transactionId: `TXN-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
            orderId: orderPayload.orderId,
            requires3DSecure: false,
            timestamp: new Date().toISOString()
          });
        }, 500);
      });
    },

    /**
     * Tek Tıkla WhatsApp Sipariş Metni Oluşturucu
     */
    generateWhatsAppUrl(orderPayload) {
      const p = orderPayload || {};
      const customer = p.customer || {};
      const items = p.items || [];
      const orderId = p.orderId || `ATL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

      let lines = [];
      lines.push('🛒 *ATLI MEDİKAL SİPARİŞ TALEBİ*');
      lines.push(`📋 *Sipariş Kodu:* ${orderId}`);
      if (customer.fullName) lines.push(`👤 *Müşteri:* ${customer.fullName}`);
      if (customer.phone) lines.push(`📞 *Telefon:* ${customer.phone}`);
      if (customer.district || customer.city) {
        lines.push(`📍 *Bölge:* ${customer.district || 'Ankara'} / ${customer.city || 'Ankara'}`);
      }
      if (customer.address) lines.push(`🏠 *Adres:* ${customer.address}`);

      lines.push('');
      lines.push('📦 *Sipariş Edilen Ürünler:*');

      if (items.length > 0) {
        items.forEach((item, index) => {
          const unitPrice = Number(item.price).toLocaleString('tr-TR');
          lines.push(`${index + 1}. ${item.title} (SKU: ${item.id}) x ${item.quantity} Adet — ${unitPrice} ₺`);
        });
      } else {
        lines.push('(Sepette ürün seçilmedi)');
      }

      lines.push('');
      if (p.subtotal) lines.push(`💰 *Ara Toplam:* ${Number(p.subtotal).toLocaleString('tr-TR')} ₺`);
      lines.push(`🚚 *Teslimat / Kurulum:* ${p.shippingFee === 0 || p.shipping === 0 ? 'ÜCRETSİZ (Ankara Aynı Gün)' : (Number(p.shippingFee || p.shipping || 150).toLocaleString('tr-TR') + ' ₺')}`);
      if (p.grandTotal || p.total) lines.push(`💳 *Genel Toplam:* ${Number(p.grandTotal || p.total).toLocaleString('tr-TR')} ₺`);

      const methodNames = {
        credit_card: 'Kredi / Banka Kartı (İyzico / PayTR 3D Secure)',
        havale: 'Banka Havalesi / EFT',
        doorstep: 'Ankara İçi Kapıda / Kurulumda Ödeme',
        whatsapp: 'WhatsApp Üzerinden Danışmanla Sipariş'
      };
      lines.push(`💬 *Tercih Edilen Ödeme:* ${methodNames[p.paymentMethod] || 'WhatsApp Danışmanı ile Görüşme'}`);

      if (customer.orderNotes) {
        lines.push(`📝 *Müşteri Notu:* ${customer.orderNotes}`);
      }

      lines.push('');
      lines.push('Aydınlıkevler merkez mağazanızdan siparişimi teyit etmek istiyorum. Teşekkürler.');

      const text = lines.join('\n');
      return `https://wa.me/${this.whatsappPhone}?text=${encodeURIComponent(text)}`;
    }
  };

  window.PaymentGatewayAdapter = PaymentGatewayAdapter;
})(window);
