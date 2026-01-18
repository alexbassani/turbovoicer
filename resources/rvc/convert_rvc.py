#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RVC Converter - TurboVoicer
Converte áudio usando modelos RVC (Retrieval-based Voice Conversion)
"""

import argparse
import sys
import os
import json

try:
    import requests
except ImportError:
    print("ERRO: Módulo requests não encontrado. Instale com: pip install requests", file=sys.stderr)
    sys.exit(1)


def convert_with_rvc(input_path, model_path, pitch, output_path, rvc_api_url="http://127.0.0.1:9880"):
    """
    Converte áudio usando RVC-API
    
    Args:
        input_path (str): Caminho do áudio de entrada
        model_path (str): Caminho do modelo RVC
        pitch (int): Ajuste de pitch (f0_up_key)
        output_path (str): Caminho do arquivo de saída
        rvc_api_url (str): URL da RVC-API
    """
    try:
        # Verificar se arquivo de entrada existe
        if not os.path.exists(input_path):
            raise Exception(f"Arquivo de entrada não encontrado: {input_path}")
        
        # Verificar se modelo existe
        if not os.path.exists(model_path):
            raise Exception(f"Modelo RVC não encontrado: {model_path}")
        
        # Encontrar arquivo .pth no diretório do modelo
        pth_files = [f for f in os.listdir(model_path) if f.endswith('.pth')]
        if not pth_files:
            raise Exception(f"Nenhum arquivo .pth encontrado em: {model_path}")
        
        model_file = os.path.join(model_path, pth_files[0])
        
        # Encontrar arquivo .index (opcional)
        index_files = [f for f in os.listdir(model_path) if f.endswith('.index')]
        index_file = os.path.join(model_path, index_files[0]) if index_files else None
        
        print(f"Convertendo com RVC-API...")
        print(f"  Modelo: {os.path.basename(model_file)}")
        print(f"  Index: {os.path.basename(index_file) if index_file else 'Nenhum'}")
        print(f"  Pitch: {pitch}")
        
        # Preparar requisição para RVC-API
        with open(input_path, 'rb') as f:
            audio_data = f.read()
        
        # Preparar payload
        files = {
            'audio': ('input.mp3', audio_data, 'audio/mpeg')
        }
        
        data = {
            'model_path': model_file,
            'f0_up_key': pitch,
            'f0_method': 'rmvpe',  # Método padrão
            'index_rate': 0.75,
            'filter_radius': 3,
            'resample_sr': 0,
            'rms_mix_rate': 0.25,
            'protect': 0.33
        }
        
        if index_file:
            data['index_path'] = index_file
        
        # Fazer requisição para RVC-API
        response = requests.post(
            f"{rvc_api_url}/infer",
            files=files,
            data=data,
            timeout=300  # 5 minutos de timeout
        )
        
        if response.status_code != 200:
            raise Exception(f"RVC-API retornou erro {response.status_code}: {response.text}")
        
        # Salvar áudio convertido
        with open(output_path, 'wb') as f:
            f.write(response.content)
        
        # Verificar se arquivo foi criado
        if not os.path.exists(output_path):
            raise Exception(f"Arquivo de saída não foi criado: {output_path}")
        
        file_size = os.path.getsize(output_path)
        print(f"✓ Conversão RVC concluída: {output_path} ({file_size} bytes)")
        
    except requests.exceptions.ConnectionError:
        print("ERRO: Não foi possível conectar à RVC-API. Verifique se o servidor está rodando.", file=sys.stderr)
        sys.exit(1)
    except requests.exceptions.Timeout:
        print("ERRO: Timeout ao aguardar resposta da RVC-API.", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"ERRO ao converter áudio: {str(e)}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='Converter áudio com RVC')
    parser.add_argument('--input', required=True, help='Caminho do áudio de entrada')
    parser.add_argument('--model', required=True, help='Caminho do modelo RVC')
    parser.add_argument('--pitch', type=int, default=0, help='Ajuste de pitch (f0_up_key)')
    parser.add_argument('--output', required=True, help='Caminho do arquivo de saída')
    parser.add_argument('--api-url', default='http://127.0.0.1:9880', help='URL da RVC-API')
    
    args = parser.parse_args()
    
    # Criar diretório de saída se não existir
    output_dir = os.path.dirname(args.output)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    
    # Executar conversão
    convert_with_rvc(
        input_path=args.input,
        model_path=args.model,
        pitch=args.pitch,
        output_path=args.output,
        rvc_api_url=args.api_url
    )


if __name__ == '__main__':
    main()
