import type { Metadata } from 'next';
import { LegalLayout } from '@/components/legal/LegalLayout';

export const metadata: Metadata = {
  title: 'Términos y Condiciones · Kiosko',
  description:
    'Términos y Condiciones de uso de la plataforma Kiosko: punto de venta, inventario y administración para comercios.',
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalLayout
      title="Términos y Condiciones de Uso"
      subtitle="Por favor, lee detenidamente estos términos antes de utilizar Kiosko."
      version="1.0"
      effectiveDate="15 de mayo de 2026"
      lastUpdated="15 de mayo de 2026"
    >
      <section className="legal-callout">
        <strong>Aviso importante:</strong> Al acceder o utilizar la plataforma <strong>Kiosko</strong>{' '}
        (en adelante, el &ldquo;Servicio&rdquo;), aceptas estos Términos y Condiciones. Si actúas en
        nombre de una persona moral, manifiestas contar con facultades suficientes para obligarla.
        Si no estás de acuerdo con cualquiera de las cláusulas, debes abstenerte de usar el Servicio.
      </section>

      <h2>1. Identificación del Responsable</h2>
      <p>
        El Servicio es operado por <strong>Opendex Web Services</strong>, con domicilio
        en México (en adelante, el &ldquo;Operador&rdquo;,
        &ldquo;nosotros&rdquo; o &ldquo;Kiosko&rdquo;). Para cualquier comunicación legal, contacta a{' '}
        <a href="mailto:legal@opendex.dev">legal@opendex.dev</a>.
      </p>

      <h2>2. Definiciones</h2>
      <ul>
        <li><strong>Usuario:</strong> persona física o moral que accede al Servicio.</li>
        <li><strong>Cuenta:</strong> credenciales personales e intransferibles para acceder.</li>
        <li>
          <strong>Comercio:</strong> establecimiento o negocio del Usuario que utiliza Kiosko para
          operar punto de venta, inventario, cobros, reportes y demás funciones.
        </li>
        <li><strong>Contenido del Usuario:</strong> datos de productos, ventas, clientes,
          inventario, gastos, fotografías y cualquier información cargada al Servicio.</li>
        <li><strong>Suscripción:</strong> plan de pago contratado para acceder a las funciones del
          Servicio.</li>
      </ul>

      <h2>3. Objeto del Servicio</h2>
      <p>
        Kiosko es una plataforma de software como servicio (SaaS) que provee herramientas de punto
        de venta, control de inventario, corte de caja, gestión de clientes y proveedores,
        promociones, programas de lealtad, integración con múltiples métodos de pago (tarjeta,
        SPEI, QR, entre otros), reportes analíticos e impresión de
        tickets para comercios. Las funciones disponibles dependen del plan contratado.
      </p>

      <h2>4. Registro y Cuenta</h2>
      <ol>
        <li>El registro requiere información veraz, completa y actualizada.</li>
        <li>El Usuario es responsable de mantener la confidencialidad de su contraseña, PIN, OTP y
          cualquier credencial.</li>
        <li>Toda actividad realizada con la Cuenta se presume realizada por el titular.</li>
        <li>El Operador podrá requerir verificación de identidad (KYC) cuando proceda.</li>
        <li>Es obligación del Usuario notificar de inmediato cualquier acceso no autorizado a{' '}
          <a href="mailto:contacto@opendex.dev">contacto@opendex.dev</a>.</li>
        <li>El Servicio no está dirigido a menores de edad. Para usar Kiosko debes tener al menos
          18 años cumplidos o ser representante legal autorizado.</li>
      </ol>

      <h2>5. Planes, Precios y Pagos</h2>
      <h3>5.1 Suscripción</h3>
      <p>
        Los planes y precios vigentes se publican en el sitio. Salvo indicación contraria, los
        precios están en pesos mexicanos (MXN) e incluyen el Impuesto al Valor Agregado (IVA)
        cuando aplique. Para clientes fuera de México, podrán aplicarse impuestos locales.
      </p>
      <h3>5.2 Renovación automática</h3>
      <p>
        Las suscripciones se renuevan automáticamente por el mismo periodo, salvo cancelación con
        al menos <strong>siete (7) días naturales</strong> de anticipación al término del ciclo.
      </p>
      <h3>5.3 Métodos de pago y procesadores</h3>
      <p>
        Los pagos son procesados por terceros certificados PCI-DSS. El
        Operador no almacena datos completos de tarjeta. Al pagar, aceptas también los términos del
        procesador correspondiente.
      </p>
      <h3>5.4 Falta de pago</h3>
      <p>
        En caso de falta de pago, el Operador podrá suspender o cancelar el Servicio sin
        responsabilidad, previo aviso al correo registrado.
      </p>
      <h3>5.5 Reembolsos</h3>
      <p>
        Salvo disposición legal en contrario o lo previsto en una promoción específica, los pagos
        no son reembolsables. Los Usuarios consumidores en jurisdicciones que reconozcan derecho de
        retracto podrán ejercerlo conforme a la ley aplicable.
      </p>
      <h3>5.6 Facturación</h3>
      <p>
        Para facturación CFDI 4.0 en México, el Usuario deberá proporcionar RFC, razón social,
        régimen fiscal y uso de CFDI dentro del mes calendario de la operación.
      </p>

      <h2>6. Uso aceptable</h2>
      <p>El Usuario se obliga a:</p>
      <ul>
        <li>Utilizar el Servicio conforme a la ley, la moral y las buenas costumbres.</li>
        <li>No vulnerar, eludir o sondear medidas de seguridad.</li>
        <li>No realizar ingeniería inversa, descompilación ni desensamblado del Servicio, salvo en
          la medida que la ley imperativamente lo permita.</li>
        <li>No utilizar el Servicio para almacenar o transmitir malware, contenido ilegal,
          difamatorio, infractor de derechos de terceros, o que vulnere derechos de propiedad
          intelectual.</li>
        <li>No usar el Servicio para lavado de dinero, financiamiento al terrorismo, actividades
          de juego ilegal, o cualquier conducta sancionable.</li>
        <li>No realizar scraping masivo, abuso de API ni cargas que degraden el Servicio.</li>
        <li>Cumplir con sus obligaciones fiscales, laborales y mercantiles propias del comercio.</li>
      </ul>

      <h2>7. Contenido del Usuario y Licencia</h2>
      <p>
        El Usuario conserva la titularidad de su Contenido. Por el solo hecho de cargarlo al
        Servicio, otorga al Operador una licencia mundial, no exclusiva, gratuita y limitada para
        almacenarlo, procesarlo, transmitirlo, respaldarlo y mostrarlo, exclusivamente con el fin
        de prestar el Servicio, ofrecer soporte técnico y cumplir obligaciones legales.
      </p>

      <h2>8. Propiedad Intelectual del Operador</h2>
      <p>
        El Servicio, incluyendo software, código, diseños, marcas, logotipos, interfaces,
        documentación y materiales relacionados, son propiedad exclusiva del Operador o de sus
        licenciantes y se encuentran protegidos por las leyes de propiedad intelectual aplicables.
        Se concede al Usuario una licencia personal, limitada, no exclusiva, no transferible y
        revocable para usar el Servicio conforme a estos Términos. No se otorga ningún otro derecho.
      </p>

      <h2>9. Servicios de Terceros</h2>
      <p>
        El Servicio puede integrar o enlazar con servicios de terceros (procesadores de pago,
        proveedores de envío, autenticación, mapas, etc.). El Operador no controla dichos servicios
        y no se responsabiliza por su contenido, prácticas, disponibilidad o términos.
      </p>

      <h2>10. Disponibilidad y Mantenimiento</h2>
      <p>
        El Operador realiza esfuerzos razonables para mantener el Servicio disponible 24/7, pero no
        garantiza disponibilidad ininterrumpida. Podrán existir ventanas de mantenimiento
        programado, así como interrupciones por causas de fuerza mayor, fallas de proveedores,
        ataques cibernéticos o requerimientos legales.
      </p>

      <h2>11. Limitación de responsabilidad</h2>
      <p>
        En la máxima medida permitida por la ley aplicable, el Operador no será responsable por
        daños indirectos, incidentales, especiales, consecuentes o punitivos, lucro cesante,
        pérdida de datos, pérdida de oportunidades comerciales o daño reputacional. La
        responsabilidad total acumulada del Operador se limita al monto efectivamente pagado por el
        Usuario en los <strong>doce (12) meses</strong> previos al hecho generador.
      </p>
      <p>
        Lo anterior no excluye la responsabilidad por dolo, culpa grave, fraude, daños a la vida o
        integridad personal, ni cualquier responsabilidad que no pueda ser limitada conforme a la
        ley imperativa.
      </p>

      <h2>12. Indemnización</h2>
      <p>
        El Usuario se obliga a sacar en paz y a salvo al Operador, sus afiliadas, empleados y
        directivos frente a cualquier reclamación, demanda, sanción o pérdida derivada de: (i) uso
        indebido del Servicio; (ii) violación a estos Términos; (iii) infracción a derechos de
        terceros; o (iv) incumplimiento de obligaciones fiscales, laborales o mercantiles propias.
      </p>

      <h2>13. Suspensión y Terminación</h2>
      <p>
        El Operador podrá suspender o terminar la Cuenta, total o parcialmente, en caso de
        incumplimiento, riesgo a la seguridad, requerimiento de autoridad, fraude, o cualquier
        violación a estos Términos. El Usuario podrá cancelar su Cuenta en cualquier momento desde
        las opciones de la plataforma.
      </p>
      <p>
        Tras la terminación, el Operador podrá conservar copias de respaldo conforme a su política
        de retención y a lo previsto en la legislación fiscal y de protección de datos.
      </p>

      <h2>14. Portabilidad y Exportación de Datos</h2>
      <p>
        El Usuario podrá exportar su Contenido en formatos estándar (CSV, JSON) durante la vigencia
        del Servicio y dentro de los <strong>treinta (30) días naturales</strong> posteriores a la
        cancelación, salvo impedimento legal o técnico.
      </p>

      <h2>15. Modificaciones</h2>
      <p>
        El Operador podrá modificar estos Términos. Los cambios serán notificados por correo o por
        aviso en la plataforma con al menos <strong>quince (15) días naturales</strong> de
        anticipación cuando representen cambios sustanciales. El uso continuado del Servicio
        constituye aceptación de los nuevos Términos.
      </p>

      <h2>16. Comunicaciones electrónicas</h2>
      <p>
        El Usuario consiente recibir comunicaciones por medios electrónicos (correo, notificación
        in-app, SMS o WhatsApp). Las notificaciones legales, contractuales y de seguridad se
        considerarán recibidas al ser enviadas a la dirección registrada.
      </p>

      <h2>17. Cesión</h2>
      <p>
        El Usuario no podrá ceder estos Términos sin consentimiento escrito del Operador. El
        Operador podrá ceder los Términos a una afiliada o en el contexto de una reestructuración,
        fusión, escisión o venta de activos.
      </p>

      <h2>18. Caso Fortuito y Fuerza Mayor</h2>
      <p>
        Ninguna de las partes será responsable por incumplimiento debido a caso fortuito o fuerza
        mayor, incluyendo desastres naturales, pandemias, conflictos armados, actos de autoridad,
        cortes de energía o conectividad, o ataques cibernéticos.
      </p>

      <h2>19. Ley aplicable y jurisdicción</h2>
      <p>
        Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Para Usuarios en
        México, las partes se someten a la jurisdicción de los tribunales competentes de{' '}
        la Ciudad de México, renunciando a cualquier otro fuero. Para Usuarios fuera
        de México, aplica la legislación local imperativa que les proteja.
      </p>

      <h2>20. PROFECO y resolución de controversias</h2>
      <p>
        Para Usuarios consumidores en México, las controversias podrán ventilarse ante la
        Procuraduría Federal del Consumidor (PROFECO). En la Unión Europea, los consumidores podrán
        acudir a la plataforma ODR (<a href="https://ec.europa.eu/consumers/odr/">https://ec.europa.eu/consumers/odr/</a>).
      </p>

      <h2>21. Divisibilidad</h2>
      <p>
        Si alguna cláusula es declarada nula o inejecutable, las demás permanecerán plenamente
        vigentes. La cláusula nula será sustituida por una válida que refleje la intención original.
      </p>

      <h2>22. Acuerdo total</h2>
      <p>
        Estos Términos, junto con el Aviso de Privacidad y la Política de Cookies, constituyen el
        acuerdo íntegro entre las partes y dejan sin efecto cualquier acuerdo previo sobre la
        misma materia.
      </p>

      <h2>23. Contacto</h2>
      <ul>
        <li>Atención a clientes: <a href="mailto:contacto@opendex.dev">contacto@opendex.dev</a></li>
        <li>Asuntos legales: <a href="mailto:legal@opendex.dev">legal@opendex.dev</a></li>
        <li>Privacidad de datos: <a href="mailto:policy@opendex.dev">policy@opendex.dev</a></li>
      </ul>
    </LegalLayout>
  );
}
