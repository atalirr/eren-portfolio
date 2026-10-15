/**
 * Python Process Lifecycle Manager
 * Python sunucusunu başlatır ve kapatır
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const config = require('./config');

let pythonProcess = null;

/**
 * Python process'i başlatır
 * @param {number} port - Python sunucusunun dinleyeceği port
 * @returns {Promise<void>}
 */
async function startPythonServer(port) {
  return new Promise((resolve, reject) => {
    if (pythonProcess) {
      console.warn('⚠️  Python process zaten çalışıyor');
      return resolve();
    }

    const isDevelopment = config.isDevelopment;
    const isWindows = os.platform() === 'win32';

    let pythonCommand;
    let pythonArgs;

    if (isDevelopment) {
      // Development: python main.py veya venv/python.exe
      const backendPath = path.join(__dirname, '..', 'backend');
      const venvPythonPath = path.join(backendPath, 'venv', isWindows ? 'Scripts' : 'bin', isWindows ? 'python.exe' : 'python');
      const venvExists = require('fs').existsSync(venvPythonPath);
      
      if (venvExists) {
        pythonCommand = venvPythonPath;
        console.log(`✅ Venv bulundu, kullanılıyor: ${pythonCommand}`);
      } else {
        pythonCommand = isWindows ? 'python' : 'python3';
        console.log(`⚠️  Venv bulunamadı, sistem Python kullanılıyor: ${pythonCommand}`);
      }
      
      pythonArgs = ['main.py', '--port', port.toString(), '--host', '127.0.0.1', '--reload'];
      
      console.log(`🚀 Python sunucusu başlatılıyor (DEV): ${pythonCommand} ${pythonArgs.join(' ')}`);
      console.log(`📂 Working directory: ${backendPath}`);
      
      // Diagnostic log
      const diagLog = path.join(backendPath, 'electron_spawn_debug.log');
      fs.appendFileSync(diagLog, `[${new Date().toISOString()}] Spawning: ${pythonCommand} with args ${pythonArgs.join(' ')}\n`);

      pythonProcess = spawn(pythonCommand, pythonArgs, {
        cwd: backendPath,
        stdio: ['ignore', 'pipe', 'pipe'], // stdout ve stderr'i pipe'layalım
        shell: false, // shell: false, çünkü doğrudan python.exe yolunu kullanıyoruz
        env: { ...process.env, PYTHONUNBUFFERED: '1' }, // Python output'u buffer'lamasın
      });
    } else {
      // Production: Derlenmiş binary
      const binaryName = isWindows ? 'pos6-backend.exe' : 'pos6-backend';
      let binaryPath = path.join(process.resourcesPath, 'backend', 'dist', binaryName);
      
      // Eğer tek dosya (onefile) olarak derlenmemişse, klasör içindekini (onedir) dene
      if (!fs.existsSync(binaryPath)) {
        const altPath = path.join(process.resourcesPath, 'backend', 'dist', 'pos6-backend', binaryName);
        if (fs.existsSync(altPath)) {
          binaryPath = altPath;
        }
      }
      
      pythonArgs = ['--port', port.toString(), '--host', '127.0.0.1'];

      console.log(`🚀 Python sunucusu başlatılıyor (PROD): ${binaryPath}`);
      pythonProcess = spawn(binaryPath, pythonArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true, // Windows'ta arka plan konsol penceresini gizle
      });
    }

    // Log dosyası ayarla
    const logPath = path.join(os.homedir(), '.pos6', 'backend_full.log');
    const logDir = path.dirname(logPath);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });

    // Stdout logları
    let stdoutBuffer = '';
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdoutBuffer += output;
      logStream.write(`[STDOUT] ${output}`);
      // Her satırı ayrı göster
      const lines = output.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        console.log(`🐍 [Python] ${line.trim()}`);
      });
    });

    // Stderr logları (Python hatalarını göster)
    let stderrBuffer = '';
    pythonProcess.stderr.on('data', (data) => {
      const errorMsg = data.toString();
      stderrBuffer += errorMsg;
      logStream.write(`[STDERR] ${errorMsg}`);
      // Her satırı ayrı göster
      const lines = errorMsg.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        console.error(`🐍 [Python Error] ${line.trim()}`);
      });
    });

    // Process exit
    pythonProcess.on('exit', (code, signal) => {
      console.log(`🐍 Python process sonlandı. Code: ${code}, Signal: ${signal}`);
      if (code !== 0 && code !== null) {
        console.error(`❌ Python process beklenmedik şekilde sonlandı (code: ${code})`);
        console.error('');
        console.error('📋 Son stdout çıktısı:');
        if (stdoutBuffer.trim()) {
          console.error(stdoutBuffer.trim());
        } else {
          console.error('   (stdout boş)');
        }
        console.error('');
        console.error('📋 Son stderr çıktısı:');
        if (stderrBuffer.trim()) {
          console.error(stderrBuffer.trim());
        } else {
          console.error('   (stderr boş)');
        }
        console.error('');
        console.error('🔍 Sorun giderme:');
        console.error('   1. Backend klasöründe: python main.py --port 14533 --host 127.0.0.1');
        console.error('   2. Venv aktif mi? .\\venv\\Scripts\\activate');
        console.error('   3. Bağımlılıklar yüklü mü? pip install -r requirements.txt');
      }
      pythonProcess = null;
    });

    // Process error (process başlatılamadığında)
    pythonProcess.on('error', (error) => {
      console.error('❌ Python process başlatılamadı:', error.message);
      console.error(`   Python komutu: ${pythonCommand}`);
      console.error(`   Backend path: ${backendPath}`);
      console.error('');
      console.error('🔍 Sorun giderme:');
      console.error('   1. Python yüklü mü? Test: python --version');
      console.error('   2. Venv var mı? Test: ls backend/venv');
      console.error('   3. Backend bağımlılıkları yüklü mü? Test: pip install -r backend/requirements.txt');
      pythonProcess = null;
      reject(error);
    });

    // Process başlatıldığında resolve et
    pythonProcess.on('spawn', () => {
      console.log('✅ Python process başlatıldı');
      resolve();
    });

    // Biraz bekle ve resolve et (spawn event bazen çalışmayabilir)
    setTimeout(() => {
      if (pythonProcess && !pythonProcess.killed) {
        console.log('✅ Python process başlatıldı (timeout fallback)');
        resolve();
      } else {
        console.error('❌ Python process başlatılamadı (timeout)');
        reject(new Error('Python process başlatılamadı'));
      }
    }, 2000);
  });
}

/**
 * Python process'i graceful şekilde sonlandırır
 * @returns {Promise<void>}
 */
async function stopPythonServer() {
  return new Promise((resolve) => {
    if (!pythonProcess) {
      console.log('ℹ️  Python process zaten durmuş');
      return resolve();
    }

    console.log('🛑 Python sunucusu kapatılıyor...');

    // SIGTERM ile graceful shutdown
    pythonProcess.kill('SIGTERM');

    // 5 saniye içinde kapanmazsa SIGKILL ile zorla kapat
    const timeout = setTimeout(() => {
      if (pythonProcess && !pythonProcess.killed) {
        console.warn('⚠️  Python process zaman aşımına uğradı, zorla kapatılıyor...');
        pythonProcess.kill('SIGKILL');
      }
    }, 5000);

    pythonProcess.on('exit', () => {
      clearTimeout(timeout);
      pythonProcess = null;
      console.log('✅ Python sunucusu kapatıldı');
      resolve();
    });

    // Process zaten kapandıysa
    if (pythonProcess.killed) {
      clearTimeout(timeout);
      pythonProcess = null;
      resolve();
    }
  });
}

/**
 * Python process'inin çalışıp çalışmadığını kontrol eder
 * @returns {boolean}
 */
function isPythonRunning() {
  return pythonProcess !== null && !pythonProcess.killed;
}

module.exports = {
  startPythonServer,
  stopPythonServer,
  isPythonRunning,
};


