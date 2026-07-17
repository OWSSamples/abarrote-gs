import type { Metadata } from 'next';
import { LegalLayout } from '@/components/legal/LegalLayout';

export const metadata: Metadata = {
  title: 'Política de Cookies · Kiosko',
  description:
    'Política de Cookies de Kiosko: tipos, finalidades, duración y cómo gestionarlas, conforme a ePrivacy, GDPR y LFPDPPP.',
  robots: { index: true, follow: true },
};

export default function CookiesPage() {
  return (
    <LegalLayout
      title="Política de Cookies"
      subtitle="Información sobre las cookies y tecnologías similares utilizadas en Kiosko."
      version="1.0"
      effectiveDate="15 de mayo de 2026"
      lastUpdated="15 de mayo de 2026"
    >
      <section className="legal-callout">
        <strong>En resumen:</strong> Kiosko utiliza cookies estrictamente necesarias para
        autenticarte y mantener tu sesión segura. Las cookies analíticas o de marketing requieren
        tu consentimiento previo y puedes revocarlo cuando quieras.
      </section>

      <h2>1. ¿Qué son las cookies?</h2>
      <p>
        Las <strong>cookies</strong> son pequeños archivos de texto que un sitio web almacena en tu
        navegador o dispositivo cuando lo visitas. Permiten recordar información (como tu sesión
        iniciada o tus preferencias) y mejorar la experiencia. Existen tecnologías similares como{' '}
        <em>localStorage</em>, <em>sessionStorage</em>, <em>píxeles</em> y{' '}
        <em>SDKs móviles</em> que se rigen por esta misma política.
      </p>

      <h2>2. Marco legal aplicable</h2>
      <ul>
        <li><strong>México:</strong> LFPDPPP y su Reglamento, lineamientos del INAI.</li>
        <li><strong>Unión Europea / EEE:</strong> Directiva ePrivacy 2002/58/CE y GDPR.</li>
        <li><strong>Reino Unido:</strong> PECR y UK GDPR.</li>
        <li><strong>California:</strong> CCPA / CPRA.</li>
        <li><strong>Brasil:</strong> LGPD.</li>
      </ul>

      <h2>3. Tipos de cookies que utilizamos</h2>
      <h3>3.1 Por su titularidad</h3>
      <ul>
        <li><strong>Propias:</strong> emitidas por el dominio de Kiosko.</li>
        <li><strong>De terceros:</strong> emitidas por proveedores que prestan servicios al
          Operador (analítica, autenticación federada, etc.).</li>
      </ul>
      <h3>3.2 Por su duración</h3>
      <ul>
        <li><strong>De sesión:</strong> se eliminan al cerrar el navegador.</li>
        <li><strong>Persistentes:</strong> permanecen en el dispositivo por un periodo definido.</li>
      </ul>
      <h3>3.3 Por su finalidad</h3>
      <ul>
        <li>
          <strong>Estrictamente necesarias (no requieren consentimiento):</strong> autenticación,
          seguridad, balanceo de carga, prevención de fraude, mantenimiento de sesión y carrito.
        </li>
        <li>
          <strong>Funcionalidad / Preferencias:</strong> idioma, zona horaria, modo claro/oscuro,
          configuración de la interfaz.
        </li>
        <li>
          <strong>Analíticas / Estadísticas:</strong> métricas agregadas de uso para mejorar el
          producto. Se activan sólo con consentimiento.
        </li>
        <li>
          <strong>Marketing / Publicidad:</strong> se utilizarían para mostrar comunicaciones
          relevantes. Se activan sólo con consentimiento.
        </li>
      </ul>

      <h2>4. Detalle de cookies</h2>
      <p>
        El siguiente catálogo es enunciativo, no limitativo. Puede actualizarse conforme integremos
        o retiremos servicios.
      </p>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Proveedor</th>
            <th>Tipo</th>
            <th>Finalidad</th>
            <th>Duración</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>__session</td>
            <td>Kiosko</td>
            <td>Necesaria</td>
            <td>Mantener tu sesión iniciada de forma segura</td>
            <td>Hasta 1 hora por token, con límite absoluto de 6 horas</td>
          </tr>
          <tr>
            <td>__Host-csrf</td>
            <td>Kiosko</td>
            <td>Necesaria</td>
            <td>Protección frente a CSRF</td>
            <td>Sesión</td>
          </tr>
          <tr>
            <td>kumo-theme</td>
            <td>Kiosko</td>
            <td>Preferencias</td>
            <td>Recordar el tema (claro/oscuro) seleccionado</td>
            <td>1 año</td>
          </tr>
          <tr>
            <td>__store_id</td>
            <td>Kiosko</td>
            <td>Necesaria</td>
            <td>Identificar la tienda activa en operaciones multi-sucursal</td>
            <td>12 horas</td>
          </tr>
          <tr>
            <td>cookie-consent</td>
            <td>Kiosko</td>
            <td>Necesaria</td>
            <td>Almacenar tu elección sobre cookies</td>
            <td>12 meses</td>
          </tr>
          <tr>
            <td>__cf_bm / cf_clearance</td>
            <td>Proveedor de seguridad perimetral</td>
            <td>Necesaria</td>
            <td>Detección de bots y protección contra ataques</td>
            <td>30 min / 30 días</td>
          </tr>
          <tr>
            <td>Cookies de diagnóstico</td>
            <td>Proveedor de monitoreo</td>
            <td>Necesaria</td>
            <td>Trazabilidad de errores para diagnóstico técnico</td>
            <td>Sesión</td>
          </tr>
          <tr>
            <td>Cookies de pago</td>
            <td>Procesador de pagos</td>
            <td>Necesaria (pago)</td>
            <td>Prevención de fraude en transacciones</td>
            <td>Variable</td>
          </tr>
          <tr>
            <td>Cookies de analítica</td>
            <td>Proveedor de analítica</td>
            <td>Analítica (consent.)</td>
            <td>Métricas agregadas de uso y rendimiento</td>
            <td>Hasta 13 meses</td>
          </tr>
        </tbody>
      </table>

      <h2>5. Tecnologías de almacenamiento local</h2>
      <p>
        Utilizamos <em>localStorage</em> para preferencias de consentimiento, control de duración de
        sesión y, cuando el usuario lo habilita, historial local del chat de ayuda. Las ventas,
        cortes y movimientos no se almacenan localmente ni funcionan sin conexión al servidor.
      </p>

      <h2>6. Gestión y revocación del consentimiento</h2>
      <p>Puedes gestionar tus preferencias de las siguientes maneras:</p>
      <ol>
        <li>
          <strong>Banner de cookies:</strong> al ingresar por primera vez podrás aceptar todas,
          rechazar las opcionales o personalizar tus preferencias.
        </li>
        <li>
          <strong>Centro de preferencias:</strong> en cualquier momento desde el pie de página o
          desde &ldquo;Configuración &gt; Privacidad&rdquo; dentro de la aplicación.
        </li>
        <li>
          <strong>Configuración del navegador:</strong> puedes bloquear o eliminar cookies. Ten en
          cuenta que deshabilitar las cookies necesarias impedirá iniciar sesión y operar el
          Servicio.
        </li>
      </ol>
      <p>Guías oficiales:</p>
      <ul>
        <li>
          <a href="https://support.google.com/chrome/answer/95647" rel="noopener noreferrer">
            Google Chrome
          </a>
        </li>
        <li>
          <a href="https://support.mozilla.org/kb/borrar-cookies-y-datos-de-sitios-firefox" rel="noopener noreferrer">
            Mozilla Firefox
          </a>
        </li>
        <li>
          <a href="https://support.apple.com/es-mx/guide/safari/sfri11471/mac" rel="noopener noreferrer">
            Apple Safari
          </a>
        </li>
        <li>
          <a href="https://support.microsoft.com/es-es/microsoft-edge" rel="noopener noreferrer">
            Microsoft Edge
          </a>
        </li>
      </ul>

      <h2>7. Señales de privacidad reconocidas</h2>
      <p>
        Respetamos las señales <strong>Global Privacy Control (GPC)</strong> y{' '}
        <strong>Do Not Track (DNT)</strong> cuando son técnicamente detectables, tratándolas como
        oposición a cookies no esenciales.
      </p>

      <h2>8. Transferencias internacionales</h2>
      <p>
        Algunos de nuestros proveedores de servicios pueden procesar datos fuera de tu país de
        residencia, principalmente en Estados Unidos. Aplicamos garantías apropiadas conforme al
        GDPR (Cláusulas Contractuales Tipo) y a la LFPDPPP.
      </p>

      <h2>9. Datos personales y cookies</h2>
      <p>
        Algunas cookies pueden contener identificadores que se consideran datos personales
        conforme a la legislación aplicable. El tratamiento de dichos datos se rige por nuestro{' '}
        <a href="/privacy">Aviso de Privacidad</a>, donde podrás conocer y ejercer tus derechos
        ARCO, GDPR, CCPA y LGPD.
      </p>

      <h2>10. Cambios a esta Política</h2>
      <p>
        Podemos actualizar esta Política para reflejar cambios en la tecnología, la regulación o
        nuestras prácticas. Publicaremos la versión vigente en esta página indicando la fecha de
        última actualización. Cuando los cambios sean sustanciales, te lo notificaremos por correo
        o aviso in-app.
      </p>

      <h2>11. Contacto</h2>
      <p>
        Si tienes preguntas sobre esta Política de Cookies, escríbenos a{' '}
        <a href="mailto:policy@opendex.dev">policy@opendex.dev</a>.
      </p>
    </LegalLayout>
  );
}
