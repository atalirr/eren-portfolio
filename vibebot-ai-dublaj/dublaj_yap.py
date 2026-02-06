import sys
import os
import asyncio
import subprocess
import yt_dlp
import whisper
from deep_translator import GoogleTranslator
import edge_tts

# --- AYARLAR ---
OUTPUT_FILENAME = "hazir_video.mp4"
TEMP_AUDIO = "gecici_ses.mp3"
TEMP_TTS = "gecici_dublaj.mp3"
MAX_DURATION = 900  # 15 Dakika sınırı

async def main():
    try:
        # 1. Linki al
        if len(sys.argv) < 2:
            print("HATA: Link girilmedi!")
            return
        video_url = sys.argv[1]
        print(f"ISLEM_BASLIYOR: {video_url}")

        # 2. Videoyu İndir
        print("DURUM: Video indiriliyor...")
        ydl_opts = {
            'format': 'best[ext=mp4][height<=720]',
            'outtmpl': 'ham_video.%(ext)s',
            'overwrites': True,
            'quiet': True
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])

        # 3. Sesi Ayıkla
        print("DURUM: Ses ayiklaniyor...")
        subprocess.run(['ffmpeg', '-y', '-i', 'ham_video.mp4', '-vn', '-acodec', 'libmp3lame', TEMP_AUDIO], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # 4. Sesi Yazıya Dök (Whisper)
        print("DURUM: Yapay zeka dinliyor (Whisper)...")
        model = whisper.load_model("base")
        result = model.transcribe(TEMP_AUDIO)
        text_en = result["text"]

        # 5. Çeviri Yap
        print("DURUM: Cevriliyor...")
        translator = GoogleTranslator(source='auto', target='tr')
        # Metni parçalara bölüp çeviriyoruz (Google limiti yememek için)
        chunks = [text_en[i:i+4000] for i in range(0, len(text_en), 4000)]
        text_tr = ""
        for chunk in chunks:
            text_tr += translator.translate(chunk) + " "

        # 6. Seslendir (Edge TTS)
        print("DURUM: Turkce dublaj yapiliyor...")
        communicate = edge_tts.Communicate(text_tr, "tr-TR-AhmetNeural")
        await communicate.save(TEMP_TTS)

        # 7. Birleştir (FFmpeg)
        print("DURUM: Video birlestiriliyor...")
        subprocess.run([
            'ffmpeg', '-y', '-i', 'ham_video.mp4', '-i', TEMP_TTS,
            '-c:v', 'copy', '-c:a', 'aac', '-map', '0:v:0', '-map', '1:a:0', '-shortest', OUTPUT_FILENAME
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # 8. Sonucu Bildir (Bu satır n8n için çok önemli)
        final_path = os.path.abspath(OUTPUT_FILENAME)
        print(f"DOSYA_YOLU:{final_path}")

    except Exception as e:
        print(f"HATA_OLUSTU: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())