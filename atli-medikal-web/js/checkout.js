/**
 * ATLI MEDİKAL — ÖDEME & SİPARİŞ TAMAMLAMA YÖNETİCİSİ (CHECKOUT MANAGER)
 * 4 Ödeme Seçeneği: İyzico/PayTR Kredi Kartı • Havale/EFT • Kapıda/Kurulumda Ödeme • WhatsApp Sipariş
 * Sürüm: 3.0.0 (Milestone 3)
 */

(function (window) {
  'use strict';

  class CheckoutManager {
    constructor() {
      this.selectedMethod = 'credit_card'; // 'credit_card' | 'havale' | 'doorstep' | 'whatsapp'
      this.selectedInstallment = 1;
      this.isSubmitting = false;
    }

    /**
     * Başlatıcı: UI Olaylarını Bağlama
     */
    init() {
      this.bindEvents();
      this.initCardInputFormatters();
    }

    /**
     * Checkout Modalı Açma
     */
    openModal() {
      const modal = document.getElementById('checkoutModal');
      const backdrop = document.getElementById('checkoutBackdrop');
      if (!modal) return;

      this.syncOrderSummary();
      this.switchPaymentMethod(this.selectedMethod);

      modal.classList.add('show', 'is-open');
      modal.setAttribute('aria-hidden', 'false');

      if (backdrop) {
        backdrop.classList.add('show', 'is-open');
        backdrop.setAttribute('aria-hidden', 'false');
      }

      document.body.classList.add('modal-open');
      document.body.style.overflow = 'hidden';

      // İlk input alanına odaklan
      const firstInput = document.getElementById('customerFullName');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 150);
      }
    }

    /**
     * Checkout Modalı Kapatma
     */
    closeModal() {
      const modal = document.getElementById('checkoutModal');
      const backdrop = document.getElementById('checkoutBackdrop');
      if (!modal) return;

      modal.classList.remove('show', 'is-open');
      modal.setAttribute('aria-hidden', 'true');

      if (backdrop) {
        backdrop.classList.remove('show', 'is-open');
        backdrop.setAttribute('aria-hidden', 'true');
      }

      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    }

    /**
     * Sipariş Özeti Senkronizasyonu (CartState ile)
     */
    syncOrderSummary() {
      if (!window.CartManager) return;
      const state = window.CartManager.getState();

      // Sipariş özet kutusunu doldur
      const summaryList = document.getElementById('checkoutSummaryItems');
      if (summaryList) {
        summaryList.innerHTML = state.items.map(item => `
          <div class="checkout-summary-row">
            <span class="checkout-summary-name">${item.title} <span class="summary-qty">x${item.quantity}</span></span>
            <span class="checkout-summary-price">${(item.price * item.quantity).toLocaleString('tr-TR')} ₺</span>
          </div>
        `).join('');
      }

      // Alt Toplam, Kargo, Genel Toplam
      const subtotalEl = document.getElementById('checkoutSubtotal');
      if (subtotalEl) subtotalEl.textContent = `${state.subtotal.toLocaleString('tr-TR')} ₺`;

      const shippingEl = document.getElementById('checkoutShipping');
      if (shippingEl) {
        shippingEl.innerHTML = state.shipping === 0
          ? '<span class="text-success font-bold">ÜCRETSİZ (Ankara Aynı Gün)</span>'
          : `${state.shipping.toLocaleString('tr-TR')} ₺`;
      }

      const totalEl = document.getElementById('checkoutGrandTotal');
      if (totalEl) totalEl.textContent = `${state.total.toLocaleString('tr-TR')} ₺`;

      // Kredi Kartı Taksit Tablosunu Yeniden Hesapla
      this.updateInstallmentTable(state.total);

      // WhatsApp Sipariş Linkini Güncelle
      this.updateWhatsAppOrderLink();
    }

    /**
     * 4 Ödeme Yöntemi Arasında Geçiş Yapma
     */
    switchPaymentMethod(method) {
      this.selectedMethod = method;

      // 1. Sekme Butonlarını ve Radyo Butonlarını Güncelle
      const tabs = document.querySelectorAll('.payment-method-tab');
      tabs.forEach(tab => {
        const tabMethod = tab.getAttribute('data-method') || (tab.querySelector('input') && tab.querySelector('input').value);
        const isActive = tabMethod === method;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');

        const radio = tab.querySelector('input[type="radio"]');
        if (radio) radio.checked = isActive;
      });

      // Radyo butonlarını da güncelle (ayrı radio alanları varsa)
      const radios = document.querySelectorAll('input[name="paymentMethod"]');
      radios.forEach(radio => {
        if (radio.value === method) radio.checked = true;
      });

      // 2. Ödeme İçerik Panellerini Göster / Gizle
      const panels = document.querySelectorAll('.payment-panel');
      panels.forEach(panel => {
        const panelMethod = panel.getAttribute('data-panel');
        if (panelMethod === method) {
          panel.style.display = 'block';
          panel.classList.add('active');
        } else {
          panel.style.display = 'none';
          panel.classList.remove('active');
        }
      });

      // 3. CTA Buton Metnini Yönteme Göre Güncelle
      const submitBtn = document.getElementById('btnCompleteOrder') || document.getElementById('checkoutSubmitBtn');
      if (submitBtn) {
        if (method === 'credit_card') {
          submitBtn.innerHTML = '<i class="fas fa-lock" aria-hidden="true"></i> 3D Secure ile Güvenli Öde';
        } else if (method === 'havale') {
          submitBtn.innerHTML = '<i class="fas fa-university" aria-hidden="true"></i> Havale/EFT Siparişini Onayla';
        } else if (method === 'doorstep') {
          submitBtn.innerHTML = '<i class="fas fa-truck" aria-hidden="true"></i> Kapıda Ödemeli Siparişi Onayla';
        } else if (method === 'whatsapp') {
          submitBtn.innerHTML = '<i class="fab fa-whatsapp" aria-hidden="true"></i> WhatsApp ile Siparişi Tamamla';
        }
      }

      this.updateWhatsAppOrderLink();
    }

    /**
     * Taksit Tablosunu Dinamik Güncelleme
     */
    updateInstallmentTable(amount) {
      const tbody = document.getElementById('installmentTableBody');
      if (!tbody || !window.PaymentGatewayAdapter) return;

      const installments = window.PaymentGatewayAdapter.calculateInstallments(amount);
      tbody.innerHTML = installments.map(item => `
        <tr class="installment-row ${item.installments === this.selectedInstallment ? 'selected' : ''}">
          <td>
            <label class="installment-radio-label">
              <input type="radio" name="cardInstallment" value="${item.installments}" ${item.installments === this.selectedInstallment ? 'checked' : ''}>
              <strong>${item.installments === 1 ? 'Tek Çekim' : `${item.installments} Taksit`}</strong>
            </label>
          </td>
          <td>${item.monthly.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
          <td><strong>${item.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</strong></td>
          <td><span class="installment-badge ${item.hasInterest ? 'has-interest' : 'no-interest'}">${item.label}</span></td>
        </tr>
      `).join('');
    }

    /**
     * WhatsApp Sipariş Linkini Canlı Form Değerleriyle Senkronize Etme
     */
    updateWhatsAppOrderLink() {
      const waBtn = document.getElementById('whatsappOrderBtn') || document.querySelector('.btn-whatsapp-order');
      if (!waBtn || !window.PaymentGatewayAdapter || !window.CartManager) return;

      const state = window.CartManager.getState();
      const fullName = (document.getElementById('customerFullName') || {}).value || '';
      const phone = (document.getElementById('customerPhone') || {}).value || '';
      const district = (document.getElementById('customerDistrict') || {}).value || 'Altındağ';
      const address = (document.getElementById('customerAddress') || {}).value || '';
      const notes = (document.getElementById('customerNotes') || {}).value || '';

      const url = window.PaymentGatewayAdapter.generateWhatsAppUrl({
        customer: {
          fullName,
          phone,
          district,
          city: 'Ankara',
          address,
          orderNotes: notes
        },
        items: state.items,
        subtotal: state.subtotal,
        shippingFee: state.shipping,
        grandTotal: state.total,
        paymentMethod: this.selectedMethod
      });

      waBtn.href = url;
    }

    /**
     * Kredi Kartı Form Alanları Otomatik Boşluk ve Formatlama
     */
    initCardInputFormatters() {
      const ccNumber = document.getElementById('ccNumber');
      const ccExpiry = document.getElementById('ccExpiry');
      const ccCvc = document.getElementById('ccCvc');
      const ccHolder = document.getElementById('ccHolder');

      // 1. Kart Numarası Otomatik Boşluk ve Marka Tespiti
      if (ccNumber) {
        ccNumber.addEventListener('input', (e) => {
          let val = e.target.value.replace(/\D/g, '').slice(0, 16);
          let formatted = val.replace(/(\d{4})/g, '$1 ').trim();
          e.target.value = formatted;

          // Kart Önizlemesini Güncelle
          const previewNum = document.getElementById('previewCardNumber');
          if (previewNum) {
            previewNum.textContent = formatted || '•••• •••• •••• ••••';
          }

          // Marka İkonu Tespiti
          const brandIcon = document.getElementById('cardBrandIcon');
          const previewBrand = document.getElementById('previewCardBrand');
          let brandText = 'Troy / Visa / MC';

          if (/^4/.test(val)) {
            brandText = 'VISA';
            if (brandIcon) brandIcon.className = 'fab fa-cc-visa text-visa';
          } else if (/^(5[1-5]|2[2-7])/.test(val)) {
            brandText = 'Mastercard';
            if (brandIcon) brandIcon.className = 'fab fa-cc-mastercard text-mc';
          } else if (/^9792/.test(val)) {
            brandText = 'TROY';
            if (brandIcon) brandIcon.className = 'fas fa-credit-card text-troy';
          } else {
            if (brandIcon) brandIcon.className = 'far fa-credit-card';
          }

          if (previewBrand) previewBrand.textContent = brandText;
        });
      }

      // 2. Kart Sahibi
      if (ccHolder) {
        ccHolder.addEventListener('input', (e) => {
          const val = e.target.value.toLocaleUpperCase('tr-TR');
          e.target.value = val;
          const previewHolder = document.getElementById('previewCardHolder');
          if (previewHolder) {
            previewHolder.textContent = val || 'AD SOYAD';
          }
        });
      }

      // 3. Son Kullanma Tarihi Formatlama (AA/YY)
      if (ccExpiry) {
        ccExpiry.addEventListener('input', (e) => {
          let val = e.target.value.replace(/\D/g, '').slice(0, 4);
          if (val.length >= 3) {
            val = `${val.slice(0, 2)}/${val.slice(2, 4)}`;
          }
          e.target.value = val;

          const previewExp = document.getElementById('previewCardExpiry');
          if (previewExp) {
            previewExp.textContent = val || 'AA/YY';
          }
        });
      }

      // 4. CVC Sadece Sayı
      if (ccCvc) {
        ccCvc.addEventListener('input', (e) => {
          e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
        });
      }
    }

    /**
     * Müşteri ve Teslimat Formu Doğrulama
     */
    validateForm() {
      const form = document.getElementById('checkoutForm');
      if (!form) return false;

      let isValid = true;
      const requiredInputs = form.querySelectorAll('input[required], textarea[required], select[required]');

      requiredInputs.forEach(input => {
        let fieldValid = true;

        if (!input.value || !input.value.trim()) {
          fieldValid = false;
        } else if (input.id === 'customerFullName' && input.value.trim().length < 3) {
          fieldValid = false;
        } else if (input.id === 'customerPhone') {
          const cleanPhone = input.value.replace(/\D/g, '');
          if (!cleanPhone.startsWith('05') && !cleanPhone.startsWith('5')) {
            fieldValid = false;
          }
          if (cleanPhone.length < 10 || cleanPhone.length > 11) {
            fieldValid = false;
          }
        } else if (input.id === 'customerAddress' && input.value.trim().length < 8) {
          fieldValid = false;
        } else if (input.type === 'checkbox' && !input.checked) {
          fieldValid = false;
        }

        if (!fieldValid || !input.checkValidity()) {
          input.classList.add('is-invalid');
          isValid = false;
        } else {
          input.classList.remove('is-invalid');
        }
      });

      // Eğer Kredi Kartı seçiliyse ve form alanları doldurulmuşsa kart alanlarını da denetle
      if (isValid && this.selectedMethod === 'credit_card' && window.PaymentGatewayAdapter) {
        const ccNum = document.getElementById('ccNumber');
        const ccExp = document.getElementById('ccExpiry');
        const ccCvc = document.getElementById('ccCvc');
        const ccHolder = document.getElementById('ccHolder');

        if (ccNum && ccExp && ccCvc) {
          const cardValidation = window.PaymentGatewayAdapter.validateCard({
            number: ccNum.value,
            expiry: ccExp.value,
            cvc: ccCvc.value,
            holder: ccHolder ? ccHolder.value : ''
          });

          if (!cardValidation.valid) {
            isValid = false;
            const errBox = document.getElementById('ccErrorsBox');
            if (errBox) {
              errBox.textContent = cardValidation.errors.join(' ');
              errBox.style.display = 'block';
            }
            if (ccNum) ccNum.classList.add('is-invalid');
          } else {
            const errBox = document.getElementById('ccErrorsBox');
            if (errBox) errBox.style.display = 'none';
          }
        }
      }

      return isValid;
    }

    /**
     * Sipariş Gönderimi (Submit)
     */
    async handleSubmit(e) {
      if (e) e.preventDefault();

      if (this.isSubmitting) return;

      const isValid = this.validateForm();
      if (!isValid) {
        // İlk hatalı alana odaklan
        const firstInvalid = document.querySelector('#checkoutModal .is-invalid');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      // WhatsApp yöntemi seçilmişse doğrudan WhatsApp'a yönlendir
      if (this.selectedMethod === 'whatsapp') {
        this.updateWhatsAppOrderLink();
        const waBtn = document.getElementById('whatsappOrderBtn');
        if (waBtn) {
          window.open(waBtn.href, '_blank');
        }
        this.completeOrderProcess('whatsapp');
        return;
      }

      // Butonu yükleniyor durumuna al
      const submitBtn = document.getElementById('btnCompleteOrder') || document.getElementById('checkoutSubmitBtn');
      const originalText = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        this.isSubmitting = true;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Sipariş İşleniyor...';
      }

      try {
        const state = window.CartManager.getState();
        const orderId = `ATL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

        const orderPayload = {
          orderId,
          createdAt: new Date().toISOString(),
          customer: {
            fullName: document.getElementById('customerFullName').value.trim(),
            phone: document.getElementById('customerPhone').value.trim(),
            city: (document.getElementById('customerCity') || {}).value || 'Ankara',
            district: document.getElementById('customerDistrict').value,
            address: document.getElementById('customerAddress').value.trim(),
            orderNotes: (document.getElementById('customerNotes') || {}).value || ''
          },
          items: state.items,
          subtotal: state.subtotal,
          shippingFee: state.shipping,
          grandTotal: state.total,
          paymentMethod: this.selectedMethod,
          installments: this.selectedInstallment,
          status: 'confirmed'
        };

        if (this.selectedMethod === 'credit_card' && window.PaymentGatewayAdapter) {
          const cardData = {
            number: (document.getElementById('ccNumber') || {}).value || '',
            expiry: (document.getElementById('ccExpiry') || {}).value || '',
            cvc: (document.getElementById('ccCvc') || {}).value || '',
            holder: (document.getElementById('ccHolder') || {}).value || ''
          };
          await window.PaymentGatewayAdapter.processPayment(orderPayload, cardData);
        } else {
          // Kısa simülasyon gecikmesi
          await new Promise(r => setTimeout(r, 600));
        }

        this.completeOrderProcess(this.selectedMethod, orderPayload);
      } catch (err) {
        console.error('Sipariş tamamlama hatası:', err);
        alert('Sipariş işlenirken bir sorun oluştu. Lütfen tekrar deneyiniz.');
      } finally {
        this.isSubmitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      }
    }

    /**
     * Sipariş Başarıyla Tamamlandığında
     */
    completeOrderProcess(method, payload) {
      const orderPayload = payload || {
        orderId: `ATL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
        createdAt: new Date().toISOString(),
        customer: {
          fullName: (document.getElementById('customerFullName') || {}).value || 'Değerli Müşterimiz',
          phone: (document.getElementById('customerPhone') || {}).value || '0536 352 74 16',
          district: (document.getElementById('customerDistrict') || {}).value || 'Altındağ',
          address: (document.getElementById('customerAddress') || {}).value || 'Aydınlıkevler / Ankara'
        },
        items: window.CartManager ? window.CartManager.getState().items : [],
        grandTotal: window.CartManager ? window.CartManager.getState().total : 0,
        paymentMethod: method
      };

      // 1. Siparişi localStorage'a kaydet
      try {
        const past = JSON.parse(localStorage.getItem('atli_medikal_orders') || '[]');
        past.unshift(orderPayload);
        localStorage.setItem('atli_medikal_orders', JSON.stringify(past));
      } catch (e) {
        // ignore
      }

      // Google Analytics 4 (GA4) purchase Event
      try {
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'purchase', {
            transaction_id: orderPayload.orderId,
            value: Number(orderPayload.grandTotal),
            currency: 'TRY',
            payment_type: method,
            items: (orderPayload.items || []).map(i => ({
              item_id: String(i.id || i.sku || ''),
              item_name: String(i.title || ''),
              price: Number(i.price) || 0,
              quantity: Number(i.quantity) || 1
            }))
          });
        }
      } catch (gaErr) {}

      // 2. Sepeti boşalt
      if (window.CartManager) {
        window.CartManager.clearCart();
      }

      // 3. Checkout Modalı Kapat
      this.closeModal();

      // 4. Sipariş Başarılı Onay Modalını Göster
      this.showSuccessModal(orderPayload);
    }

    /**
     * Başarı Modalı (#orderSuccessModal) Gösterimi
     */
    showSuccessModal(order) {
      const successModal = document.getElementById('orderSuccessModal');
      const successBackdrop = document.getElementById('orderSuccessBackdrop');
      if (!successModal) return;

      const codeEl = document.getElementById('successOrderCode');
      if (codeEl) codeEl.textContent = order.orderId;

      const nameEl = document.getElementById('successCustomerName');
      if (nameEl) nameEl.textContent = order.customer.fullName;

      const totalEl = document.getElementById('successTotalAmount');
      if (totalEl) totalEl.textContent = `${Number(order.grandTotal).toLocaleString('tr-TR')} ₺`;

      const methodNames = {
        credit_card: 'Kredi Kartı (3D Secure Onaylandı)',
        havale: 'Banka Havalesi / EFT (Ödeme Bekleniyor)',
        doorstep: 'Ankara İçi Kapıda / Kurulumda Ödeme',
        whatsapp: 'WhatsApp Destek Hattı Teyitli'
      };
      const methodEl = document.getElementById('successPaymentMethod');
      if (methodEl) methodEl.textContent = methodNames[order.paymentMethod] || 'Belirtilmedi';

      // WhatsApp Onay Linki
      const waLink = document.getElementById('successWaConfirmBtn');
      if (waLink && window.PaymentGatewayAdapter) {
        waLink.href = window.PaymentGatewayAdapter.generateWhatsAppUrl(order);
      }

      successModal.classList.add('show', 'is-open');
      successModal.setAttribute('aria-hidden', 'false');

      if (successBackdrop) {
        successBackdrop.classList.add('show', 'is-open');
        successBackdrop.setAttribute('aria-hidden', 'false');
      }

      document.body.classList.add('modal-open');
      document.body.style.overflow = 'hidden';
    }

    /**
     * Olay Dinleyicileri
     */
    bindEvents() {
      // 1. Ödeme Metodu Sekme Değişimi
      document.addEventListener('click', (e) => {
        const tab = e.target.closest('.payment-method-tab');
        if (tab) {
          e.preventDefault();
          const method = tab.getAttribute('data-method') || (tab.querySelector('input') && tab.querySelector('input').value);
          if (method) this.switchPaymentMethod(method);
          return;
        }

        const radio = e.target.closest('input[name="paymentMethod"]');
        if (radio) {
          this.switchPaymentMethod(radio.value);
          return;
        }

        // Taksit Seçimi Değişimi
        const instRadio = e.target.closest('input[name="cardInstallment"]');
        if (instRadio) {
          this.selectedInstallment = parseInt(instRadio.value, 10) || 1;
          document.querySelectorAll('.installment-row').forEach(row => {
            const hasChecked = row.querySelector('input:checked');
            row.classList.toggle('selected', !!hasChecked);
          });
          return;
        }

        // IBAN Kopyalama Butonları
        const copyBtn = e.target.closest('.btn-copy-iban');
        if (copyBtn) {
          e.preventDefault();
          const iban = copyBtn.getAttribute('data-iban') || copyBtn.closest('.iban-card').querySelector('.iban-code').textContent.trim();
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(iban.replace(/\s+/g, ''));
          } else {
            const ta = document.createElement('textarea');
            ta.value = iban.replace(/\s+/g, '');
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          const origHtml = copyBtn.innerHTML;
          copyBtn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Kopyalandı!';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.innerHTML = origHtml;
            copyBtn.classList.remove('copied');
          }, 2000);
          return;
        }

        // Checkout Modalı Kapat Butonları
        const closeBtn = e.target.closest('#checkoutCloseBtn, .checkout-close-btn');
        if (closeBtn) {
          e.preventDefault();
          this.closeModal();
          return;
        }

        // Checkout Backdrop Tıklaması
        const backdrop = e.target.closest('#checkoutBackdrop');
        if (backdrop) {
          e.preventDefault();
          this.closeModal();
          return;
        }

        // Başarı Modalı Kapatma
        const successClose = e.target.closest('#orderSuccessCloseBtn, #btnContinueShopping');
        if (successClose) {
          e.preventDefault();
          const sm = document.getElementById('orderSuccessModal');
          const sb = document.getElementById('orderSuccessBackdrop');
          if (sm) sm.classList.remove('show', 'is-open');
          if (sb) sb.classList.remove('show', 'is-open');
          document.body.classList.remove('modal-open');
          document.body.style.overflow = '';
          return;
        }
      });

      // 2. Form Gönderimi (Submit)
      const form = document.getElementById('checkoutForm');
      if (form) {
        form.addEventListener('submit', (e) => this.handleSubmit(e));
      }

      const submitBtn = document.getElementById('btnCompleteOrder') || document.getElementById('checkoutSubmitBtn');
      if (submitBtn) {
        submitBtn.addEventListener('click', (e) => {
          if (form) {
            // Eğer form buton tip submit ise zaten tetiklenir, değilse doğrudan handleSubmit çağır
            if (submitBtn.type !== 'submit') {
              this.handleSubmit(e);
            }
          }
        });
      }

      // 3. Canlı Girişlerde Geçersizlik Sınıfını Kaldırma ve WhatsApp Linki Güncelleme
      document.addEventListener('input', (e) => {
        if (e.target.closest('#checkoutModal')) {
          if (e.target.classList.contains('is-invalid')) {
            e.target.classList.remove('is-invalid');
          }
          this.updateWhatsAppOrderLink();
        }
      });

      // 4. Klavye Escape İle Kapatma
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const modal = document.getElementById('checkoutModal');
          if (modal && modal.classList.contains('show')) {
            this.closeModal();
          }
        }
      });
    }
  }

  const instance = new CheckoutManager();
  window.CheckoutManager = instance;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => instance.init());
  } else {
    instance.init();
  }
})(window);
