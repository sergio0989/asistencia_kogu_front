'use strict';
/**
 * descargas.js — Apertura de documentos (KA-E-01).
 *
 * El backend devuelve la URL de un documento según el driver de almacenamiento:
 *
 *   STORAGE_DRIVER=local → `<base>/api/v1/files/<key>`, un endpoint que exige el
 *                          JWT en la cabecera Authorization.
 *   STORAGE_DRIVER=s3    → una URL prefirmada, que ya lleva la credencial dentro.
 *
 * El front no sabe cuál está activo, y hasta ahora hacía `window.open(url)` en
 * los dos casos. Con driver local eso no puede funcionar nunca: una pestaña
 * nueva no manda cabeceras, así que el usuario recibía 401 en blanco.
 *
 * Aquí se distingue por la forma de la URL: la del propio API se baja con fetch
 * autenticado (`api.getBlob`) y se abre como `blob:`; la prefirmada se abre
 * directo. Los errores se muestran siempre — un documento que no abre sin decir
 * por qué es la misma clase de fallo silencioso que originó Bf-07.
 *
 * Depende de: api.js, toast.js
 */

const descargas = (() => {

  // Marca del endpoint autenticado del propio API.
  const RUTA_FILES = '/api/v1/files/';

  // El blob se revoca al rato: si se hace de inmediato, la pestaña que acaba de
  // abrirse se queda sin fuente y muestra un error.
  const MS_ANTES_DE_REVOCAR = 60_000;

  function mensajeDeError(err) {
    if (err?.status === 403) return 'No tienes acceso a este documento';
    if (err?.status === 404) return 'El documento ya no está disponible';
    if (err?.status === 0)   return err.message;   // sin conexión
    return err?.message || 'No se pudo abrir el documento';
  }

  /**
   * Abre un documento en una pestaña nueva.
   *
   * @param {string} url             la que devuelve `getUrlDocumento`
   * @param {string} nombreSugerido  solo informativo, para el aviso de error
   * @returns {Promise<boolean>}     true si se abrió
   */
  async function abrirDocumento(url, nombreSugerido = '') {
    if (!url) {
      toast.error('El documento no tiene una ubicación válida');
      return false;
    }

    // URL prefirmada (S3): ya viene autorizada, se abre tal cual.
    const idx = url.indexOf(RUTA_FILES);
    if (idx === -1) {
      window.open(url, '_blank');
      return true;
    }

    // Endpoint autenticado: se baja con el token y se abre el blob. Se toma la
    // ruta desde /api/v1/ para no depender del host que haya armado el backend
    // (que es justo lo que estaba mal configurado en QA).
    const path = url.slice(idx + '/api/v1'.length);

    try {
      const blob = await api.getBlob(path);
      if (!blob) return false;                    // sesión expirada: ya redirigió

      const objectUrl = URL.createObjectURL(blob);
      const ventana   = window.open(objectUrl, '_blank');
      if (!ventana) toast.warning('Permite las ventanas emergentes para ver el documento');

      setTimeout(() => URL.revokeObjectURL(objectUrl), MS_ANTES_DE_REVOCAR);
      return true;
    } catch (err) {
      console.error('No se pudo abrir el documento', nombreSugerido, err);
      toast.error(mensajeDeError(err));
      return false;
    }
  }

  return { abrirDocumento };
})();

window.descargas = descargas;
