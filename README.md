# El Chilito

Huerto urbano inteligente: tres plantas de habanero y un equipo ESP32 futuro. Aplicación web con HTML, CSS y JavaScript propios, API en Django y PostgreSQL.

**Estado:** funciona y está probada en local. No se ha desplegado. Google Cloud, HTTPS real y un servidor de producción siguen sin comprobar. No hay sensores, MQTT, IA ni ejecución remota conectados: las pantallas muestran «sin datos» y las solicitudes quedan sin confirmar. Los textos legales son borradores. No se afirma cumplimiento de ASVS ni SSDF.

## Requisitos

Python 3.13, Django 5.2.18, django-allauth 65.20.0, psycopg 3.3.6 y PostgreSQL 17. Dependencias exactas, con hashes, en `backend/requirements-lock.txt`.

## Arranque local

1. Instala la base siguiendo [sql/instalacion/LEEME.md](sql/instalacion/LEEME.md).
2. Copia `.env.example` como `.env` y complétalo. Para pruebas, copia `.env.pruebas.example` como `.env.pruebas`. **Nunca subas esos dos archivos.**
3. Instala las dependencias y arranca:

```sh
python -m pip install --require-hashes -r backend/requirements-lock.txt
python backend/tools/servir_local.py
```

Abre http://localhost:8780. Usa `localhost`, no `127.0.0.1`: WebAuthn rechaza una dirección IP.

## Configuración

| Archivo | Uso |
|---|---|
| `.env` | Aplicación local, con el rol limitado `chilito_pkg_runtime` |
| `.env.pruebas` | Pruebas sobre la base temporal, con `chilito_pkg_owner`. No usar para migrar a mano |
| `.env.example`, `.env.pruebas.example` | Plantillas sin valores reales |

La aplicación usa siempre `chilito_pkg_runtime`. `chilito_pkg_owner` queda para cambios de esquema.

## Base de datos

- Base nueva: `sql/instalacion/03_esquema_completo.sql`, generado desde las migraciones con `backend/tools/generar_sql_instalacion.py`.
- Base con datos: los archivos de `sql/instalacion/parches/`, en orden. Ejecutar `03` sobre una base con datos no está permitido.
- Toda tabla o columna nueva requiere migración nueva, actualizar `sql/privilegios.sql`, regenerar el instalador y crear un parche.
- Capacidades administrativas: `sql/instalacion/06`, `08`, `10` y `11`. Las cuentas administradoras necesitan TOTP o llave de acceso.

## Pruebas

```sh
python backend/tools/pruebas_local.py suite   # todas, en una base temporal que se borra
python backend/tools/pruebas_local.py crud    # privilegios reales, en base temporal
python backend/tools/pruebas_local.py flujos  # HTTP en la base oficial, en transacción revertida
node frontend/pruebas-contrato.cjs            # y pruebas-guias, -diagnostico, -ayuda-vinculacion, -fechas
```

Herramientas de `backend/tools/`: `servir_local.py` (arranque), `pruebas_local.py` (pruebas), `probar_*.py` (flujos con el rol limitado), `configurar_correo.py` y `probar_correo.py` (SMTP), `soporte_local.py` (recuperación de acceso sin métodos), `generar_sql_instalacion.py` (instalador).

## API

JSON en el mismo origen, con sesión de servidor y CSRF. Las escrituras exigen `Idempotency-Key`. La autorización se decide en `services.py`.

- **Usuario:** `GET api/huertos/actual`, avisos, mantenimiento, solicitudes, `api/soporte`, `POST api/vinculacion`, `GET api/guias`.
- **Público:** `POST api/contacto`, con límite de 5 envíos por hora y por IP.
- **Administración:** `api/admin/*`, con capacidad explícita y segundo factor: `ver_flota`, `atender_soporte`, `ver_gobernanza`, `gestionar_cambios`, `gestionar_mantenimientos`, `atender_consultas`, `vincular_huertos`, `gestionar_guias`.

`GET api/huertos/actual` devuelve `{status, garden, diagnosis}`. `diagnosis` vale `null` mientras no exista productor. Cuando exista tendrá `rule` (mensaje principal por reglas), `readings` (`missing`, `stale` o `current`) y `explanation` opcional (`available`, `expired` o `unavailable`). Las fechas van en UTC con `T` y zona. Una respuesta inválida o un productor que falla producen `null`.

## Seguridad

Sesión de 8 h absolutas e inactividad de 30 min (usuario) y 15 min (administrador). Contraseñas de 15 a 256 caracteres. Código por correo, TOTP o WebAuthn. CSRF, CSP, cookies `HttpOnly` y `SameSite=Lax`, validación en servidor y errores genéricos. El servidor web solo publica `vista/`, `modelo/`, `controlador/`, `favicon.svg` e `index.html`.

Pendientes conocidos: revisión humana independiente, pentest, comprobación de contraseñas filtradas, auditoría de autenticación, `unsafe-inline` en estilos y prefijo `__Host-` en cookies.

## Despliegue pendiente

**Nada de esto se ha probado todavía.** Plan previsto en Google Cloud:

- Gunicorn detrás de un proxy, **nunca `runserver`**. Gunicorn todavía no está en las dependencias.
- `CHILITO_ENV=deployment`. El arranque se detiene si falta o es inseguro: `DEBUG`, `CHILITO_ALLOWED_HOSTS`, origen HTTPS, rol `chilito_pkg_runtime`, `CHILITO_DB_SSLMODE=verify-full`, `CHILITO_MFA_KEY` (Fernet) o SMTP activado.
- **Claves nuevas** para producción, guardadas en un gestor de secretos. No reutilizar las locales.
- `CHILITO_BEHIND_PROXY=1` y `CHILITO_TRUSTED_PROXY_COUNT` con el número real de proxies. Si no, todos los visitantes contarían como una sola IP en los límites de uso.
- Comprobar en el entorno de pruebas de la nube, antes de abrirlo al público, el límite de 5 envíos por hora y por IP: dos clientes con IP distintas deben tener cuotas separadas, y uno solo no debe poder saltarse la suya con una cabecera `X-Forwarded-For` falsa. Herramienta: `backend/tools/probar_cuota_contacto.py`; sus instrucciones están al inicio del archivo.
- Dominio definitivo antes de registrar llaves de acceso: cambiarlo las invalida.
- Decidir cómo se sirven los archivos estáticos, separar la migración con propietario del proceso web, programar `manage.py enviar_avisos_pendientes` y probar respaldos.
- `SECURE_HSTS_PRELOAD` queda desactivado por decisión del propietario.
