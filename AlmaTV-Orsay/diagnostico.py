#!/usr/bin/env python3
"""Read-only DIAL diagnostics unless an explicit launch flag is supplied."""
import argparse
from urllib.request import Request, build_opener, ProxyHandler
from preparar import private_ipv4
from puente import NoRedirect

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--tv',default='192.168.1.249')
    p.add_argument('--launch',choices=['YouTube','Netflix'],help='Acción explícita: abre esta app en la TV')
    a=p.parse_args()
    tv=private_ipv4(a.tv)
    opener=build_opener(ProxyHandler({}), NoRedirect())
    failed=False
    for name in ([a.launch] if a.launch else ['YouTube','Netflix']):
        method='POST' if a.launch else 'GET'
        try:
            request=Request('http://%s:8080/ws/app/%s'%(tv,name),data=b'' if a.launch else None,method=method)
            with opener.open(request,timeout=5) as response:
                print('%s %s: HTTP %s'%(method,name,response.status))
                print(response.read(16384).decode('utf-8','replace'))
        except Exception as error:
            print('%s %s: sin verificar (%s)'%(method,name,type(error).__name__))
            failed=True
    return 1 if failed else 0
if __name__=='__main__':
    raise SystemExit(main())
