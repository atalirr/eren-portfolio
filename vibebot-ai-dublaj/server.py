import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
import http.server
import json
import os
import subprocess
import sys
import threading
import time
import urllib.parse
from datetime import datetime

PORT = 8092
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

JOBS_LOCK = threading.Lock()

STAGES = [
    {"id": 1, "key": "download", "name": "Video İndirme", "tool": "yt-dlp", "desc": "MP4 720p akışı çekiliyor"},
    {"id": 2, "key": "demux", "name": "Ses Ayıklama", "tool": "FFmpeg Demux", "desc": "Ses kanalı MP3 olarak ayrıştırılıyor"},
    {"id": 3, "key": "stt", "name": "Konuşma Tanıma", "tool": "OpenAI Whisper", "desc": "Ses zaman damgalı metne dökülüyor"},
    {"id": 4, "key": "translate", "name": "Nöral Çeviri", "tool": "GoogleTranslator", "desc": " Bağlamsal Türkçe lokalizasyon"},
    {"id": 5, "key": "tts", "name": "Türkçe Seslendirme", "tool": "Edge-TTS Neural", "desc": "Nöral ses sentezi üretiliyor"},
    {"id": 6, "key": "mux", "name": "Video Birleştirme", "tool": "FFmpeg Mux", "desc": "Yeni ses kanalı videoya gömülüyor"}
]

JOBS = [
    {
        "id": "job-101",
        "title": "Andrej Karpathy — Intro to Large Language Models (Özet Kesit)",
        "url": "https://www.youtube.com/watch?v=zjkBMFhNj_g",
        "mode": "demo",
        "status": "completed",
        "currentStage": 6,
        "progress": 100,
        "voice": "tr-TR-AhmetNeural",
        "whisperModel": "small",
        "sourceLang": "en",
        "targetLang": "tr",
        "duration": "04:18",
        "createdAt": "14:20:10",
        "outputFile": os.path.join(BASE_DIR, "hazir_video_llm.mp4"),
        "transcriptEn": (
            "Large Language Models are essentially two files on a disk: a parameters file and a run file. "
            "To train them, we take a massive chunk of the internet and compress it into neural network weights. "
            "This process is lossy compression, where the model learns world knowledge to predict the next token accurately."
        ),
        "translationTr": (
            "Büyük Dil Modelleri temelde disk üzerindeki iki dosyadan ibarettir: bir parametre dosyası ve bir çalıştırma dosyası. "
            "Onları eğitmek için internetin devasa bir bölümünü alır ve sinir ağı ağırlıklarına sıkıştırırız. "
            "Bu süreç kayıplı bir sıkıştırmadır; model bir sonraki kelimeyi doğru tahmin etmek için dünya bilgisini öğrenir."
        ),
        "logs": [
            "[14:20:10] ISLEM_BASLIYOR: https://www.youtube.com/watch?v=zjkBMFhNj_g",
            "[14:20:12] DURUM: Video indiriliyor... (yt-dlp format: best[ext=mp4][height<=720])",
            "[14:20:18] DURUM: Ses ayiklaniyor... (ffmpeg -vn -acodec libmp3lame gecici_ses.mp3)",
            "[14:20:22] DURUM: Yapay zeka dinliyor (Whisper model=small)...",
            "[14:20:35] DURUM: Cevriliyor... (GoogleTranslator auto -> tr, 1 parça)",
            "[14:20:38] DURUM: Turkce dublaj yapiliyor... (Edge-TTS voice=tr-TR-AhmetNeural)",
            "[14:20:44] DURUM: Video birlestiriliyor... (ffmpeg -c:v copy -c:a aac hazir_video_llm.mp4)",
            f"[14:20:47] DOSYA_YOLU:{os.path.join(BASE_DIR, 'hazir_video_llm.mp4')}"
        ]
    },
    {
        "id": "job-102",
        "title": "Fireship — Python in 100 Seconds (Türkçe Lokalizasyon)",
        "url": "https://www.youtube.com/watch?v=x7X9w_GIm1s",
        "mode": "demo",
        "status": "completed",
        "currentStage": 6,
        "progress": 100,
        "voice": "tr-TR-EmelNeural",
        "whisperModel": "base",
        "sourceLang": "en",
        "targetLang": "tr",
        "duration": "01:46",
        "createdAt": "14:45:02",
        "outputFile": os.path.join(BASE_DIR, "hazir_video_python100s.mp4"),
        "transcriptEn": (
            "Python: a high-level, interpreted programming language famous for its zen-like code readability. "
            "Created by Guido van Rossum in 1991, it has grown to become the primary language for machine learning, "
            "data science, and backend automation across the globe."
        ),
        "translationTr": (
            "Python: zen benzeri kod okunabilirliğiyle ünlü, yüksek seviyeli ve yorumlanan bir programlama dilidir. "
            "1991 yılında Guido van Rossum tarafından geliştirilen bu dil, dünya genelinde makine öğrenimi, "
            "veri bilimi ve arka uç otomasyonu için birincil dil haline gelmiştir."
        ),
        "logs": [
            "[14:45:02] ISLEM_BASLIYOR: https://www.youtube.com/watch?v=x7X9w_GIm1s",
            "[14:45:04] DURUM: Video indiriliyor... (100s HD stream)",
            "[14:45:07] DURUM: Ses ayiklaniyor... (gecici_ses.mp3)",
            "[14:45:11] DURUM: Yapay zeka dinliyor (Whisper model=base)...",
            "[14:45:15] DURUM: Cevriliyor... (GoogleTranslator en -> tr)",
            "[14:45:18] DURUM: Turkce dublaj yapiliyor... (Edge-TTS voice=tr-TR-EmelNeural)",
            "[14:45:22] DURUM: Video birlestiriliyor...",
            f"[14:45:24] DOSYA_YOLU:{os.path.join(BASE_DIR, 'hazir_video_python100s.mp4')}"
        ]
    },
    {
        "id": "job-103",
        "title": "3Blue1Brown — But what is a Neural Network? (Bölüm 1)",
        "url": "https://www.youtube.com/watch?v=aircAruvnKk",
        "mode": "demo",
        "status": "completed",
        "currentStage": 6,
        "progress": 100,
        "voice": "tr-TR-AhmetNeural",
        "whisperModel": "medium",
        "sourceLang": "en",
        "targetLang": "tr",
        "duration": "06:12",
        "createdAt": "15:05:30",
        "outputFile": os.path.join(BASE_DIR, "hazir_video_3b1b.mp4"),
        "transcriptEn": (
            "When you see a handwritten digit like the number three, your visual cortex effortlessly recognizes it "
            "despite variations in lighting, stroke thickness, and orientation. A neural network mimics this by connecting "
            "layers of activation neurons weighted by learned parameters."
        ),
        "translationTr": (
            "Üç rakamı gibi el yazısıyla yazılmış bir rakam gördüğünüzde, görsel korteksiniz ışıklandırma, çizgi kalınlığı "
            "ve yönelim farklılıklarına rağmen onu zahmetsizce tanır. Bir yapay sinir ağı, öğrenilmiş parametrelerle "
            "ağırlıklandırılmış aktivasyon nöron katmanlarını birbirine bağlayarak bunu taklit eder."
        ),
        "logs": [
            "[15:05:30] ISLEM_BASLIYOR: https://www.youtube.com/watch?v=aircAruvnKk",
            "[15:05:34] DURUM: Video indiriliyor...",
            "[15:05:39] DURUM: Ses ayiklaniyor...",
            "[15:05:45] DURUM: Yapay zeka dinliyor (Whisper model=medium)...",
            "[15:05:54] DURUM: Cevriliyor...",
            "[15:05:58] DURUM: Turkce dublaj yapiliyor... (Edge-TTS voice=tr-TR-AhmetNeural)",
            "[15:06:03] DURUM: Video birlestiriliyor...",
            f"[15:06:06] DOSYA_YOLU:{os.path.join(BASE_DIR, 'hazir_video_3b1b.mp4')}"
        ]
    }
]


def now_str():
    return datetime.now().strftime("%H:%M:%S")


def append_log(job, message):
    with JOBS_LOCK:
        job["logs"].append(f"[{now_str()}] {message}")


def run_demo_pipeline(job):
    """Simulates the 6-stage dublaj_yap.py pipeline for rapid interactive studio testing."""
    url = job["url"]
    voice = job["voice"]
    whisper_model = job["whisperModel"]

    sample_en = (
        f"Welcome to this technical overview extracted from {url}. "
        "Modern artificial intelligence pipelines combine automatic speech recognition, neural machine translation, "
        "and expressive text-to-speech synthesis to break language barriers in seconds."
    )
    sample_tr = (
        f"{url} kaynağından alınan bu teknik genel bakışa hoş geldiniz. "
        "Modern yapay zeka iş akışları; otomatik konuşma tanıma, nöral makine çevirisi "
        "ve doğal metin seslendirme teknolojilerini birleştirerek dil bariyerlerini saniyeler içinde aşar."
    )

    steps = [
        (1, 16, f"ISLEM_BASLIYOR: {url}"),
        (1, 22, "DURUM: Video indiriliyor... (yt-dlp format: best[ext=mp4][height<=720])"),
        (2, 38, "DURUM: Ses ayiklaniyor... (ffmpeg -y -i ham_video.mp4 -vn -acodec libmp3lame gecici_ses.mp3)"),
        (3, 56, f"DURUM: Yapay zeka dinliyor (Whisper model={whisper_model})..."),
        (4, 74, f"DURUM: Cevriliyor... (GoogleTranslator {job['sourceLang']} -> {job['targetLang']})"),
        (5, 90, f"DURUM: Turkce dublaj yapiliyor... (Edge-TTS voice={voice})"),
        (6, 98, "DURUM: Video birlestiriliyor... (ffmpeg -c:v copy -c:a aac hazir_video.mp4)"),
    ]

    for stage, prog, log_msg in steps:
        time.sleep(0.9)
        with JOBS_LOCK:
            job["currentStage"] = stage
            job["progress"] = prog
            if stage == 3:
                job["transcriptEn"] = sample_en
            elif stage == 4:
                job["translationTr"] = sample_tr
        append_log(job, log_msg)

    time.sleep(0.8)
    out_path = os.path.join(BASE_DIR, "hazir_video.mp4")
    with JOBS_LOCK:
        job["currentStage"] = 6
        job["progress"] = 100
        job["status"] = "completed"
        job["outputFile"] = out_path
    append_log(job, f"DOSYA_YOLU:{out_path}")


def run_live_pipeline(job):
    """Runs python dublaj_yap.py <url> as a real subprocess and tracks its stages."""
    url = job["url"]
    script_path = os.path.join(BASE_DIR, "dublaj_yap.py")
    append_log(job, f"Canlı alt süreç başlatılıyor: python dublaj_yap.py {url}")

    try:
        proc = subprocess.Popen(
            [sys.executable, "-u", script_path, url],
            cwd=BASE_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace"
        )

        for raw_line in proc.stdout:
            line = raw_line.strip()
            if not line:
                continue
            append_log(job, line)

            with JOBS_LOCK:
                if "Video indiriliyor" in line:
                    job["currentStage"] = 1
                    job["progress"] = 18
                elif "Ses ayiklaniyor" in line:
                    job["currentStage"] = 2
                    job["progress"] = 35
                elif "Yapay zeka dinliyor" in line:
                    job["currentStage"] = 3
                    job["progress"] = 55
                elif "Cevriliyor" in line:
                    job["currentStage"] = 4
                    job["progress"] = 72
                elif "Turkce dublaj yapiliyor" in line:
                    job["currentStage"] = 5
                    job["progress"] = 88
                elif "Video birlestiriliyor" in line:
                    job["currentStage"] = 6
                    job["progress"] = 95
                elif line.startswith("DOSYA_YOLU:"):
                    out_file = line.split("DOSYA_YOLU:", 1)[1].strip()
                    job["outputFile"] = out_file
                    job["currentStage"] = 6
                    job["progress"] = 100
                    job["status"] = "completed"
                    if not job["transcriptEn"]:
                        job["transcriptEn"] = "(Canlı Whisper transkripsiyonu tamamlandı — gecici_ses.mp3 işlendi)"
                    if not job["translationTr"]:
                        job["translationTr"] = "(Canlı Türkçe dublaj tamamlandı — gecici_dublaj.mp3 oluşturuldu)"
                elif line.startswith("HATA_OLUSTU:") or line.startswith("HATA:"):
                    job["status"] = "failed"

        proc.wait()
        with JOBS_LOCK:
            if job["status"] == "running":
                if proc.returncode == 0 and job["progress"] >= 95:
                    job["status"] = "completed"
                    job["progress"] = 100
                else:
                    job["status"] = "failed"
                    append_log(job, f"Süreç çıkış kodu: {proc.returncode}")
    except Exception as exc:
        with JOBS_LOCK:
            job["status"] = "failed"
        append_log(job, f"HATA_OLUSTU: {exc}")


class VibeBotHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path in ("/", "/index.html", "/dashboard.html"):
            html_path = os.path.join(BASE_DIR, "dashboard.html")
            if not os.path.exists(html_path):
                self._send_json({"error": "dashboard.html bulunamadı"}, 404)
                return
            with open(html_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return

        if path == "/api/jobs":
            with JOBS_LOCK:
                jobs_copy = list(JOBS)
            self._send_json({
                "stages": STAGES,
                "jobs": jobs_copy,
                "scriptPath": os.path.join(BASE_DIR, "dublaj_yap.py")
            })
            return

        if path.startswith("/media/"):
            filename = os.path.basename(path[len("/media/"):])
            file_path = os.path.join(BASE_DIR, filename)
            if os.path.exists(file_path) and os.path.isfile(file_path):
                ctype = "audio/mpeg" if filename.endswith(".mp3") else "video/mp4"
                with open(file_path, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            self._send_json({"error": "Medya dosyası bulunamadı"}, 404)
            return

        self._send_json({"error": "Bulunamadı"}, 404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/dub":
            payload = self._read_json()
            url = (payload.get("url") or "").strip()
            if not url:
                self._send_json({"error": "Lütfen geçerli bir video URL'si girin."}, 400)
                return

            mode = payload.get("mode", "demo")
            voice = payload.get("voice", "tr-TR-AhmetNeural")
            whisper_model = payload.get("whisperModel", "base")
            source_lang = payload.get("sourceLang", "auto")
            target_lang = payload.get("targetLang", "tr")
            title = (payload.get("title") or "").strip()
            if not title:
                title = f"Dublaj Projesi ({url[:42]}...)" if len(url) > 42 else f"Dublaj Projesi ({url})"

            job_id = f"job-{int(time.time() * 1000) % 1000000}"
            new_job = {
                "id": job_id,
                "title": title,
                "url": url,
                "mode": mode,
                "status": "running",
                "currentStage": 1,
                "progress": 5,
                "voice": voice,
                "whisperModel": whisper_model,
                "sourceLang": source_lang,
                "targetLang": target_lang,
                "duration": "03:24" if mode == "demo" else "Canlı",
                "createdAt": now_str(),
                "outputFile": os.path.join(BASE_DIR, "hazir_video.mp4"),
                "transcriptEn": "Whisper STT bekleniyor...",
                "translationTr": "Nöral çeviri bekleniyor...",
                "logs": [f"[{now_str()}] Kuyruğa eklendi ({'Stüdyo Simülasyonu' if mode == 'demo' else 'Gerçek Alt Süreç'}): {url}"]
            }

            with JOBS_LOCK:
                JOBS.insert(0, new_job)

            target_fn = run_demo_pipeline if mode == "demo" else run_live_pipeline
            t = threading.Thread(target=target_fn, args=(new_job,), daemon=True)
            t.start()

            self._send_json({"ok": True, "job": new_job})
            return

        if path == "/api/jobs/update":
            payload = self._read_json()
            job_id = payload.get("id")
            transcript_en = payload.get("transcriptEn")
            translation_tr = payload.get("translationTr")

            with JOBS_LOCK:
                for job in JOBS:
                    if job["id"] == job_id:
                        if transcript_en is not None:
                            job["transcriptEn"] = transcript_en
                        if translation_tr is not None:
                            job["translationTr"] = translation_tr
                        job["logs"].append(f"[{now_str()}] DÜZENLEME: Transkript / Türkçe çeviri metni stüdyo editöründen güncellendi.")
                        self._send_json({"ok": True, "job": job})
                        return

            self._send_json({"error": "İş bulunamadı"}, 404)
            return

        if path == "/api/tts-preview":
            payload = self._read_json()
            text = (payload.get("text") or "Merhaba, ben VibeBot yapay zeka dublaj stüdyosu nöral ses modeliyim.").strip()
            voice = payload.get("voice", "tr-TR-AhmetNeural")
            preview_filename = f"preview_{voice.replace('-', '_')}.mp3"
            preview_path = os.path.join(BASE_DIR, preview_filename)

            try:
                cmd = [
                    sys.executable, "-c",
                    f"import asyncio, edge_tts; asyncio.run(edge_tts.Communicate({repr(text)}, {repr(voice)}).save({repr(preview_path)}))"
                ]
                res = subprocess.run(cmd, cwd=BASE_DIR, capture_output=True, text=True, timeout=15)
                if res.returncode == 0 and os.path.exists(preview_path):
                    self._send_json({
                        "ok": True,
                        "engine": "edge-tts",
                        "voice": voice,
                        "audioUrl": f"/media/{preview_filename}?t={int(time.time())}",
                        "message": f"{voice} ile gerçek Edge-TTS ses önizlemesi üretildi."
                    })
                    return
                else:
                    self._send_json({
                        "ok": True,
                        "engine": "browser-synth",
                        "voice": voice,
                        "text": text,
                        "message": f"Edge-TTS paketine erişilemedi, tarayıcı Web Speech sentezleyicisi kullanılıyor ({voice})."
                    })
                    return
            except Exception as exc:
                self._send_json({
                    "ok": True,
                    "engine": "browser-synth",
                    "voice": voice,
                    "text": text,
                    "message": f"Tarayıcı ses önizlemesi aktif ({exc})."
                })
                return

        self._send_json({"error": "Bulunamadı"}, 404)


def main():
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), VibeBotHandler)
    print(f"============================================================")
    print(f" VibeBot — AI Video İndirme & Türkçe Dublaj Stüdyosu")
    print(f" Sunucu aktif: http://localhost:{PORT}")
    print(f"============================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nSunucu kapatılıyor...")
        server.server_close()


if __name__ == "__main__":
    main()

