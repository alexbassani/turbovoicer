# Guia de Implementação Técnica: Sistema de Instalação In-App para Conversão de Voz

Este guia fornece exemplos de código e instruções práticas para implementar um sistema de instalação dinâmica de dependências em um aplicativo desktop de conversão de voz.

## Parte 1: Bootloader em Python

O *bootloader* é o primeiro script executado quando o aplicativo é iniciado. Ele verifica o ambiente, detecta hardware e orquestra o download de dependências.

### 1.1. Script Principal do Bootloader (`bootloader.py`)

```python
import os
import sys
import platform
import subprocess
import json
import shutil
from pathlib import Path
import requests
from tqdm import tqdm

class EnvironmentBootloader:
    def __init__(self):
        self.app_name = "VoiceConverterApp"
        self.app_data_dir = self._get_app_data_dir()
        self.venv_path = self.app_data_dir / "env"
        self.models_dir = self.app_data_dir / "models"
        self.config_file = self.app_data_dir / "config.json"
        
    def _get_app_data_dir(self):
        """Retorna o diretório de dados da aplicação específico do SO."""
        if sys.platform == "win32":
            base = Path(os.getenv("APPDATA"))
        elif sys.platform == "darwin":
            base = Path.home() / "Library" / "Application Support"
        else:  # Linux
            base = Path.home() / ".local" / "share"
        
        app_dir = base / self.app_name
        app_dir.mkdir(parents=True, exist_ok=True)
        return app_dir
    
    def detect_hardware(self):
        """Detecta o hardware disponível (GPU, SO, arquitetura)."""
        hardware_info = {
            "os": sys.platform,
            "architecture": platform.machine(),
            "python_version": platform.python_version(),
            "gpu": self._detect_gpu(),
        }
        return hardware_info
    
    def _detect_gpu(self):
        """Detecta o tipo de GPU disponível."""
        try:
            import torch
            if torch.cuda.is_available():
                return {
                    "type": "nvidia",
                    "device_count": torch.cuda.device_count(),
                    "device_name": torch.cuda.get_device_name(0),
                }
        except ImportError:
            pass
        
        # Verificar DirectML (AMD/Intel no Windows)
        if sys.platform == "win32":
            try:
                import torch_directml
                return {"type": "directml", "available": True}
            except ImportError:
                pass
        
        # Verificar ROCm (AMD no Linux)
        if sys.platform.startswith("linux"):
            if shutil.which("rocm-smi"):
                return {"type": "rocm", "available": True}
        
        return {"type": "cpu", "available": True}
    
    def create_virtual_environment(self):
        """Cria um ambiente virtual portátil."""
        if self.venv_path.exists():
            print(f"Ambiente virtual já existe em {self.venv_path}")
            return True
        
        print(f"Criando ambiente virtual em {self.venv_path}...")
        try:
            subprocess.run(
                [sys.executable, "-m", "venv", str(self.venv_path)],
                check=True,
                capture_output=True,
            )
            print("Ambiente virtual criado com sucesso!")
            return True
        except subprocess.CalledProcessError as e:
            print(f"Erro ao criar ambiente virtual: {e}")
            return False
    
    def get_pip_executable(self):
        """Retorna o caminho para o executável pip do ambiente virtual."""
        if sys.platform == "win32":
            return self.venv_path / "Scripts" / "pip.exe"
        else:
            return self.venv_path / "bin" / "pip"
    
    def install_dependencies(self, hardware_info):
        """Instala as dependências Python necessárias."""
        pip_exe = self.get_pip_executable()
        
        # Determinar a versão correta do PyTorch baseado na GPU
        torch_package = self._get_torch_package(hardware_info["gpu"])
        
        dependencies = [
            "numpy",
            "scipy",
            "librosa",
            "soundfile",
            "tqdm",
            "requests",
            torch_package,
            "onnxruntime",
        ]
        
        print("Instalando dependências Python...")
        for package in dependencies:
            print(f"Instalando {package}...")
            try:
                subprocess.run(
                    [str(pip_exe), "install", package],
                    check=True,
                    capture_output=True,
                )
                print(f"✓ {package} instalado com sucesso")
            except subprocess.CalledProcessError as e:
                print(f"✗ Erro ao instalar {package}: {e}")
                return False
        
        return True
    
    def _get_torch_package(self, gpu_info):
        """Retorna a versão correta do PyTorch baseado na GPU."""
        gpu_type = gpu_info.get("type", "cpu")
        
        if gpu_type == "nvidia":
            return "torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118"
        elif gpu_type == "directml":
            return "torch-directml"
        elif gpu_type == "rocm":
            return "torch torchvision torchaudio --index-url https://download.pytorch.org/whl/rocm5.7"
        else:
            return "torch torchvision torchaudio"
    
    def download_models(self):
        """Baixa os modelos de IA necessários."""
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
        models = {
            "rvc_model": "https://huggingface.co/path/to/rvc/model.pth",
            "seed_vc_model": "https://huggingface.co/path/to/seed_vc/model.pth",
        }
        
        for model_name, model_url in models.items():
            model_path = self.models_dir / f"{model_name}.pth"
            
            if model_path.exists():
                print(f"Modelo {model_name} já existe")
                continue
            
            print(f"Baixando {model_name}...")
            self._download_file(model_url, model_path)
    
    def _download_file(self, url, destination):
        """Baixa um arquivo com barra de progresso."""
        try:
            response = requests.get(url, stream=True)
            response.raise_for_status()
            
            total_size = int(response.headers.get("content-length", 0))
            
            with open(destination, "wb") as f:
                with tqdm(total=total_size, unit="B", unit_scale=True) as pbar:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                        pbar.update(len(chunk))
            
            print(f"✓ {destination.name} baixado com sucesso")
            return True
        except Exception as e:
            print(f"✗ Erro ao baixar {destination.name}: {e}")
            return False
    
    def save_config(self, hardware_info):
        """Salva as informações de configuração para uso posterior."""
        config = {
            "hardware": hardware_info,
            "venv_path": str(self.venv_path),
            "models_dir": str(self.models_dir),
            "setup_complete": True,
        }
        
        with open(self.config_file, "w") as f:
            json.dump(config, f, indent=2)
    
    def run_setup(self):
        """Executa o processo completo de configuração."""
        print("=" * 50)
        print("Inicializando aplicativo...")
        print("=" * 50)
        
        # Detectar hardware
        hardware_info = self.detect_hardware()
        print(f"Hardware detectado: {json.dumps(hardware_info, indent=2)}")
        
        # Criar ambiente virtual
        if not self.create_virtual_environment():
            return False
        
        # Instalar dependências
        if not self.install_dependencies(hardware_info):
            return False
        
        # Baixar modelos
        self.download_models()
        
        # Salvar configuração
        self.save_config(hardware_info)
        
        print("=" * 50)
        print("Configuração concluída com sucesso!")
        print("=" * 50)
        return True


if __name__ == "__main__":
    bootloader = EnvironmentBootloader()
    success = bootloader.run_setup()
    sys.exit(0 if success else 1)
```

## Parte 2: Interface de Progresso em Electron (JavaScript)

Se você estiver usando Electron, a interface de progresso pode ser implementada da seguinte forma:

### 2.1. Janela de Progresso (`splash-screen.js`)

```javascript
const { BrowserWindow, ipcMain } = require("electron");
const path = require("path");

class SplashScreen {
  constructor() {
    this.window = null;
  }

  show() {
    this.window = new BrowserWindow({
      width: 500,
      height: 300,
      frame: false,
      transparent: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
      },
    });

    this.window.loadFile("splash.html");
    this.window.show();
  }

  updateProgress(progress, message) {
    if (this.window) {
      this.window.webContents.send("update-progress", {
        progress,
        message,
      });
    }
  }

  close() {
    if (this.window) {
      this.window.close();
      this.window = null;
    }
  }
}

module.exports = SplashScreen;
```

### 2.2. HTML da Tela de Progresso (`splash.html`)

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        color: #fff;
      }

      .container {
        text-align: center;
        padding: 40px;
      }

      .logo {
        width: 80px;
        height: 80px;
        margin-bottom: 30px;
        background: linear-gradient(135deg, #e94560 0%, #f77e5b 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 40px;
        margin-left: auto;
        margin-right: auto;
      }

      h1 {
        font-size: 24px;
        margin-bottom: 20px;
        font-weight: 600;
      }

      .progress-bar {
        width: 300px;
        height: 8px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        margin: 20px auto;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #e94560 0%, #f77e5b 100%);
        width: 0%;
        transition: width 0.3s ease;
      }

      .message {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.7);
        margin-top: 15px;
        min-height: 20px;
      }

      .percentage {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        margin-top: 10px;
      }

      .close-btn {
        position: absolute;
        top: 10px;
        right: 10px;
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        font-size: 24px;
        cursor: pointer;
        transition: color 0.2s;
      }

      .close-btn:hover {
        color: rgba(255, 255, 255, 0.8);
      }
    </style>
  </head>
  <body>
    <button class="close-btn" id="closeBtn">×</button>
    <div class="container">
      <div class="logo">🎙️</div>
      <h1>Voice Converter</h1>
      <p style="margin-bottom: 20px; color: rgba(255, 255, 255, 0.7);">
        Configurando ambiente...
      </p>
      <div class="progress-bar">
        <div class="progress-fill" id="progressFill"></div>
      </div>
      <div class="message" id="message">Inicializando...</div>
      <div class="percentage" id="percentage">0%</div>
    </div>

    <script>
      const { ipcRenderer } = require("electron");

      ipcRenderer.on("update-progress", (event, data) => {
        const { progress, message } = data;
        document.getElementById("progressFill").style.width = progress + "%";
        document.getElementById("message").textContent = message;
        document.getElementById("percentage").textContent =
          Math.round(progress) + "%";
      });

      document.getElementById("closeBtn").addEventListener("click", () => {
        ipcRenderer.send("cancel-setup");
      });
    </script>
  </body>
</html>
```

## Parte 3: Integração no Processo Principal de Electron

### 3.1. Main Process (`main.js`)

```javascript
const { app, ipcMain } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const SplashScreen = require("./splash-screen");

let splashScreen;

app.on("ready", () => {
  splashScreen = new SplashScreen();
  splashScreen.show();

  // Executar bootloader Python
  const bootloaderPath = path.join(__dirname, "bootloader.py");
  const pythonProcess = spawn("python", [bootloaderPath]);

  pythonProcess.stdout.on("data", (data) => {
    const message = data.toString().trim();
    console.log(`[Bootloader] ${message}`);

    // Extrair progresso da mensagem
    if (message.includes("Instalando")) {
      splashScreen.updateProgress(50, message);
    } else if (message.includes("Baixando")) {
      splashScreen.updateProgress(75, message);
    } else if (message.includes("Configuração concluída")) {
      splashScreen.updateProgress(100, "Pronto!");
      setTimeout(() => {
        splashScreen.close();
        // Abrir janela principal
        createMainWindow();
      }, 1000);
    }
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error(`[Bootloader Error] ${data}`);
  });

  pythonProcess.on("close", (code) => {
    if (code !== 0) {
      console.error(`Bootloader exited with code ${code}`);
      splashScreen.close();
      app.quit();
    }
  });
});

ipcMain.on("cancel-setup", () => {
  app.quit();
});

function createMainWindow() {
  // Criar a janela principal do aplicativo
  // ...
}
```

## Próximos Passos

1. **Integração com RVC**: Adapte o `bootloader.py` para baixar os modelos específicos do RVC ou Seed-VC.
2. **Testes**: Teste o processo de instalação em diferentes máquinas com diferentes GPUs.
3. **Otimização**: Implemente compressão de modelos e cache inteligente para reduzir o tempo de download.
4. **Tratamento de Erros**: Adicione mecanismos robustos de retry e relatórios de erro.
