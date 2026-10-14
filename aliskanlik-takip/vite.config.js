// Bu dosya Vite'ın nasıl çalışacağını yapılandırır
import { defineConfig } from 'vite'      // Vite'ın temel yapılandırma fonksiyonunu içe aktarıyoruz
import react from '@vitejs/plugin-react'  // React desteği için Vite eklentisini içe aktarıyoruz
import tailwindcss from '@tailwindcss/vite' // Tailwind CSS'i Vite üzerinden eklemek için eklentiyi alıyoruz

export default defineConfig({
  plugins: [
    react(),       // React JSX dönüşümünü aktif hale getirir
    tailwindcss(), // Tailwind CSS sınıflarını otomatik üretir
  ],
})
