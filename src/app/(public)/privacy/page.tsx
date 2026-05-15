import type { Metadata } from 'next';
import { LegalLayout } from '@/components/legal/LegalLayout';

export const metadata: Metadata = {
  title: 'Aviso de Privacidad · Kiosko',
  description:
    'Aviso de Privacidad Integral de Kiosko, conforme a LFPDPPP (México), GDPR (UE), CCPA/CPRA (California), LGPD (Brasil) y demás leyes aplicables.',
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Aviso de Privacidad Integral"
      subtitle="Cumplimiento con LFPDPPP (México), GDPR (UE), CCPA/CPRA (California), LGPD (Brasil) y otras normativas aplicables."
      version="1.0"
      effectiveDate="15 de mayo de 2026"
      lastUpdated="15 de mayo de 2026"
    >
      <section className="legal-callout">
        <strong>Resumen:</strong> En Kiosko respetamos tu privacidad. Sólo recolectamos los datos
        necesarios para operar el Servicio, no vendemos tu información, aplicamos cifrado en
        tránsito y en reposo, y te brindamos control sobre tus datos personales. Lee este aviso
        completo para conocer tus derechos.
      </section>

      <h2>1. Identidad y domicilio del Responsable</h2>
      <p>
        En cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión de los
        Particulares (LFPDPPP), el Reglamento General de Protección de Datos de la UE (GDPR), la
        California Consumer Privacy Act / California Privacy Rights Act (CCPA/CPRA), la Lei Geral
        de Proteção de Dados de Brasil (LGPD) y demás normativa aplicable, se hace de tu
        conocimiento que:
      </p>
      <ul>
        <li><strong>Responsable:</strong> Opendex Web Services</li>
        <li><strong>Domicilio:</strong> Ciudad de México, México</li>
        <li><strong>Correo de contacto en privacidad:</strong>{' '}
          <a href="mailto:policy@opendex.dev">policy@opendex.dev</a></li>
        <li><strong>Oficial / Departamento de Protección de Datos:</strong>{' '}
          <a href="mailto:legal@opendex.dev">legal@opendex.dev</a></li>
      </ul>

      <h2>2. Datos personales que recabamos</h2>
      <h3>2.1 Datos de identificación y contacto</h3>
      <ul>
        <li>Nombre completo, fotografía de perfil, fecha de nacimiento (cuando aplique).</li>
        <li>Correo electrónico, número telefónico, domicilio.</li>
        <li>Identificación oficial y comprobante de domicilio (en procesos KYC).</li>
        <li>RFC, razón social, régimen fiscal (para facturación CFDI).</li>
      </ul>
      <h3>2.2 Datos de la cuenta y autenticación</h3>
      <ul>
        <li>Nombre de usuario, contraseña cifrada (hash), PIN, factores de doble autenticación.</li>
        <li>Tokens de sesión y cookies estrictamente necesarias.</li>
      </ul>
      <h3>2.3 Datos transaccionales y comerciales</h3>
      <ul>
        <li>Productos vendidos, montos, métodos de pago, tickets, devoluciones, fiado.</li>
        <li>Inventario, proveedores, pedidos, gastos, cortes de caja.</li>
        <li>Datos de clientes finales del comercio (cuando los registres en el sistema).</li>
      </ul>
      <h3>2.4 Datos de pago</h3>
      <p>
        Los datos completos de tarjeta (PAN, CVV, fecha) <strong>no son almacenados</strong> por
        Kiosko. Son procesados directamente por procesadores certificados PCI-DSS. Únicamente
        conservamos referencias seguras (tokens) y
        metadatos no sensibles.
      </p>
      <h3>2.5 Datos de uso, técnicos y de dispositivo</h3>
      <ul>
        <li>Dirección IP, tipo de navegador, sistema operativo, idioma, zona horaria.</li>
        <li>Identificadores de dispositivo, registros (logs), eventos de error.</li>
        <li>Cookies y tecnologías similares (ver nuestra <a href="/cookies">Política de Cookies</a>).</li>
      </ul>
      <h3>2.6 Datos de geolocalización</h3>
      <p>
        Cuando lo autorices expresamente, podremos registrar la ubicación aproximada del comercio
        para reportes y prevención de fraude.
      </p>
      <h3>2.7 Datos sensibles</h3>
      <p>
        <strong>No solicitamos datos personales sensibles</strong> (salud, origen racial,
        preferencias sexuales, religión, opinión política, datos biométricos identificativos)
        salvo cuando una funcionalidad opcional lo requiera y medie tu consentimiento expreso por
        escrito o medio electrónico equivalente.
      </p>
      <h3>2.8 Datos de menores de edad</h3>
      <p>
        El Servicio no está dirigido a menores de 18 años. No recabamos conscientemente datos de
        menores. Si detectamos su tratamiento, los eliminaremos.
      </p>

      <h2>3. Finalidades del tratamiento</h2>
      <h3>3.1 Finalidades primarias (necesarias)</h3>
      <ul>
        <li>Crear y administrar tu cuenta y perfil.</li>
        <li>Prestar las funcionalidades del Servicio (POS, inventario, reportes, cobros).</li>
        <li>Procesar pagos y facturación CFDI 4.0.</li>
        <li>Brindar soporte técnico y atención a clientes.</li>
        <li>Enviar comunicaciones operativas y de seguridad.</li>
        <li>Cumplir con obligaciones legales, fiscales y contables.</li>
        <li>Prevenir fraude, abuso y actividades ilícitas.</li>
        <li>Garantizar la seguridad e integridad del Servicio.</li>
      </ul>
      <h3>3.2 Finalidades secundarias (requieren consentimiento)</h3>
      <ul>
        <li>Enviar comunicaciones comerciales y promocionales.</li>
        <li>Análisis estadístico y mejora de productos.</li>
        <li>Encuestas de satisfacción.</li>
        <li>Personalización de contenidos y recomendaciones.</li>
      </ul>
      <p>
        Puedes oponerte en cualquier momento a las finalidades secundarias enviando un correo a{' '}
        <a href="mailto:policy@opendex.dev">policy@opendex.dev</a>, sin que ello afecte la
        prestación del Servicio.
      </p>

      <h2>4. Bases de legitimación (GDPR · LGPD)</h2>
      <p>El tratamiento se sustenta en alguna de las siguientes bases legales:</p>
      <ul>
        <li><strong>Ejecución de contrato</strong> — para prestar el Servicio que contrataste.</li>
        <li><strong>Obligación legal</strong> — para cumplir con leyes fiscales, contables, AML.</li>
        <li><strong>Interés legítimo</strong> — para seguridad, prevención de fraude y mejora del
          Servicio, ponderado frente a tus derechos.</li>
        <li><strong>Consentimiento</strong> — para finalidades secundarias o datos sensibles.</li>
        <li><strong>Protección de intereses vitales</strong> — en situaciones excepcionales.</li>
      </ul>

      <h2>5. Transferencias y comunicaciones de datos</h2>
      <p>
        Compartimos datos personales únicamente con las siguientes categorías de terceros, bajo
        contratos que exigen confidencialidad y medidas de seguridad equivalentes:
      </p>
      <table>
        <thead>
          <tr><th>Categoría</th><th>Ubicación</th><th>Finalidad</th></tr>
        </thead>
        <tbody>
          <tr><td>Hospedaje y red de entrega (CDN)</td><td>EE. UU. / Global</td><td>Hospedaje, distribución y protección del Servicio</td></tr>
          <tr><td>Base de datos relacional</td><td>EE. UU.</td><td>Almacenamiento persistente de datos del comercio</td></tr>
          <tr><td>Caché y colas de procesamiento</td><td>Global</td><td>Rendimiento y procesamiento asíncrono de tareas</td></tr>
          <tr><td>Almacenamiento de objetos</td><td>EE. UU.</td><td>Archivos, imágenes y respaldos</td></tr>
          <tr><td>Autenticación e identidad</td><td>EE. UU.</td><td>Inicio de sesión, verificación y gestión de credenciales</td></tr>
          <tr><td>Procesadores de pago</td><td>México / EE. UU.</td><td>Cobros con tarjeta, SPEI, QR y otros métodos</td></tr>
          <tr><td>Monitoreo y diagnóstico</td><td>EE. UU.</td><td>Detección, reporte y resolución de errores</td></tr>
          <tr><td>Comunicaciones y notificaciones</td><td>EE. UU.</td><td>Correo transaccional, SMS y mensajería</td></tr>
          <tr><td>Autoridades competentes</td><td>México / Según jurisdicción</td><td>Cumplimiento de obligaciones legales, fiscales y judiciales</td></tr>
        </tbody>
      </table>
      <p>
        La lista específica de sub-encargados se mantiene en un registro interno y puede ser
        solicitada por escrito a <a href="mailto:policy@opendex.dev">policy@opendex.dev</a>.
      </p>
      <p>
        Algunas transferencias internacionales se realizan a países que no necesariamente cuentan
        con un nivel de protección equivalente al del país de origen del titular. En esos casos
        aplicamos garantías apropiadas (Cláusulas Contractuales Tipo de la Comisión Europea, BCRs,
        evaluaciones de impacto) conforme al GDPR/LGPD.
      </p>

      <h2>6. Derechos ARCO + portabilidad y oposición (LFPDPPP)</h2>
      <p>Como titular de datos en México tienes derecho a:</p>
      <ul>
        <li><strong>Acceso</strong> a tus datos personales.</li>
        <li><strong>Rectificación</strong> cuando sean inexactos o incompletos.</li>
        <li><strong>Cancelación</strong> cuando consideres que no se requieren.</li>
        <li><strong>Oposición</strong> al tratamiento para fines específicos.</li>
        <li><strong>Revocación del consentimiento</strong>.</li>
        <li><strong>Limitación del uso o divulgación</strong> de tus datos.</li>
      </ul>
      <p>
        Para ejercer estos derechos envía tu solicitud a{' '}
        <a href="mailto:policy@opendex.dev">policy@opendex.dev</a> indicando: nombre completo,
        medio para recibir respuesta, copia de identificación oficial, descripción clara de los
        datos respecto de los cuales ejerces el derecho y, en su caso, documentos que sustenten la
        solicitud. Responderemos en un plazo máximo de <strong>20 días hábiles</strong> conforme al
        artículo 32 de la LFPDPPP.
      </p>

      <h2>7. Derechos bajo GDPR (UE/EEE)</h2>
      <ul>
        <li>Acceso, rectificación, supresión (&ldquo;derecho al olvido&rdquo;), limitación.</li>
        <li>Portabilidad de datos en formato estructurado y de uso común.</li>
        <li>Oposición al tratamiento basado en interés legítimo.</li>
        <li>No ser objeto de decisiones automatizadas con efectos jurídicos relevantes.</li>
        <li>Presentar reclamación ante tu autoridad nacional de protección de datos.</li>
      </ul>

      <h2>8. Derechos bajo CCPA / CPRA (California)</h2>
      <ul>
        <li>Conocer las categorías y elementos específicos de información personal recolectada.</li>
        <li>Eliminar la información personal sujeta a excepciones legales.</li>
        <li>Corrección de información inexacta.</li>
        <li>Optar por no participar en la &ldquo;venta&rdquo; o &ldquo;compartir&rdquo; (sharing)
          de información personal — <strong>Kiosko no vende información personal</strong>.</li>
        <li>No recibir trato discriminatorio por ejercer estos derechos.</li>
      </ul>

      <h2>9. Derechos bajo LGPD (Brasil)</h2>
      <p>Como titular en Brasil tienes derecho a confirmación y acceso, corrección, anonimización,
        bloqueo o eliminación, portabilidad, información sobre uso compartido, revocación del
        consentimiento y revisión de decisiones automatizadas.</p>

      <h2>10. Plazos de conservación</h2>
      <ul>
        <li>Datos de cuenta: mientras la cuenta esté activa más 24 meses.</li>
        <li>Datos contables y fiscales: <strong>5 años</strong> (artículo 30 del Código Fiscal de la
          Federación) o el plazo mayor que exija la ley.</li>
        <li>Logs de seguridad y auditoría: hasta 24 meses.</li>
        <li>Datos de soporte: hasta 36 meses tras el último contacto.</li>
        <li>Tras vencidos los plazos, los datos se eliminan o anonimizan irreversiblemente.</li>
      </ul>

      <h2>11. Medidas de seguridad</h2>
      <p>
        Implementamos medidas administrativas, técnicas y físicas razonables para proteger los
        datos personales contra daño, pérdida, alteración, destrucción o uso no autorizado,
        incluyendo:
      </p>
      <ul>
        <li>Cifrado en tránsito (TLS 1.2+) y en reposo (AES-256).</li>
        <li>Doble autenticación, control de acceso por roles (RBAC), aprobación por PIN.</li>
        <li>Hash seguro de contraseñas (bcrypt/argon2).</li>
        <li>Edge security: CSP, HSTS, bloqueo de bots, WAF.</li>
        <li>Monitoreo continuo, detección de anomalías y registro de accesos.</li>
        <li>Respaldos cifrados con geo-redundancia.</li>
        <li>Capacitación periódica al personal en privacidad y seguridad.</li>
        <li>Acuerdos de confidencialidad con personal y proveedores.</li>
      </ul>

      <h2>12. Notificación de vulneraciones</h2>
      <p>
        En caso de incidente de seguridad que afecte significativamente tus derechos, te
        notificaremos sin dilación indebida (en general, dentro de <strong>72 horas</strong> desde
        que tengamos conocimiento) e informaremos a las autoridades competentes cuando proceda
        (INAI en México, autoridades de control en la UE, ANPD en Brasil).
      </p>

      <h2>13. Decisiones automatizadas</h2>
      <p>
        El Servicio puede aplicar reglas automatizadas para detección de fraude, prevención de
        riesgos y recomendaciones internas. Tienes derecho a solicitar revisión humana de cualquier
        decisión que produzca efectos relevantes.
      </p>

      <h2>14. Cookies</h2>
      <p>
        Utilizamos cookies y tecnologías similares según se describe en nuestra{' '}
        <a href="/cookies">Política de Cookies</a>.
      </p>

      <h2>15. Cambios al Aviso</h2>
      <p>
        Cualquier modificación a este Aviso será publicada en esta página, indicando la fecha de
        última actualización. Los cambios sustanciales serán notificados por correo o aviso in-app
        con al menos <strong>15 días naturales</strong> de anticipación.
      </p>

      <h2>16. Autoridades de protección de datos</h2>
      <ul>
        <li><strong>México:</strong> Instituto Nacional de Transparencia, Acceso a la Información y
          Protección de Datos Personales (INAI) —{' '}
          <a href="https://home.inai.org.mx/">home.inai.org.mx</a></li>
        <li><strong>UE:</strong> Autoridad de control de tu país de residencia.</li>
        <li><strong>Brasil:</strong> Autoridade Nacional de Proteção de Dados (ANPD).</li>
        <li><strong>Argentina:</strong> Agencia de Acceso a la Información Pública (AAIP).</li>
        <li><strong>Colombia:</strong> Superintendencia de Industria y Comercio (SIC).</li>
      </ul>

      <h2>17. Contacto</h2>
      <p>
        Para cualquier consulta sobre este Aviso de Privacidad o el ejercicio de tus derechos,
        escríbenos a <a href="mailto:policy@opendex.dev">policy@opendex.dev</a> o a{' '}
        <a href="mailto:legal@opendex.dev">legal@opendex.dev</a>.
      </p>
    </LegalLayout>
  );
}
