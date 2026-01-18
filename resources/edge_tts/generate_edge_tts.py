#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Edge TTS Generator - TurboVoicer
Gera áudio usando Microsoft Edge TTS com controles de pitch e rate
"""

import asyncio
import argparse
import sys
import os

try:
    import edge_tts
except ImportError:
    print("ERRO: Módulo edge-tts não encontrado. Instale com: pip install edge-tts", file=sys.stderr)
    sys.exit(1)


async def generate_tts(text, voice, pitch, rate, output_path):
    """
    Gera áudio usando Edge TTS
    
    Args:
        text (str): Texto para sintetizar
        voice (str): Nome da voz (ex: en-US-AvaMultilingualNeural)
        pitch (str): Ajuste de pitch (ex: +5Hz, -10Hz)
        rate (str): Ajuste de velocidade (ex: +50%, -25%)
        output_path (str): Caminho do arquivo de saída
    """
    try:
        # Criar comunicador Edge TTS
        communicate = edge_tts.Communicate(
            text=text,
            voice=voice,
            pitch=pitch,
            rate=rate
        )
        
        # Gerar e salvar áudio
        await communicate.save(output_path)
        
        # Verificar se arquivo foi criado
        if not os.path.exists(output_path):
            raise Exception(f"Arquivo de saída não foi criado: {output_path}")
        
        file_size = os.path.getsize(output_path)
        print(f"[OK] Audio gerado com sucesso: {output_path} ({file_size} bytes)")
        
    except Exception as e:
        print(f"ERRO ao gerar áudio: {str(e)}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='Gerar áudio com Edge TTS')
    parser.add_argument('--text', required=True, help='Texto para sintetizar')
    parser.add_argument('--voice', required=True, help='Nome da voz Edge TTS')
    parser.add_argument('--pitch', default='+0Hz', help='Ajuste de pitch (ex: +5Hz)')
    parser.add_argument('--rate', default='+0%', help='Ajuste de velocidade (ex: +50%)')
    parser.add_argument('--output', required=True, help='Caminho do arquivo de saída')
    
    args = parser.parse_args()
    
    # Validar argumentos
    if not args.text.strip():
        print("ERRO: Texto não pode estar vazio", file=sys.stderr)
        sys.exit(1)
    
    # Criar diretório de saída se não existir
    output_dir = os.path.dirname(args.output)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    
    # Executar geração
    print(f"Gerando áudio com Edge TTS...")
    print(f"  Voz: {args.voice}")
    print(f"  Pitch: {args.pitch}")
    print(f"  Rate: {args.rate}")
    print(f"  Texto: {args.text[:50]}{'...' if len(args.text) > 50 else ''}")
    
    asyncio.run(generate_tts(
        text=args.text,
        voice=args.voice,
        pitch=args.pitch,
        rate=args.rate,
        output_path=args.output
    ))


if __name__ == '__main__':
    main()
