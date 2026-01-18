#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RVC Server Starter - TurboVoicer
Inicia o servidor RVC-API em background
Porta: 9880
"""

import sys
import os

# Adicionar diretório do RVC-API ao path se necessário
# (ajustar conforme instalação do RVC-API)

try:
    # Importar e iniciar servidor RVC-API
    # NOTA: Este import depende de como o RVC-API foi instalado
    # Pode ser necessário ajustar o caminho ou método de importação
    
    print("[RVC Server] Iniciando servidor RVC-API na porta 9880...")
    
    # Opção 1: Se RVC-API foi instalado como módulo Python
    try:
        from rvc_api import start_server
        start_server(port=9880)
    except ImportError:
        # Opção 2: Se RVC-API está em diretório específico
        # Ajustar caminho conforme necessário
        rvc_api_path = os.path.join(os.path.dirname(__file__), 'rvc-api')
        if os.path.exists(rvc_api_path):
            sys.path.insert(0, rvc_api_path)
            from api import start_server
            start_server(port=9880)
        else:
            print("ERRO: RVC-API não encontrado", file=sys.stderr)
            print("Por favor, instale o RVC-API ou ajuste o caminho", file=sys.stderr)
            sys.exit(1)

except Exception as e:
    print(f"ERRO ao iniciar servidor RVC: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc()
    sys.exit(1)
