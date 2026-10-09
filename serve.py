#!/usr/bin/env python3
"""Servidor local do Voyage.

    python3 serve.py            → http://localhost:4173
    python3 serve.py 8080       → outra porta

Escuta em toda a rede local, então o celular no mesmo Wi-Fi também abre.
O endereço para digitar no celular aparece ao iniciar.
"""
import os, sys, errno, socket, functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

RAIZ = os.path.dirname(os.path.abspath(__file__))
os.chdir(RAIZ)
PORTA = int(sys.argv[1]) if len(sys.argv) > 1 else 4173


def ip_local():
    """IP desta máquina na rede local (não abre conexão de verdade)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('192.168.255.255', 1))
        return s.getsockname()[0]
    except Exception:
        return None
    finally:
        s.close()


class Handler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def end_headers(self):
        if not self.path.startswith('/sw.js'):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *a):
        sys.stderr.write('%s %s\n' % (self.command, self.path))


def abrir(porta):
    """Sobe o servidor na primeira porta livre a partir de `porta`."""
    for tentativa in range(porta, porta + 10):
        try:
            return ThreadingHTTPServer(('0.0.0.0', tentativa), functools.partial(Handler, directory=RAIZ)), tentativa
        except OSError as e:
            if e.errno != errno.EADDRINUSE:
                raise
            print(f'  porta {tentativa} ocupada, tentando a próxima...')
    print('\n  Nenhuma porta livre entre '
          f'{porta} e {porta + 9}. Provavelmente sobrou um servidor antigo ligado.')
    print('  Para derrubar:  pkill -f "ViagemApp/serve.py"\n')
    sys.exit(1)


servidor, PORTA = abrir(PORTA)
ip = ip_local()

print('\n  Voyage no ar')
print(f'  neste computador .... http://localhost:{PORTA}')
if ip:
    print(f'  no celular .......... http://{ip}:{PORTA}')
    print('  (celular e computador no mesmo Wi-Fi)')
else:
    print('  não consegui descobrir o IP da rede local')
print('\n  Deixe esta janela aberta enquanto usar no celular.')
print('  ctrl+c para parar\n', flush=True)

try:
    servidor.serve_forever()
except KeyboardInterrupt:
    print('\n  Servidor encerrado.\n')
