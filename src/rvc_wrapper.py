#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RVC Wrapper Minimalista - TurboVoicer
Baseado na estratégia "Transplante de Motor" da Manus.IM

IMPORTANTE: Este script DEVE ser executado com:
- CWD = diretório do RVC-GUI
- Python = runtime/python.exe do RVC-GUI

Exemplo:
python.exe rvc_wrapper.py --input audio.wav --model_path pasta_modelo --output saida.wav
"""

import os
import sys
import warnings

# ============================================
# PARSE ARGS PRIMEIRO (antes de qualquer import que use argparse)
# ============================================

# Verificar se é chamada do wrapper
IS_WRAPPER_MODE = '--input' in sys.argv and '--model_path' in sys.argv and '--output' in sys.argv

if IS_WRAPPER_MODE:
    # Extrair argumentos do wrapper MANUALMENTE (sem argparse)
    # Isso evita conflito com o argparse do config.py
    
    def get_arg(name, default=None):
        """Extrair argumento de sys.argv"""
        try:
            idx = sys.argv.index(name)
            if idx + 1 < len(sys.argv):
                return sys.argv[idx + 1]
        except ValueError:
            pass
        return default
    
    class WrapperArgs:
        input = get_arg('--input')
        model_path = get_arg('--model_path')
        output = get_arg('--output')
        pitch = int(get_arg('--pitch', '0'))
        method = get_arg('--method', 'harvest')
        index_rate = float(get_arg('--index_rate', '0.75'))
    
    WRAPPER_ARGS = WrapperArgs()
    
    # CRUCIAL: Limpar sys.argv para que config.py não veja nossos argumentos
    # Manter apenas o nome do script
    sys.argv = [sys.argv[0]]
else:
    WRAPPER_ARGS = None

# ============================================
# CONFIGURAÇÃO DO PATH - ANTES DE QUALQUER IMPORT
# ============================================

# O CWD deve ser o diretório do RVC-GUI
RVC_GUI_DIR = os.getcwd()

# Adicionar diretório do RVC-GUI ao path
if RVC_GUI_DIR not in sys.path:
    sys.path.insert(0, RVC_GUI_DIR)

# Suprimir warnings
warnings.filterwarnings("ignore")
os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"

# FORÇAR CPU se --force-cpu for passado
# Isso desabilita CUDA antes de importar torch
if '--force-cpu' in sys.argv:
    os.environ["CUDA_VISIBLE_DEVICES"] = ""
    print("[RVC Wrapper] FORÇANDO CPU (CUDA desabilitado)")
    sys.argv.remove('--force-cpu')

# ============================================
# IMPORTS DO RVC (APÓS CONFIGURAR PATH)
# ============================================

try:
    import torch
    import soundfile as sf
    import numpy as np
    from fairseq import checkpoint_utils
    
    # Imports do RVC-GUI
    from vc_infer_pipeline import VC
    from config import Config
    from my_utils import load_audio
    
    # Modelos RVC v1 e v2
    from infer_pack.models import SynthesizerTrnMs256NSFsid, SynthesizerTrnMs256NSFsid_nono
    from infer_pack.modelsv2 import SynthesizerTrnMs768NSFsid, SynthesizerTrnMs768NSFsid_nono
    
    print("[RVC Wrapper] Módulos carregados com sucesso")
    
except ImportError as e:
    print(f"[RVC Wrapper] ERRO: Módulo não encontrado: {e}", file=sys.stderr)
    print(f"[RVC Wrapper] CWD: {os.getcwd()}", file=sys.stderr)
    print(f"[RVC Wrapper] sys.path: {sys.path[:3]}", file=sys.stderr)
    sys.exit(1)

# ============================================
# VARIÁVEIS GLOBAIS
# ============================================

config = Config()
hubert_model = None

def load_hubert():
    """Carrega modelo Hubert"""
    global hubert_model
    
    if hubert_model is not None:
        return hubert_model
    
    hubert_path = os.path.join(RVC_GUI_DIR, "hubert_base.pt")
    
    if not os.path.exists(hubert_path):
        raise Exception(f"hubert_base.pt não encontrado em: {hubert_path}")
    
    print(f"[RVC Wrapper] Carregando Hubert de: {hubert_path}")
    
    models, _, _ = checkpoint_utils.load_model_ensemble_and_task(
        [hubert_path],
        suffix="",
    )
    hubert_model = models[0]
    hubert_model = hubert_model.to(config.device)
    
    if config.is_half:
        hubert_model = hubert_model.half()
    else:
        hubert_model = hubert_model.float()
    
    hubert_model.eval()
    print("[RVC Wrapper] Hubert carregado")
    
    return hubert_model

def load_rvc_model(model_path):
    """Carrega modelo RVC"""
    
    # Encontrar arquivo .pth
    if os.path.isdir(model_path):
        pth_files = [f for f in os.listdir(model_path) if f.endswith('.pth')]
        pth_files = [f for f in pth_files if not f.startswith(("G_", "D_"))]
        
        if not pth_files:
            raise Exception(f"Nenhum arquivo .pth encontrado em: {model_path}")
        
        model_file = os.path.join(model_path, pth_files[0])
        
        # Encontrar arquivo .index
        index_files = [f for f in os.listdir(model_path) if f.endswith('.index')]
        index_file = os.path.join(model_path, index_files[0]) if index_files else ""
    else:
        model_file = model_path
        index_file = ""
    
    print(f"[RVC Wrapper] Carregando modelo: {os.path.basename(model_file)}")
    
    # Carregar checkpoint
    cpt = torch.load(model_file, map_location="cpu")
    tgt_sr = cpt["config"][-1]
    cpt["config"][-3] = cpt["weight"]["emb_g.weight"].shape[0]
    
    if_f0 = cpt.get("f0", 1)
    version = cpt.get("version", "v1")
    
    # Criar modelo apropriado
    if version == "v1":
        if if_f0 == 1:
            net_g = SynthesizerTrnMs256NSFsid(*cpt["config"], is_half=config.is_half)
        else:
            net_g = SynthesizerTrnMs256NSFsid_nono(*cpt["config"])
    else:  # v2
        if if_f0 == 1:
            net_g = SynthesizerTrnMs768NSFsid(*cpt["config"], is_half=config.is_half)
        else:
            net_g = SynthesizerTrnMs768NSFsid_nono(*cpt["config"])
    
    del net_g.enc_q
    net_g.load_state_dict(cpt["weight"], strict=False)
    net_g.eval().to(config.device)
    
    if config.is_half:
        net_g = net_g.half()
    else:
        net_g = net_g.float()
    
    # Criar pipeline VC
    vc = VC(tgt_sr, config)
    
    print(f"[RVC Wrapper] Modelo carregado: {version}, tgt_sr={tgt_sr}, f0={if_f0}")
    
    return {
        'net_g': net_g,
        'cpt': cpt,
        'version': version,
        'tgt_sr': tgt_sr,
        'vc': vc,
        'if_f0': if_f0,
        'index_file': index_file
    }

def convert_audio(input_path, model_data, pitch, f0_method, index_rate, output_path):
    """Converte áudio usando RVC"""
    
    # Carregar Hubert
    hubert = load_hubert()
    
    # Carregar áudio
    print(f"[RVC Wrapper] Carregando áudio: {input_path}")
    audio = load_audio(input_path, 16000)
    
    times = [0, 0, 0]
    
    # Converter
    print(f"[RVC Wrapper] Convertendo... pitch={pitch}, method={f0_method}")
    
    audio_opt = model_data['vc'].pipeline(
        hubert,
        model_data['net_g'],
        0,  # sid
        audio,
        times,
        pitch,
        f0_method,
        model_data['index_file'],
        index_rate,
        model_data['if_f0'],
        model_data['version'],
        128,  # crepe_hop_length
        None,
    )
    
    # Salvar
    sf.write(output_path, audio_opt, model_data['tgt_sr'], format='WAV')
    
    print(f"[RVC Wrapper] Conversão concluída em: {output_path}")
    print(f"[RVC Wrapper] Tempo: npy={times[0]:.2f}s, f0={times[1]:.2f}s, infer={times[2]:.2f}s")
    
    return output_path

def main():
    global WRAPPER_ARGS
    
    if not IS_WRAPPER_MODE or WRAPPER_ARGS is None:
        print("[RVC Wrapper] ERRO: Modo wrapper requer argumentos --input, --model_path, --output")
        sys.exit(1)
    
    args = WRAPPER_ARGS
    
    print(f"[RVC Wrapper] Iniciando conversão...")
    print(f"[RVC Wrapper] Device: {config.device}")
    print(f"[RVC Wrapper] Half precision: {config.is_half}")
    print(f"[RVC Wrapper] Input: {args.input}")
    print(f"[RVC Wrapper] Model: {args.model_path}")
    print(f"[RVC Wrapper] Output: {args.output}")
    
    # Criar diretório de saída se não existir
    output_dir = os.path.dirname(args.output)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    
    try:
        # Carregar modelo
        model_data = load_rvc_model(args.model_path)
        
        # Converter
        result = convert_audio(
            args.input,
            model_data,
            args.pitch,
            args.method,
            args.index_rate,
            args.output
        )
        
        print(f"[RVC Wrapper] SUCESSO: {result}")
        sys.exit(0)
        
    except Exception as e:
        print(f"[RVC Wrapper] ERRO: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    if IS_WRAPPER_MODE:
        main()
    else:
        print("[RVC Wrapper] Use com --input, --model_path, --output")
        sys.exit(1)
