"""
TurboRVC Server - Backend FastAPI
Servidor local que expõe o motor RVC via API REST
Arquitetura desacoplada conforme estratégia técnica
Integrado ao TurboStudio TurboVoicer
"""

import os
import sys
import json
import asyncio
import hashlib
from pathlib import Path
from typing import Optional, List
from datetime import datetime

# Adicionar diretório atual ao path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn

# Imports RVC
import torch
import warnings
warnings.filterwarnings("ignore")

from vc_infer_pipeline import VC
from fairseq import checkpoint_utils
import soundfile as sf
from my_utils import load_audio
from infer_pack.models import SynthesizerTrnMs256NSFsid, SynthesizerTrnMs256NSFsid_nono
from infer_pack.modelsv2 import SynthesizerTrnMs768NSFsid_nono, SynthesizerTrnMs768NSFsid
from config import Config

# Edge TTS
try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False

# Configuração - Caminhos relativos ao RVC-GUI instalado
BASE_DIR = Path(__file__).parent.parent.parent.parent / "userData" / "turbovoicer" / "rvc-gui" / "RVC-GUI"
if not BASE_DIR.exists():
    # Fallback para desenvolvimento
    BASE_DIR = Path(__file__).parent

MODELS_DIR = BASE_DIR / "models"
OUTPUT_DIR = BASE_DIR / "output"
CACHE_DIR = BASE_DIR / "cache"
TEMP_DIR = BASE_DIR / "TEMP"

# Criar diretórios
for dir_path in [MODELS_DIR, OUTPUT_DIR, CACHE_DIR, TEMP_DIR]:
    dir_path.mkdir(exist_ok=True, parents=True)

config = Config()

# Variáveis globais RVC
hubert_model = None
device = config.device
is_half = config.is_half
current_model = {
    'name': None,
    'net_g': None,
    'cpt': None,
    'version': None,
    'tgt_sr': None,
    'vc': None
}

# FastAPI App
app = FastAPI(title="TurboRVC Server", version="1.0.0")

# CORS para permitir Electron
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# MODELS DE DADOS
# ============================================

class ConvertRequest(BaseModel):
    input_audio: str
    model_name: str
    pitch: int = 0
    f0_method: str = "rmvpe"
    index_rate: float = 0.75
    output_name: Optional[str] = None

class TTSRequest(BaseModel):
    text: str
    voice: str = "pt-BR-FranciscaNeural"
    rate: int = 0
    pitch: int = 0

class ModelInfo(BaseModel):
    name: str
    path: str
    has_index: bool
    size_mb: float

# ============================================
# FUNÇÕES RVC
# ============================================

def load_hubert():
    """Carrega modelo Hubert"""
    global hubert_model
    
    if hubert_model is not None:
        return
    
    hubert_path = BASE_DIR / "hubert_base.pt"
    if not hubert_path.exists():
        raise HTTPException(status_code=500, detail="hubert_base.pt não encontrado")
    
    models, _, _ = checkpoint_utils.load_model_ensemble_and_task(
        [str(hubert_path)],
        suffix="",
    )
    hubert_model = models[0]
    hubert_model = hubert_model.to(config.device)
    
    if is_half:
        hubert_model = hubert_model.half()
    else:
        hubert_model = hubert_model.float()
    
    hubert_model.eval()
    print("✅ Hubert carregado")

def load_rvc_model(model_name: str):
    """Carrega modelo RVC"""
    global current_model
    
    # Se já está carregado, não recarregar
    if current_model['name'] == model_name:
        return
    
    # Encontrar arquivo .pth
    model_dir = MODELS_DIR / model_name
    if not model_dir.exists():
        raise HTTPException(status_code=404, detail=f"Modelo '{model_name}' não encontrado")
    
    pth_files = list(model_dir.glob("*.pth"))
    pth_files = [f for f in pth_files if not f.name.startswith(("G_", "D_")) and f.stat().st_size < 200 * 1024 * 1024]
    
    if not pth_files:
        raise HTTPException(status_code=404, detail=f"Arquivo .pth não encontrado em '{model_name}'")
    
    model_path = pth_files[0]
    
    # Carregar modelo
    cpt = torch.load(str(model_path), map_location="cpu")
    tgt_sr = cpt["config"][-1]
    cpt["config"][-3] = cpt["weight"]["emb_g.weight"].shape[0]
    
    if_f0 = cpt.get("f0", 1)
    version = cpt.get("version", "v1")
    
    if version == "v1":
        if if_f0 == 1:
            net_g = SynthesizerTrnMs256NSFsid(*cpt["config"], is_half=is_half)
        else:
            net_g = SynthesizerTrnMs256NSFsid_nono(*cpt["config"])
    elif version == "v2":
        if if_f0 == 1:
            net_g = SynthesizerTrnMs768NSFsid(*cpt["config"], is_half=is_half)
        else:
            net_g = SynthesizerTrnMs768NSFsid_nono(*cpt["config"])
    
    del net_g.enc_q
    net_g.load_state_dict(cpt["weight"], strict=False)
    net_g.eval().to(device)
    
    if is_half:
        net_g = net_g.half()
    else:
        net_g = net_g.float()
    
    vc = VC(tgt_sr, config)
    
    # Atualizar modelo atual
    current_model = {
        'name': model_name,
        'net_g': net_g,
        'cpt': cpt,
        'version': version,
        'tgt_sr': tgt_sr,
        'vc': vc
    }
    
    print(f"✅ Modelo RVC carregado: {model_name}")

def convert_audio(input_path: str, pitch: int, f0_method: str, index_file: str, index_rate: float, output_path: str):
    """Converte áudio usando RVC"""
    global hubert_model, current_model
    
    if hubert_model is None:
        load_hubert()
    
    if current_model['net_g'] is None:
        raise HTTPException(status_code=400, detail="Nenhum modelo carregado")
    
    # Carregar áudio
    audio = load_audio(input_path, 16000)
    times = [0, 0, 0]
    
    if_f0 = current_model['cpt'].get("f0", 1)
    
    # Converter
    audio_opt = current_model['vc'].pipeline(
        hubert_model,
        current_model['net_g'],
        0,  # sid
        audio,
        times,
        pitch,
        f0_method,
        index_file,
        index_rate,
        if_f0,
        current_model['version'],
        128,  # crepe_hop_length
        None,
    )
    
    # Salvar
    sf.write(output_path, audio_opt, current_model['tgt_sr'], format='WAV')
    
    print(f"⏱️ Tempo: npy={times[0]:.2f}s, f0={times[1]:.2f}s, infer={times[2]:.2f}s")
    
    return output_path

async def generate_tts(text: str, voice: str, rate: int, pitch: int, output_path: str):
    """Gera áudio usando Edge TTS"""
    if not EDGE_TTS_AVAILABLE:
        raise HTTPException(status_code=400, detail="Edge TTS não disponível")
    
    rate_str = f"{rate:+d}%"
    pitch_str = f"{pitch:+d}Hz"
    
    communicate = edge_tts.Communicate(text, voice, rate=rate_str, pitch=pitch_str)
    await communicate.save(output_path)
    
    return output_path

# ============================================
# ENDPOINTS
# ============================================

@app.get("/")
async def root():
    """Endpoint raiz"""
    return {
        "name": "TurboRVC Server",
        "version": "1.0.0",
        "status": "running",
        "device": str(device),
        "edge_tts": EDGE_TTS_AVAILABLE,
        "base_dir": str(BASE_DIR)
    }

@app.get("/models", response_model=List[ModelInfo])
async def list_models():
    """Lista modelos disponíveis"""
    models = []
    
    if not MODELS_DIR.exists():
        return models
    
    for model_dir in MODELS_DIR.iterdir():
        if not model_dir.is_dir():
            continue
        
        # Procurar arquivo .pth
        pth_files = list(model_dir.glob("*.pth"))
        pth_files = [f for f in pth_files if not f.name.startswith(("G_", "D_")) and f.stat().st_size < 200 * 1024 * 1024]
        
        if not pth_files:
            continue
        
        # Verificar se tem .index
        index_files = list(model_dir.glob("*.index"))
        
        models.append(ModelInfo(
            name=model_dir.name,
            path=str(model_dir),
            has_index=len(index_files) > 0,
            size_mb=round(pth_files[0].stat().st_size / (1024 * 1024), 2)
        ))
    
    return models

@app.post("/models/load")
async def load_model(model_name: str):
    """Carrega um modelo específico"""
    try:
        load_rvc_model(model_name)
        return {"success": True, "model": model_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/convert")
async def convert(request: ConvertRequest):
    """Converte áudio usando RVC"""
    try:
        # Carregar modelo se necessário
        load_rvc_model(request.model_name)
        
        # Verificar se arquivo de entrada existe
        if not Path(request.input_audio).exists():
            raise HTTPException(status_code=404, detail="Arquivo de entrada não encontrado")
        
        # Encontrar arquivo .index
        model_dir = MODELS_DIR / request.model_name
        index_files = list(model_dir.glob("*.index"))
        index_file = str(index_files[0]) if index_files else ""
        
        # Gerar nome de saída
        if request.output_name:
            output_path = OUTPUT_DIR / request.output_name
        else:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = OUTPUT_DIR / f"converted_{timestamp}.wav"
        
        # Converter
        result_path = convert_audio(
            request.input_audio,
            request.pitch,
            request.f0_method,
            index_file,
            request.index_rate,
            str(output_path)
        )
        
        return {
            "success": True,
            "output_path": str(result_path),
            "model": request.model_name
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tts")
async def text_to_speech(request: TTSRequest):
    """Gera áudio a partir de texto usando Edge TTS"""
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = TEMP_DIR / f"tts_{timestamp}.wav"
        
        result_path = await generate_tts(
            request.text,
            request.voice,
            request.rate,
            request.pitch,
            str(output_path)
        )
        
        return {
            "success": True,
            "output_path": str(result_path)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/audio/{filename}")
async def get_audio(filename: str):
    """Retorna arquivo de áudio"""
    file_path = OUTPUT_DIR / filename
    
    if not file_path.exists():
        file_path = TEMP_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    
    return FileResponse(file_path)

@app.websocket("/ws/progress")
async def websocket_progress(websocket: WebSocket):
    """WebSocket para progresso em tempo real"""
    await websocket.accept()
    
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({"progress": 50, "status": "processing"})
    except Exception as e:
        print(f"WebSocket error: {e}")

# ============================================
# MAIN
# ============================================

def start_server(host: str = "127.0.0.1", port: int = 8765):
    """Inicia servidor FastAPI"""
    print(f"🚀 Iniciando TurboRVC Server em http://{host}:{port}")
    print(f"📊 Device: {device}")
    print(f"🎤 Edge TTS: {'✅ Disponível' if EDGE_TTS_AVAILABLE else '❌ Não disponível'}")
    print(f"📁 Base Dir: {BASE_DIR}")
    
    uvicorn.run(app, host=host, port=port, log_level="info")

if __name__ == "__main__":
    start_server()
