"""Pruebas contra PostgreSQL local, sin mostrar valores de los archivos de entorno.

suite   Todas las pruebas, en una base temporal que se borra. Usa .env.pruebas.
flujos  Flujos HTTP en la base oficial con el rol limitado, en transacción revertida. Usa .env.
crud    CRUD con privilegios reales en una base temporal que se borra. Usa ambos.
"""
import os
import subprocess
import sys
from pathlib import Path

from entorno_local import RAIZ, leer

BACKEND = RAIZ / 'backend'
TEMPORAL = 'test_chilito_integracion_sinteticos'
HERRAMIENTAS = Path(__file__).resolve().parent
UNA_PRUEBA = 'datos.tests.test_mantenimientos.MantenimientoTests.test_motivo_obligatorio'
BORRAR = ('from django.db import connection as c\n'
          'with c._nodb_cursor() as k:\n'
          f'    k.execute("DROP DATABASE IF EXISTS {TEMPORAL}")')


def entorno_pruebas(base=None):
    valores = {**os.environ, **leer('.env.pruebas'), 'CHILITO_ENV': 'testing', 'DJANGO_SETTINGS_MODULE': 'config.testing',
               'CHILITO_DB_NAME': base or 'chilito_integracion_sinteticos', 'PYTHONDONTWRITEBYTECODE': '1'}
    if valores.get('CHILITO_DB_USER') != 'chilito_pkg_owner':
        sys.exit('.env.pruebas debe usar chilito_pkg_owner')
    return valores


def entorno_runtime(base=None):
    valores = {**os.environ, **leer('.env'), 'DJANGO_SETTINGS_MODULE': 'config.settings', 'PYTHONDONTWRITEBYTECODE': '1'}
    if valores.get('CHILITO_DB_USER') != 'chilito_pkg_runtime':
        sys.exit('.env debe usar chilito_pkg_runtime')
    if base:
        valores['CHILITO_DB_NAME'] = base
    return valores


def correr(argumentos, entorno):
    return subprocess.run([sys.executable, *argumentos], cwd=BACKEND, env=entorno).returncode


def suite():
    return correr(['manage.py', 'test', '--noinput'], entorno_pruebas())


def flujos():
    resultados = [correr([str(HERRAMIENTAS / f'{n}.py')], entorno_runtime()) for n in ('probar_seguridad', 'probar_mfa', 'probar_privacidad')]
    return max(resultados)


def crud():
    propietario, herramienta = entorno_pruebas(), str(HERRAMIENTAS / 'probar_crud_runtime.py')
    correr(['manage.py', 'shell', '-c', BORRAR], propietario)
    try:
        estado = correr(['manage.py', 'test', UNA_PRUEBA, '--noinput', '--keepdb'], propietario)
        estado = estado or correr([herramienta, 'preparar'], entorno_pruebas(TEMPORAL))
        return estado or correr([herramienta, 'probar'], entorno_runtime(TEMPORAL))
    finally:
        correr(['manage.py', 'shell', '-c', BORRAR], propietario)


if __name__ == '__main__':
    modos = {'suite': suite, 'flujos': flujos, 'crud': crud}
    if len(sys.argv) != 2 or sys.argv[1] not in modos:
        sys.exit(__doc__)
    sys.exit(modos[sys.argv[1]]())
