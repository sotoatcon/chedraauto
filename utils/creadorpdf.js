// utils/creadorpdf.js
const PdfPrinter = require('pdfmake');
const vfsFonts = require('pdfmake/build/vfs_fonts.js');
const fs = require('fs');
const path = require('path');
const config = require('./Environment');



// ------------------------------------------------------
//  NORMALIZADOR DE TEXTO
// ------------------------------------------------------
function normalizarTexto(texto) {
  if (!texto || typeof texto !== "string") return "";
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}


// ------------------------------------------------------
//  BUSCAR SUCURSAL POR DIRECCION
// ------------------------------------------------------
function obtenerSucursalPorDireccion(texto) {
  const textoNormalizado = normalizarTexto(texto);
  const sucursalesConfig = config.sucursales || {};

  for (const [nombreSucursal, direccionConfigurada] of Object.entries(sucursalesConfig)) {
    const dirConfigNorm = normalizarTexto(direccionConfigurada);
    const partes = dirConfigNorm.split(",");
    const aliasCorto = partes.length >= 2 ? `${partes[0]}, ${partes[1].trim()}` : dirConfigNorm;
    const primerFragmento = partes[0].trim();

    if (textoNormalizado.includes(primerFragmento) || textoNormalizado.includes(aliasCorto)) {
      return nombreSucursal;
    }
  }
  return "Desconocida";
}

function obtenerSucursalSeleccionada() {
  const direccion = config.SucursalaSeleccionar || "";
  if (!direccion) return "Desconocida";

  const dirNorm = normalizarTexto(direccion);

  // Preferimos el alias (llave) del mapa de RecogerEnDirecciones si coincide.
  const rec = config.RecogerEnDirecciones || {};
  for (const [nombre, dirConfig] of Object.entries(rec)) {
    const cfgNorm = normalizarTexto(String(dirConfig || ""));
    if (!cfgNorm) continue;
    if (dirNorm === cfgNorm || dirNorm.includes(cfgNorm) || cfgNorm.includes(dirNorm)) {
      return nombre;
    }
  }

  // Si no encontramos alias, devolvemos la direccion tal cual para el reporte.
  return direccion;
}

function obtenerNombreSucursalReporte() {
  const nombre = String(config.nombreSucursal || "").trim();
  if (nombre) return nombre;
  return obtenerSucursalSeleccionada();
}

function obtenerDireccionSucursalReporte() {
  const direccion = String(config.SucursalaSeleccionar || "").trim();
  return direccion || "Desconocida";
}

function sanitizarParteNombreArchivo(valor) {
  return String(valor || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function obtenerPrefijoSucursalArchivo() {
  const sucursal = sanitizarParteNombreArchivo(obtenerNombreSucursalReporte());
  return sucursal ? `${sucursal}_` : "";
}

function formatearFechaArchivo(fecha = new Date(), timeZone = 'America/Mexico_City') {
  // Formato DD_MM_YYYY (sin hora) para nombres de archivo.
  const fmt = new Intl.DateTimeFormat('es-MX', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  return fmt.format(fecha).replace(/\//g, '_');
}


// ------------------------------------------------------
//  REPORTE DE SUCURSALES (EXISTENTE)
// ------------------------------------------------------


async function generarReportePDF({
  sucursalesEvaluadas = [],
  sucursalesSinDias = [],
  fechaHora = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
  totalSucursales = 0,
  totalConfiguradas = 0,
  totalNoConfiguradas = 0
}) {
  try {
    const fonts = {
      Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    };

    const printer = new PdfPrinter(fonts);
    printer.vfs = vfsFonts.vfs;

    // ---------------------------
    //  CARPETA NICA DE REPORTES
    // ---------------------------
    const reportDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

    // ---------------------------
    //  RUTA CORRECTA DEL PDF
    // ---------------------------
    const pdfPath = path.join(reportDir, 'reporteSucursales.pdf');

    // Si existe, eliminar
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

    // ---------------------------
    //  RUTA CORRECTA DEL XML
    // ---------------------------
    const xmlPath = path.join(reportDir, 'reporteSucursales.xml');

    if (fs.existsSync(xmlPath)) fs.unlinkSync(xmlPath);

    // -------------------------------------------------
    // CONTENIDO DEL PDF (todo tu cdigo igual)
    // -------------------------------------------------

    const contenidoResumen = [
      { text: 'Resumen Final', style: 'titulo' },
      { text: `Fecha ejecución: ${fechaHora}`, style: 'subtitulo' },
      { text: '\n' },
      { text: `Total de sucursales evaluadas: ${totalSucursales}`, style: 'texto' },
      { text: `Total configuradas con días: ${totalConfiguradas}`, style: 'texto' },
      { text: `Total sin días configurados: ${totalNoConfiguradas}\n\n`, style: 'texto' },
      { text: 'Sucursales sin días configurados', style: 'encabezadoNaranja' }
    ];

    if (sucursalesSinDias.length > 0) {
      sucursalesSinDias.forEach(nombre => contenidoResumen.push({ text: nombre, style: 'texto' }));
    } else {
      contenidoResumen.push({ text: 'Todas las sucursales se encuentran configuradas.', style: 'texto' });
    }

    contenidoResumen.push({ text: '', pageBreak: 'after' });

    const sucursalesConDias = sucursalesEvaluadas.filter(s => Array.isArray(s.dias) && s.dias.length > 0);
    const contenidoDetalle = [];

    for (const [index, s] of sucursalesConDias.entries()) {
      const nombreDetectado = obtenerSucursalPorDireccion(s.nombre);

      contenidoDetalle.push({
        text: `Sucursal: ${nombreDetectado}`,
        style: 'encabezadoSucursal'
      });

      contenidoDetalle.push({
        text: [
          { text: 'Dirección: ', color: '#ff8800', bold: true },
          { text: s.nombre, color: '#000000' }
        ],
        style: 'direccion'
      });

      contenidoDetalle.push({ text: '\n', style: 'texto' });

      const dias = s.dias.slice(0, 4);

      // ENCABEZADOS -> ahora muestran la fecha real del scrapeo
      const columnas = dias.map(d => d.nombreDia.split('\n')[1] || '');

      const diasData = dias.map((d) => {
        return {
          nombreDia: d.nombreDia.split('\n')[1] || '',
          horarios: typeof d.horarios === 'string'
            ? d.horarios
                .split(',')
                .map(h => h.trim().replace(/\.$/, ''))
                .filter(h => h.length > 0)
            : []
        };
      });

      const maxFilas = Math.max(...diasData.map(d => d.horarios.length));

      contenidoDetalle.push({
        table: {
          widths: ['25%', '25%', '25%', '25%'],
          body: [
            columnas.map(c => ({
              text: c,
              style: 'encabezadoNaranja',
              alignment: 'center',
              fillColor: '#ffe6cc'
            }))
          ]
        },
        layout: 'lightHorizontalLines'
      });

      const bodyHorarios = [];
      for (let i = 0; i < maxFilas; i++) {
        const fila = diasData.map(d => ({
          text: d.horarios[i] || '',
          alignment: 'left',
          style: 'texto',
          fillColor: i % 2 === 0 ? '#ffffff' : '#f2f2f2'
        }));
        bodyHorarios.push(fila);
      }

      contenidoDetalle.push({
        table: {
          widths: ['25%', '25%', '25%', '25%'],
          body: bodyHorarios
        },
        layout: 'lightHorizontalLines'
      });

      contenidoDetalle.push({ text: '\n', style: 'texto' });

      if (index < sucursalesConDias.length - 1) contenidoDetalle.push({ text: '', pageBreak: 'after' });
    }

    const docDefinition = {
      content: [...contenidoResumen, ...contenidoDetalle],
      styles: {
        titulo: { fontSize: 18, bold: true, color: '#ff8800', margin: [0, 0, 0, 10] },
        subtitulo: { fontSize: 12, italics: true, color: '#555', margin: [0, 0, 0, 15] },
        texto: { fontSize: 11, margin: [0, 2, 0, 2] },
        textoResumen: { fontSize: 9, margin: [0, 1, 0, 1] },
        textoDef: { fontSize: 8, margin: [0, 1, 0, 1] },
        encabezadoNaranja: { fontSize: 13, bold: true, color: '#ff8800', margin: [0, 10, 0, 5] },
        encabezadoSucursal: { fontSize: 14, bold: true, color: '#ff6600', margin: [0, 12, 0, 8] },
        direccion: { fontSize: 12, lineHeight: 1.4, margin: [0, 4, 0, 4] }
      },
      defaultStyle: { font: 'Roboto' },
      pageMargins: [40, 60, 40, 60]
    };

    // ---------------------------
    // CREACIN DEL PDF
    // ---------------------------
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const stream = fs.createWriteStream(pdfPath);
    pdfDoc.pipe(stream);
    pdfDoc.end();

    // ---------------------------
    // GENERAR XML (si aplica)
    // ---------------------------
    fs.writeFileSync(xmlPath, JSON.stringify(sucursalesEvaluadas, null, 2), "utf8");

    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        console.log(` PDF generado: ${pdfPath}`);
        console.log(` XML generado: ${xmlPath}`);
        resolve(pdfPath);
      });
      stream.on('error', reject);
    });

  } catch (err) {
    console.error(' Error al generar PDF:', err);
    throw err;
  }
}


// ------------------------------------------------------
//   NUEVO: REPORTE DE COINCIDENCIAS (C1, C2, C3, C4)
// ------------------------------------------------------
async function generarReporteCoincidenciasPDF({
  nombreTestCase = "TestCase",
  fechaEjecucion = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" }),
  resultados = [],
  modo = "empathy"
}) {
  try {
    const fonts = {
      Roboto: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique"
      }
    };

    const printer = new PdfPrinter(fonts);
    printer.vfs = vfsFonts.vfs;

    const getCorreccionTexto = (r) => {
      const direct = r.correccionEsperada && String(r.correccionEsperada).trim();
      if (direct) return direct;
      if (Array.isArray(r.correccionEsperada) && r.correccionEsperada.length > 0) return r.correccionEsperada.join(", ");
      if (r.correccionEsperada) return String(r.correccionEsperada);
      if (r.correccion) return String(r.correccion);
      return "";
    };
    const getEquivalenciaTexto = (r) => {
      if (Array.isArray(r.equivalencias) && r.equivalencias.length > 0) return r.equivalencias.join(", ");
      if (r.equivalencias && String(r.equivalencias).trim().length > 0) return String(r.equivalencias);
      return "NA";
    };

    const esCombined = resultados && !Array.isArray(resultados) && (Array.isArray(resultados.empathy) || Array.isArray(resultados.legacy));
    const empathyArrForWin = esCombined && Array.isArray(resultados.empathy) ? resultados.empathy : [];
    const legacyArrForWin = esCombined && Array.isArray(resultados.legacy) ? resultados.legacy : [];

    const calcularMetricasC1 = (arr) => {
      const adaptados = (Array.isArray(arr) ? arr : []).map(r => {
        const coinc = Array.isArray(r.coincidencias) ? r.coincidencias : [];
        const noCoinc = Array.isArray(r.noCoincidencias) ? r.noCoincidencias : [];
        const listaDetallada = Array.isArray(r.listaDetallada) && r.listaDetallada.length > 0
          ? r.listaDetallada
          : [
            ...coinc.map(t => ({ texto: String(t), correccion: true, equivalencia: false })),
            ...noCoinc.map(t => ({ texto: String(t), correccion: false, equivalencia: false }))
          ];
        const calificacion = r.calificacion || (r.CC ? "CC" : r.CP ? "CP" : r.SR ? "SR" : r.SN ? "SN" : "");
        const totalProductos = typeof r.totalProductos === "number" ? r.totalProductos : listaDetallada.length;
        return { calificacion, totalProductos };
      });
      const totalEvaluados = adaptados.length;
      const totalResultadosEvaluados = adaptados.reduce((acc, x) => acc + (Number(x.totalProductos) || 0), 0);
      const metricas = {
        totalEvaluados,
        CC: adaptados.filter(x => x.calificacion === "CC").length,
        coberturaExitosa: adaptados.filter(x => (Number(x.totalProductos) || 0) >= 15).length,
        totalResultadosEvaluados
      };
      return metricas;
    };

    let terminosGanadosEmpathy = null;
    // Solo tiene sentido comparar "ganados" cuando existe seccion Legacy.
    if (esCombined && empathyArrForWin.length > 0 && legacyArrForWin.length > 0) {
      const metricasEmpathyWin = calcularMetricasC1(empathyArrForWin);
      const metricasLegacyWin = calcularMetricasC1(legacyArrForWin);
      const ganaPorTerminos =
        metricasEmpathyWin.coberturaExitosa > metricasLegacyWin.coberturaExitosa ||
        metricasEmpathyWin.totalResultadosEvaluados > metricasLegacyWin.totalResultadosEvaluados;
      const ganaPorRelevancia = metricasEmpathyWin.CC > metricasLegacyWin.CC;
      if (ganaPorTerminos && ganaPorRelevancia) terminosGanadosEmpathy = "Terminos evaluados y Relevancia resultado";
      else if (ganaPorTerminos) terminosGanadosEmpathy = "Terminos evaluados";
      else if (ganaPorRelevancia) terminosGanadosEmpathy = "Relevancia resultado";
      else terminosGanadosEmpathy = "Ninguno";
    }

    const buildSection = (resultadosArr, modoLocal) => {
      const esLegacy = modoLocal === "legacy";
      const obtenerCalificacionNumericaC1 = (calificacion) => {
        if (calificacion === "CC") return 3;
        if (calificacion === "CP") return 2;
        if (calificacion === "SR") return 1;
        return 0;
      };

      const resultadosAdaptados = resultadosArr.map(r => {
        let listaDetallada = [];

        if (Array.isArray(r.listaDetallada) && r.listaDetallada.length > 0) {
          listaDetallada = r.listaDetallada;
        } else {
          const coinc = Array.isArray(r.coincidencias) ? r.coincidencias : [];
          const noCoinc = Array.isArray(r.noCoincidencias) ? r.noCoincidencias : [];

          listaDetallada = [
            ...coinc.map(t => ({ texto: String(t), correccion: true, equivalencia: false })),
            ...noCoinc.map(t => ({ texto: String(t), correccion: false, equivalencia: false }))
          ];
        }

        const calificacion = r.calificacion || (r.CC ? "CC" : r.CP ? "CP" : r.SR ? "SR" : r.SN ? "SN" : "");
        const totalProductos = typeof r.totalProductos === "number" ? r.totalProductos : listaDetallada.length;

        return {
          termino: r.termino || r.input || "Sin nombre",
          equivalencias: r.equivalencias || null,
          correccion: r.correccion || "",
          correccionEsperada: r.correccionEsperada || null,
          calificacion,
          totalProductos,
          productosEncontrados: Array.isArray(r.productosEncontrados) ? r.productosEncontrados : [],
          hayResultados:
            r.hayResultados === true ||
            listaDetallada.length > 0 ||
            (Array.isArray(r.productosEncontrados) && r.productosEncontrados.length > 0),
          listaDetallada
        };
      });

      if (resultadosAdaptados.length === 0) {
        throw new Error("El generador recibio un arreglo vacio.");
      }

      // ---------------------------
      // METRICAS
      // ---------------------------
      const totalEvaluados = resultadosAdaptados.length;
      const tieneCalificacion = resultadosAdaptados.some(x => typeof x.calificacion === "string" && x.calificacion.length > 0);

      const metricas = {
        CC: resultadosAdaptados.filter(x => x.calificacion === "CC").length,
        CP: resultadosAdaptados.filter(x => x.calificacion === "CP").length,
        SR: resultadosAdaptados.filter(x => x.calificacion === "SR").length,
        SN: resultadosAdaptados.filter(x => x.calificacion === "SN").length
      };
      const coberturaExitosa = resultadosAdaptados.filter(x => (Number(x.totalProductos) || 0) >= 15).length;

      // Para Legacy: calcular porcentajes globales por resultado (Correcto/Equivalente/Incorrecto).
      let legacyPct = null;
      if (esLegacy) {
        let totalResultados = 0;
        let correctos = 0;
        let equivalentes = 0;
        let incorrectos = 0;

        resultadosAdaptados.forEach(t => {
          const lista = Array.isArray(t.listaDetallada) ? t.listaDetallada : [];
          totalResultados += lista.length;
          lista.forEach(item => {
            const corr = !!(item && item.correccion);
            const eq = !!(item && item.equivalencia);
            if (corr) correctos += 1;
            else if (eq) equivalentes += 1;
            else incorrectos += 1;
          });
        });

        const pct = (n) => {
          if (!totalResultados) return 0;
          return Math.round((n / totalResultados) * 10000) / 100;
        };

        legacyPct = {
          totalResultados,
          correcto: pct(correctos),
          equivalente: pct(equivalentes),
          incorrecto: pct(incorrectos)
        };
      }

      const contenido = [];
      contenido.push(
        { text: esLegacy ? "Reporte Errores Ortograficos Legacy" : "Reporte Errores Ortograficos Empathy", style: "titulo", margin: [0, 0, 0, 10] },
        { text: `Fecha ejecucion: ${fechaEjecucion}`, style: "subtitulo", margin: [0, 0, 0, 10] },
        { text: `Sucursal: ${obtenerNombreSucursalReporte()}`, style: "subtitulo", margin: [0, 0, 0, 6] },
        { text: `Dirección: ${obtenerDireccionSucursalReporte()}`, style: "subtitulo", margin: [0, 0, 0, 10] },
        { text: `Terminos buscados: ${totalEvaluados}`, style: "subtitulo", margin: [0, 0, 0, 10] }
      );

      if (tieneCalificacion) {
        if (esLegacy) {
          contenido.push(
            { text: "CC: NA", style: "subtitulo" },
            { text: `CP: ${metricas.CP}`, style: "subtitulo" },
            { text: `SR: ${metricas.SR}`, style: "subtitulo" },
            { text: `SN: ${metricas.SN}`, style: "subtitulo" },
            { text: "\n" }
          );
        } else {
          contenido.push(
            { text: `CC: ${metricas.CC}`, style: "subtitulo" },
            { text: `CP: ${metricas.CP}`, style: "subtitulo" },
            { text: `SR: ${metricas.SR}`, style: "subtitulo" },
            { text: `SN: ${metricas.SN}`, style: "subtitulo" },
            { text: "\n" }
          );
        }
      }

      // Estandarizacion resumen
      if (!esLegacy) {
        contenido.push(
          { text: `Cobertura Exitosa: ${coberturaExitosa} de ${totalEvaluados}`, style: "subtitulo", margin: [0, 0, 0, 6] },
          { text: `Resultado Relevante: ${metricas.CC + metricas.CP} de ${totalEvaluados}`, style: "subtitulo", margin: [0, 0, 0, 10] }
        );
      } else {
        contenido.push(
          { text: `Cobertura Exitosa: ${coberturaExitosa} de ${totalEvaluados}`, style: "subtitulo", margin: [0, 0, 0, 6] },
          { text: `Resultado Relevante: ${metricas.CP} de ${totalEvaluados}`, style: "subtitulo", margin: [0, 0, 0, 10] }
        );
      }

      // Solo en Empathy (excepto reportes sin legacy): mostrar terminos ganados por Empathy.
      if (!esLegacy && terminosGanadosEmpathy !== null) {
        contenido.push(
          { text: `Terminos ganados por Empathy: ${terminosGanadosEmpathy}`, style: "subtitulo", margin: [0, 0, 0, 10] }
        );
      }

      const resumenTablaBody = [
        [
          { text: "Termino", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" },
          { text: "Correccion", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" },
          { text: "Equivalencia", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" }
        ]
      ];

      resultadosAdaptados.forEach(r => {
        const corr = getCorreccionTexto(r);
        const equiv = getEquivalenciaTexto(r);
        resumenTablaBody.push([
          { text: r.termino, style: "textoResumen", alignment: "left" },
          { text: corr, style: "textoResumen", alignment: "left" },
          { text: equiv, style: "textoResumen", alignment: "left" }
        ]);
      });

      contenido.push({
        text: "Resumen de terminos",
        style: "subtitulo",
        margin: [0, 10, 0, 8]
      });
      contenido.push({
        table: { widths: ["34%", "33%", "33%"], body: resumenTablaBody },
        layout: "lightHorizontalLines"
      });

      if (!esLegacy) {
        contenido.push(
          { text: "Definiciones:", style: "subtitulo", margin: [0, 10, 0, 6] },
          { text: "CC: Hay correccion global y todos los productos tienen la correccion esperada.", style: "textoDef" },
          { text: "CP: Hay correccion global, no todos los productos tienen correccion, pero si hay equivalencias.", style: "textoDef" },
          { text: "SR: No hay correccion global, pero si hay equivalencias en los resultados.", style: "textoDef" },
          { text: "SN: No hay correccion ni equivalencias, o no hay resultados.", style: "textoDef" },
          { text: "Escala de calificacion: CC = 3, CP = 2, SR = 1, SN = 0.", style: "textoDef" }
        );
      }

      contenido.push({ text: "", pageBreak: "after" });

      // ---------------------------
      // DETALLE POR TERMINO
      // ---------------------------
      for (let i = 0; i < resultadosAdaptados.length; i++) {
        const termino = resultadosAdaptados[i];

        contenido.push({
          text: `Resultado de busqueda: "${termino.termino}"`,
          style: "encabezadoNaranja",
          margin: [0, 0, 0, 10]
        });

        if (!termino.equivalencias) {
          const hayProductos = termino.productosEncontrados.length > 0;

          if (!hayProductos) {
            contenido.push({ text: "Busqueda sin exito", style: "texto" });

            if (i < resultadosAdaptados.length - 1) {
              contenido.push({ text: "", pageBreak: "after" });
            }
            continue;
          }

          const tablaBody = [
            [
              {
                text: "Producto encontrado",
                style: "encabezadoNaranja",
                fillColor: "#ffe6cc",
                alignment: "center"
              }
            ]
          ];

          termino.productosEncontrados.forEach(p => {
            tablaBody.push([{ text: p, style: "texto", alignment: "left" }]);
          });

          contenido.push({
            table: { widths: ["100%"], body: tablaBody },
            layout: "lightHorizontalLines"
          });

          if (i < resultadosAdaptados.length - 1) {
            contenido.push({ text: "", pageBreak: "after" });
          }

          continue;
        }

        const equivalenciasTexto = Array.isArray(termino.equivalencias)
          ? termino.equivalencias.join(", ")
          : (termino.equivalencias ? String(termino.equivalencias) : "");
        const correccionTexto = getCorreccionTexto(termino);
        const totalEncontrados = typeof termino.totalProductos === "number"
          ? termino.totalProductos
          : termino.listaDetallada.length;
        const calificacionTexto = termino.calificacion || "SN";
        const calificacionNumerica = obtenerCalificacionNumericaC1(calificacionTexto);
        const correccionEsperadaTexto = termino.ccProductos === totalEncontrados && totalEncontrados > 0 ? "Si" : "No";

        contenido.push(
          { text: `Busqueda: ${termino.termino}`, style: "texto" }
        );
        if (!esLegacy) {
          const correccionMostradaTexto = termino.correccion && String(termino.correccion).trim()
            ? String(termino.correccion).trim()
            : "Sin correccion";
          contenido.push(
            { text: `Correccion mostrada: ${correccionMostradaTexto}`, style: "texto" },
            { text: `Correccion: ${correccionTexto}`, style: "texto" },
            { text: `Equivalencias: ${equivalenciasTexto}`, style: "texto" },
            { text: `Resultados encontrados: ${totalEncontrados}`, style: "texto" },
            { text: `Correccion esperada: ${correccionEsperadaTexto}`, style: "texto" },
            { text: `Calificacion busqueda: ${calificacionNumerica}`, style: "texto", margin: [0, 0, 0, 10] }
          );
        } else {
          contenido.push(
            { text: `Correccion: ${correccionTexto}`, style: "texto" },
            { text: `Equivalencias: ${equivalenciasTexto}`, style: "texto" },
            { text: `Resultados encontrados: ${totalEncontrados}`, style: "texto" },
            { text: "", style: "texto", margin: [0, 0, 0, 10] }
          );
        }
        if (esLegacy) {
          const totalLegacy = termino.listaDetallada.length;
          const correctosLegacy = termino.listaDetallada.filter(x => x.correccion || x.equivalencia).length;
          const incorrectosLegacy = totalLegacy - correctosLegacy;
          contenido.push({ text: `Correctos: ${correctosLegacy} | Incorrectos: ${incorrectosLegacy}`, style: "texto" });
        }

        const ordenados = [
          ...termino.listaDetallada.filter(x => x.coincide),
          ...termino.listaDetallada.filter(x => !x.coincide)
        ];

        contenido.push({ text: "Listado de terminos evaluados:", style: "subtitulo", margin: [0, 0, 0, 8] });

        const tablaBody = [
          [
            {
              text: "Producto",
              style: "encabezadoNaranja",
              alignment: "center",
              fillColor: "#ffe6cc"
            },
            {
              text: "Resultado",
              style: "encabezadoNaranja",
              alignment: "center",
              fillColor: "#ffe6cc"
            }
          ]
        ];

        ordenados.forEach(row => {
          const resultadoTexto = row.correccion
            ? (termino.calificacion === "CC" ? "Corregido y Correcto" : "Correcto")
            : row.equivalencia
              ? "Equivalente"
              : "Incorrecto";

          tablaBody.push([
            { text: row.texto, style: "texto", alignment: "left" },
            row.correccion
              ? { text: resultadoTexto, alignment: "center", color: "green", fontSize: 11 }
              : row.equivalencia
                ? { text: resultadoTexto, alignment: "center", color: "#ff9900", fontSize: 11 }
                : { text: resultadoTexto, alignment: "center", color: "red", fontSize: 11 }
          ]);
        });

        contenido.push({
          table: { widths: ["80%", "20%"], body: tablaBody },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => "#cccccc",
            vLineColor: () => "#cccccc"
          }
        });

        if (i < resultadosAdaptados.length - 1) {
          contenido.push({ text: "", pageBreak: "after" });
        }
      }

      return contenido;
    };

    const contenido = [];

    if (esCombined) {
      const empathyArr = Array.isArray(resultados.empathy) ? resultados.empathy : [];
      const legacyArr = Array.isArray(resultados.legacy) ? resultados.legacy : [];

      if (empathyArr.length === 0 && legacyArr.length === 0) {
        throw new Error("El generador recibio un arreglo vacio.");
      }

      if (empathyArr.length > 0) {
        contenido.push(...buildSection(empathyArr, "empathy"));
      }
      if (legacyArr.length > 0) {
        if (contenido.length > 0) contenido.push({ text: "", pageBreak: "after" });
        contenido.push(...buildSection(legacyArr, "legacy"));
      }
    } else {
      if (!Array.isArray(resultados) || resultados.length === 0) {
        throw new Error("El generador recibio un arreglo vacio.");
      }
      contenido.push(...buildSection(resultados, modo));
    }

    const docDefinition = {
      content: contenido,
      styles: {
        titulo: { fontSize: 18, bold: true, color: "#ff8800", margin: [0, 0, 0, 10] },
        subtitulo: { fontSize: 12, italics: true, color: "#555", margin: [0, 0, 0, 10] },
        texto: { fontSize: 11, margin: [0, 2, 0, 2] },
        textoResumen: { fontSize: 9, margin: [0, 1, 0, 1] },
        textoDef: { fontSize: 8, margin: [0, 1, 0, 1] },
        encabezadoNaranja: { fontSize: 13, bold: true, color: "#ff8800", margin: [0, 10, 0, 5] }
      },
      defaultStyle: { font: "Roboto" },
      pageMargins: [40, 60, 40, 60]
    };

    const reportDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

    const fechaArchivo = formatearFechaArchivo(new Date(), 'America/Mexico_City');
    const prefijoSucursal = obtenerPrefijoSucursalArchivo();
    let nombreArchivo = `${prefijoSucursal}ReporteBusqueda_${nombreTestCase}_${fechaArchivo}.pdf`;
    if (/C1/i.test(nombreTestCase) || /ErroresOrtograficos/i.test(nombreTestCase)) {
      nombreArchivo = `${prefijoSucursal}ReporteBusqueda_ErroresOrtograficos_${fechaArchivo}.pdf`;
    }
    const pdfPath = path.join(reportDir, nombreArchivo);
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const stream = fs.createWriteStream(pdfPath);
    pdfDoc.pipe(stream);
    pdfDoc.end();

    return new Promise((resolve, reject) => {
      stream.on("finish", () => resolve(pdfPath));
      stream.on("error", reject);
    });
  } catch (err) {
    console.error("Error al generar PDF:", err);
    throw err;
  }
}

// ------------------------------------------------------
//  REPORTE C3: FRECUENCIA ALTA
// ------------------------------------------------------
async function generarReporteFrecuenciaAltaPDF({
  nombreTestCase = "C3_FrecuenciaAlta",
  fechaEjecucion = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" }),
  resultados = [],
  modo = "empathy"
}) {
  const esResultadosCombinados =
    resultados &&
    typeof resultados === "object" &&
    !Array.isArray(resultados) &&
    (Array.isArray(resultados.empathy) || Array.isArray(resultados.legacy));

  try {
    if (esResultadosCombinados) {
      const emp = Array.isArray(resultados.empathy) ? resultados.empathy : [];
      const leg = Array.isArray(resultados.legacy) ? resultados.legacy : [];
      if (emp.length === 0 && leg.length === 0) {
        throw new Error("El generador recibio un arreglo vacio.");
      }
    } else if (!Array.isArray(resultados) || resultados.length === 0) {
      throw new Error("El generador recibio un arreglo vacio.");
    }

    const fonts = {
      Roboto: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique"
      }
    };

    const printer = new PdfPrinter(fonts);
    printer.vfs = vfsFonts.vfs;

    const MAX_RELEVANCIA = 2;

    const calcularPromPorResultado = (arr) => {
      const resultadosLocal = Array.isArray(arr) ? arr : [];
      let totalResultados = 0;
      let sumaCalificaciones = 0;
      resultadosLocal.forEach((r) => {
        const det = Array.isArray(r.detalles) ? r.detalles : [];
        totalResultados += det.length;
        sumaCalificaciones += det.reduce((acc, d) => acc + (Number(d.calificacion) || 0), 0);
      });
      return totalResultados > 0
        ? Math.round((sumaCalificaciones / totalResultados) * 100) / 100
        : 0;
    };

    const calcularGanadoresEmpathy = () => {
      if (!esResultadosCombinados) return null;
      const emp = Array.isArray(resultados.empathy) ? resultados.empathy : [];
      const leg = Array.isArray(resultados.legacy) ? resultados.legacy : [];
      if (emp.length === 0 || leg.length === 0) return null;
      const coberturaEmp = emp.filter((r) => {
        const det = Array.isArray(r.detalles) ? r.detalles : [];
        return det.length >= 15;
      }).length;
      const coberturaLeg = leg.filter((r) => {
        const det = Array.isArray(r.detalles) ? r.detalles : [];
        return det.length >= 15;
      }).length;
      const totalResEmp = emp.reduce((acc, r) => acc + ((Array.isArray(r.detalles) ? r.detalles.length : 0) || 0), 0);
      const totalResLeg = leg.reduce((acc, r) => acc + ((Array.isArray(r.detalles) ? r.detalles.length : 0) || 0), 0);

      const ganaPorTerminos = coberturaEmp > coberturaLeg || totalResEmp > totalResLeg;
      const ganaPorRelevancia = calcularPromPorResultado(emp) > calcularPromPorResultado(leg);
      if (ganaPorTerminos && ganaPorRelevancia) return "Terminos evaluados y Relevancia resultado";
      if (ganaPorTerminos) return "Terminos evaluados";
      if (ganaPorRelevancia) return "Relevancia resultado";
      return "Ninguno";
    };

    const terminosGanadosEmpathy = calcularGanadoresEmpathy();

    const buildSection = (resultadosArr, modoLocal) => {
      const esLegacyLocal = modoLocal === "legacy";
      const resultadosLocal = Array.isArray(resultadosArr) ? resultadosArr : [];

      const terminosEvaluados = resultadosLocal.length;
      const sumaProm = resultadosLocal.reduce((acc, r) => acc + (Number(r.calificacionPromedio) || 0), 0);
      const promBusqueda = terminosEvaluados > 0 ? Math.round((sumaProm / terminosEvaluados) * 100) / 100 : 0;

      // Promedio global ponderado por resultados (no por terminos).
      let totalResultados = 0;
      let sumaCalificaciones = 0;
      resultadosLocal.forEach((r) => {
        const det = Array.isArray(r.detalles) ? r.detalles : [];
        totalResultados += det.length;
        sumaCalificaciones += det.reduce((acc, d) => acc + (Number(d.calificacion) || 0), 0);
      });
      const promPorResultado = totalResultados > 0
        ? Math.round((sumaCalificaciones / totalResultados) * 100) / 100
        : 0;

      const titulo = esLegacyLocal ? "Frecuencia Alta Legacy" : "Frecuencia Alta Empathy";
      const coberturaExitosa = resultadosLocal.filter((r) => {
        const det = Array.isArray(r.detalles) ? r.detalles : [];
        return det.length >= 15;
      }).length;
      const resultadoRelevante = resultadosLocal.filter((r) => (Number(r.calificacionPromedio) || 0) === MAX_RELEVANCIA).length;

      const contenidoLocal = [];
      contenidoLocal.push(
        { text: titulo, style: "titulo", margin: [0, 0, 0, 10] },
        { text: `Fecha ejecucion: ${fechaEjecucion}`, style: "subtitulo", margin: [0, 0, 0, 10] },
        { text: `Sucursal: ${obtenerNombreSucursalReporte()}`, style: "subtitulo", margin: [0, 0, 0, 6] },
        { text: `Dirección: ${obtenerDireccionSucursalReporte()}`, style: "subtitulo", margin: [0, 0, 0, 10] },
        { text: `Relevancia Resultado: ${promPorResultado} sobre ${MAX_RELEVANCIA}`, style: "subtitulo", margin: [0, 0, 0, 6] },
        { text: `Terminos evaluados: ${terminosEvaluados}`, style: "subtitulo", margin: [0, 0, 0, 6] },
        { text: `Cobertura Exitosa: ${coberturaExitosa} de ${terminosEvaluados}`, style: "subtitulo", margin: [0, 0, 0, 6] },
        { text: `Resultado relevante: ${resultadoRelevante} de ${terminosEvaluados}`, style: "subtitulo", margin: [0, 0, 0, 10] }
      );

      if (!esLegacyLocal && terminosGanadosEmpathy !== null) {
        contenidoLocal.push(
          { text: `Terminos ganados por Empathy: ${terminosGanadosEmpathy}`, style: "subtitulo", margin: [0, 0, 0, 10] }
        );
      }

      const resumenBody = [
        [
          { text: "Termino", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" },
          { text: "Calificacion Promedio", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" },
          { text: "Resultados Evaluados", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" }
        ]
      ];

      resultadosLocal.forEach((r) => {
        const det = Array.isArray(r.detalles) ? r.detalles : [];
        resumenBody.push([
          { text: String(r.termino || ""), style: "textoResumen", alignment: "left" },
          { text: String(Number(r.calificacionPromedio) || 0), style: "textoResumen", alignment: "center" },
          { text: String(det.length), style: "textoResumen", alignment: "center" }
        ]);
      });

      contenidoLocal.push({ text: "Resumen de terminos", style: "subtitulo", margin: [0, 10, 0, 8] });
      contenidoLocal.push({
        table: { widths: ["55%", "25%", "20%"], body: resumenBody },
        layout: "lightHorizontalLines"
      });

      contenidoLocal.push({ text: "", pageBreak: "after" });

      // Detalle por termino
      for (let i = 0; i < resultadosLocal.length; i++) {
        const r = resultadosLocal[i];
        const det = Array.isArray(r.detalles) ? r.detalles : [];

        contenidoLocal.push(
          { text: `Termino: \"${String(r.termino || "")}\"`, style: "encabezadoNaranja", margin: [0, 0, 0, 10] },
          { text: `Calificacion Promedio: ${String(Number(r.calificacionPromedio) || 0)}`, style: "texto" },
          { text: `Resultados Evaluados: ${String(det.length)}`, style: "texto" },
          { text: `Hay resultados: ${r.hayResultados ? "SI" : "NO"}`, style: "texto", margin: [0, 0, 0, 10] }
        );

        if (!r.hayResultados || det.length === 0) {
          contenidoLocal.push({ text: "Busqueda sin resultados para evaluar.", style: "texto" });
        } else {
          const tablaBody = [
            [
              { text: "Producto encontrado", style: "encabezadoNaranja", fillColor: "#ffe6cc", alignment: "center" },
              { text: "Calificacion", style: "encabezadoNaranja", fillColor: "#ffe6cc", alignment: "center" }
            ]
          ];

          det.forEach((d) => {
            tablaBody.push([
              { text: String(d.titulo || ""), style: "texto", alignment: "left" },
              { text: String(Number(d.calificacion) || 0), style: "texto", alignment: "center" }
            ]);
          });

          contenidoLocal.push({
            table: { widths: ["85%", "15%"], body: tablaBody },
            layout: "lightHorizontalLines"
          });
        }

        if (i < resultadosLocal.length - 1) {
          contenidoLocal.push({ text: "", pageBreak: "after" });
        }
      }

      return contenidoLocal;
    };

    const contenido = [];
    if (esResultadosCombinados) {
      const emp = Array.isArray(resultados.empathy) ? resultados.empathy : [];
      const leg = Array.isArray(resultados.legacy) ? resultados.legacy : [];

      if (emp.length > 0) contenido.push(...buildSection(emp, "empathy"));
      if (emp.length > 0 && leg.length > 0) contenido.push({ text: "", pageBreak: "after" });
      if (leg.length > 0) contenido.push(...buildSection(leg, "legacy"));
    } else {
      contenido.push(...buildSection(resultados, modo));
    }

    const docDefinition = {
      content: contenido,
      styles: {
        titulo: { fontSize: 18, bold: true, color: "#ff8800", margin: [0, 0, 0, 10] },
        subtitulo: { fontSize: 12, italics: true, color: "#555", margin: [0, 0, 0, 10] },
        texto: { fontSize: 10, margin: [0, 2, 0, 2] },
        textoResumen: { fontSize: 9, margin: [0, 1, 0, 1] },
        encabezadoNaranja: { fontSize: 12, bold: true, color: "#ff8800", margin: [0, 6, 0, 4] }
      },
      defaultStyle: { font: "Roboto" },
      pageMargins: [40, 60, 40, 60]
    };

    const reportDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

    const fechaArchivo = formatearFechaArchivo(new Date(), 'America/Mexico_City');
    const pdfPath = path.join(reportDir, `${obtenerPrefijoSucursalArchivo()}ReporteBusqueda_FrecuenciaAlta_${fechaArchivo}.pdf`);
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const stream = fs.createWriteStream(pdfPath);
    pdfDoc.pipe(stream);
    pdfDoc.end();

    return new Promise((resolve, reject) => {
      stream.on("finish", () => resolve(pdfPath));
      stream.on("error", reject);
    });

  } catch (err) {
    console.error("Error al generar PDF Frecuencia Alta:", err);
    throw err;
  }
}

// ------------------------------------------------------
//  REPORTE C2: LONG TAIL
// ------------------------------------------------------
async function generarReporteLongTailPDF({
  nombreTestCase = "C2_LongTail",
  fechaEjecucion = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" }),
  resultados = [],
  modo = "empathy"
}) {
  const esResultadosCombinados =
    resultados &&
    typeof resultados === "object" &&
    !Array.isArray(resultados) &&
    (Array.isArray(resultados.empathy) || Array.isArray(resultados.legacy));

  try {
    if (esResultadosCombinados) {
      const emp = Array.isArray(resultados.empathy) ? resultados.empathy : [];
      const leg = Array.isArray(resultados.legacy) ? resultados.legacy : [];
      if (emp.length === 0 && leg.length === 0) {
        throw new Error("El generador recibio un arreglo vacio.");
      }
    } else if (!Array.isArray(resultados) || resultados.length === 0) {
      throw new Error("El generador recibio un arreglo vacio.");
    }

    const fonts = {
      Roboto: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique"
      }
    };

    const printer = new PdfPrinter(fonts);
    printer.vfs = vfsFonts.vfs;

    const MAX_RELEVANCIA = 5;

    const calcularPromPorResultado = (arr) => {
      const resultadosLocal = Array.isArray(arr) ? arr : [];
      let totalResultados = 0;
      let sumaCalificaciones = 0;
      resultadosLocal.forEach((r) => {
        const det = Array.isArray(r.detalles) ? r.detalles : [];
        totalResultados += det.length;
        sumaCalificaciones += det.reduce((acc, d) => acc + (Number(d.calificacion) || 0), 0);
      });
      return totalResultados > 0
        ? Math.round((sumaCalificaciones / totalResultados) * 100) / 100
        : 0;
    };

    const calcularPromPorTermino = (arr) => {
      const resultadosLocal = Array.isArray(arr) ? arr : [];
      const totalTerminos = resultadosLocal.length;
      const sumaPromedios = resultadosLocal.reduce((acc, r) => acc + (Number(r.calificacionPromedio) || 0), 0);
      return totalTerminos > 0
        ? Math.round((sumaPromedios / totalTerminos) * 100) / 100
        : 0;
    };

    const formatearGanadores = (items) => {
      if (items.length === 0) return "Ninguno";
      if (items.length === 1) return items[0];
      if (items.length === 2) return `${items[0]} y ${items[1]}`;
      return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
    };

    const calcularGanadoresEmpathy = () => {
      if (!esResultadosCombinados) return null;
      const emp = Array.isArray(resultados.empathy) ? resultados.empathy : [];
      const leg = Array.isArray(resultados.legacy) ? resultados.legacy : [];
      if (emp.length === 0 || leg.length === 0) return null;
      const coberturaEmp = emp.filter((r) => {
        const det = Array.isArray(r.detalles) ? r.detalles : [];
        return det.length >= 10;
      }).length;
      const coberturaLeg = leg.filter((r) => {
        const det = Array.isArray(r.detalles) ? r.detalles : [];
        return det.length >= 10;
      }).length;
      const totalResEmp = emp.reduce((acc, r) => acc + ((Array.isArray(r.detalles) ? r.detalles.length : 0) || 0), 0);
      const totalResLeg = leg.reduce((acc, r) => acc + ((Array.isArray(r.detalles) ? r.detalles.length : 0) || 0), 0);

      const ganaPorTerminos = coberturaEmp > coberturaLeg || totalResEmp > totalResLeg;
      const ganaPorRelevancia = calcularPromPorResultado(emp) > calcularPromPorResultado(leg);
      const ganaPorPromedioTerminos = calcularPromPorTermino(emp) > calcularPromPorTermino(leg);
      const ganadores = [];
      if (ganaPorTerminos) ganadores.push("Terminos evaluados");
      if (ganaPorRelevancia) ganadores.push("Relevancia resultado");
      if (ganaPorPromedioTerminos) ganadores.push("Calificación promedio por término");
      return formatearGanadores(ganadores);
    };

    const terminosGanadosEmpathy = calcularGanadoresEmpathy();

    const buildSection = (resultadosArr, modoLocal) => {
      const esLegacyLocal = modoLocal === "legacy";
      const resultadosLocal = Array.isArray(resultadosArr) ? resultadosArr : [];

      const terminosEvaluados = resultadosLocal.length;
      const sumaProm = resultadosLocal.reduce((acc, r) => acc + (Number(r.calificacionPromedio) || 0), 0);
      const promBusqueda = terminosEvaluados > 0 ? Math.round((sumaProm / terminosEvaluados) * 100) / 100 : 0;

      // Promedio global ponderado por resultados (no por terminos).
      let totalResultados = 0;
      let sumaCalificaciones = 0;
      resultadosLocal.forEach((r) => {
        const det = Array.isArray(r.detalles) ? r.detalles : [];
        totalResultados += det.length;
        sumaCalificaciones += det.reduce((acc, d) => acc + (Number(d.calificacion) || 0), 0);
      });
      const promPorResultado = totalResultados > 0
        ? Math.round((sumaCalificaciones / totalResultados) * 100) / 100
        : 0;

      const titulo = esLegacyLocal ? "Long Tail Legacy" : "Long Tail Empathy";
      const coberturaExitosa = resultadosLocal.filter((r) => {
        const det = Array.isArray(r.detalles) ? r.detalles : [];
        return det.length >= 10;
      }).length;
      // Long Tail: "Resultado relevante" se mide por el primer resultado del termino (no por el promedio).
      const resultadoRelevante = resultadosLocal.filter((r) => {
        const det = Array.isArray(r.detalles) ? r.detalles : [];
        const first = det.length > 0 ? det[0] : null;
        return (Number(first && first.calificacion) || 0) === MAX_RELEVANCIA;
      }).length;

      const contenidoLocal = [];
      contenidoLocal.push(
        { text: titulo, style: "titulo", margin: [0, 0, 0, 10] },
        { text: `Fecha ejecucion: ${fechaEjecucion}`, style: "subtitulo", margin: [0, 0, 0, 10] },
        { text: `Sucursal: ${obtenerNombreSucursalReporte()}`, style: "subtitulo", margin: [0, 0, 0, 6] },
        { text: `Dirección: ${obtenerDireccionSucursalReporte()}`, style: "subtitulo", margin: [0, 0, 0, 10] },
        { text: `Terminos Evaluados: ${terminosEvaluados}`, style: "subtitulo", margin: [0, 0, 0, 6] },
        { text: `Cobertura Exitosa: ${coberturaExitosa} sobre ${terminosEvaluados}`, style: "subtitulo", margin: [0, 0, 0, 6] },
        { text: `Resultado Relevante: ${resultadoRelevante} sobre ${terminosEvaluados}`, style: "subtitulo", margin: [0, 0, 0, 6] },
        { text: `Calificación promedio por término: ${promBusqueda} sobre ${MAX_RELEVANCIA}`, style: "subtitulo", margin: [0, 0, 0, 6] },
        { text: `Relevancia Resultado: ${promPorResultado} sobre ${MAX_RELEVANCIA}`, style: "subtitulo", margin: [0, 0, 0, 10] }
      );

      if (!esLegacyLocal && terminosGanadosEmpathy !== null) {
        contenidoLocal.push(
          { text: `Terminos ganados por Empathy: ${terminosGanadosEmpathy}`, style: "subtitulo", margin: [0, 0, 0, 10] }
        );
      }

      const resumenBody = [
        [
          { text: "Termino", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" },
          { text: "Calificacion Promedio", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" },
          { text: "Resultados Evaluados", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" }
        ]
      ];

      resultadosLocal.forEach((r) => {
        const det = Array.isArray(r.detalles) ? r.detalles : [];
        resumenBody.push([
          { text: String(r.termino || ""), style: "textoResumen", alignment: "left" },
          { text: String(Number(r.calificacionPromedio) || 0), style: "textoResumen", alignment: "center" },
          { text: String(det.length), style: "textoResumen", alignment: "center" }
        ]);
      });

      contenidoLocal.push({ text: "Resumen de terminos", style: "subtitulo", margin: [0, 10, 0, 8] });
      contenidoLocal.push({
        table: { widths: ["55%", "25%", "20%"], body: resumenBody },
        layout: "lightHorizontalLines"
      });

      contenidoLocal.push({ text: "", pageBreak: "after" });

      // Detalle por termino
      for (let i = 0; i < resultadosLocal.length; i++) {
        const r = resultadosLocal[i];
        const det = Array.isArray(r.detalles) ? r.detalles : [];
        const terminoTexto = String(r.termino || r.Termino || "");

        contenidoLocal.push(
          { text: `Termino: \"${terminoTexto}\"`, style: "encabezadoNaranja", margin: [0, 0, 0, 10] },
          { text: `Calificacion Promedio: ${String(Number(r.calificacionPromedio) || 0)}`, style: "texto" },
          { text: `Categoria: ${String(r.categoria || "")}`, style: "texto" },
          { text: `Marca: ${String(r.marca || "")}`, style: "texto" },
          { text: `Especificacion: ${String(r.especificacion || "")}`, style: "texto" },
          { text: `Formato: ${String(r.formato || "")}`, style: "texto" },
          { text: `Intencion: ${String(r.intencion || "")}`, style: "texto" },
          { text: `Hay resultados: ${r.hayResultados ? "SI" : "NO"}`, style: "texto", margin: [0, 0, 0, 10] }
        );

        if (!r.hayResultados || det.length === 0) {
          contenidoLocal.push({ text: "Busqueda sin resultados para evaluar.", style: "texto" });
        } else {
          const tablaBody = [
            [
              { text: "Producto encontrado", style: "encabezadoNaranja", fillColor: "#ffe6cc", alignment: "center" },
              { text: "Calificacion", style: "encabezadoNaranja", fillColor: "#ffe6cc", alignment: "center" }
            ]
          ];

          det.forEach((d) => {
            tablaBody.push([
              { text: String(d.titulo || ""), style: "texto", alignment: "left" },
              { text: String(Number(d.calificacion) || 0), style: "texto", alignment: "center" }
            ]);
          });

          contenidoLocal.push({
            table: { widths: ["85%", "15%"], body: tablaBody },
            layout: "lightHorizontalLines"
          });
        }

        if (i < resultadosLocal.length - 1) {
          contenidoLocal.push({ text: "", pageBreak: "after" });
        }
      }

      return contenidoLocal;
    };

    const contenido = [];
    if (esResultadosCombinados) {
      const emp = Array.isArray(resultados.empathy) ? resultados.empathy : [];
      const leg = Array.isArray(resultados.legacy) ? resultados.legacy : [];

      if (emp.length > 0) contenido.push(...buildSection(emp, "empathy"));
      if (emp.length > 0 && leg.length > 0) contenido.push({ text: "", pageBreak: "after" });
      if (leg.length > 0) contenido.push(...buildSection(leg, "legacy"));
    } else {
      contenido.push(...buildSection(resultados, modo));
    }

    const docDefinition = {
      content: contenido,
      styles: {
        titulo: { fontSize: 18, bold: true, color: "#ff8800", margin: [0, 0, 0, 10] },
        subtitulo: { fontSize: 12, italics: true, color: "#555", margin: [0, 0, 0, 10] },
        texto: { fontSize: 10, margin: [0, 2, 0, 2] },
        textoResumen: { fontSize: 9, margin: [0, 1, 0, 1] },
        encabezadoNaranja: { fontSize: 12, bold: true, color: "#ff8800", margin: [0, 6, 0, 4] }
      },
      defaultStyle: { font: "Roboto" },
      pageMargins: [40, 60, 40, 60]
    };

    const reportDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

    const fechaArchivo = formatearFechaArchivo(new Date(), 'America/Mexico_City');
    const pdfPath = path.join(reportDir, `${obtenerPrefijoSucursalArchivo()}ReporteBusqueda_LongTail_${fechaArchivo}.pdf`);
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const stream = fs.createWriteStream(pdfPath);
    pdfDoc.pipe(stream);
    pdfDoc.end();

    return new Promise((resolve, reject) => {
      stream.on("finish", () => resolve(pdfPath));
      stream.on("error", reject);
    });

  } catch (err) {
    console.error("Error al generar PDF Long Tail:", err);
    throw err;
  }
}

// ------------------------------------------------------
//  REPORTE C5: RESULTADOS VACIOS
// ------------------------------------------------------
async function generarReporteResultadosVaciosPDF({
  nombreTestCase = "C5_ResultadosVacios",
  fechaEjecucion = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" }),
  resultados = [],
  modo = "empathy"
}) {
  const esLegacy = modo === "legacy";

  try {
    if (!Array.isArray(resultados) || resultados.length === 0) {
      throw new Error("El generador recibio un arreglo vacio.");
    }

    const fonts = {
      Roboto: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique"
      }
    };

    const printer = new PdfPrinter(fonts);
    printer.vfs = vfsFonts.vfs;

    const terminosEvaluados = resultados.length;
    const counts = { R: 0, P: 0, I: 0, V: 0 };
    resultados.forEach((r) => {
      const c = String(r.calificacion || "").toUpperCase();
      if (counts[c] !== undefined) counts[c] += 1;
    });

    const titulo = esLegacy ? "Resultados Vacios Legacy" : "Resultados Vacios Empathy";
    const coberturaExitosa = resultados.filter((r) => {
      const titulos = Array.isArray(r.productosEncontrados) ? r.productosEncontrados : [];
      const totalResultados = (r.totalResultados !== undefined && r.totalResultados !== null)
        ? Number(r.totalResultados) || 0
        : titulos.length;
      return totalResultados >= 15;
    }).length;

    const contenido = [];
    contenido.push(
      { text: titulo, style: "titulo", margin: [0, 0, 0, 10] },
      { text: `Fecha ejecucion: ${fechaEjecucion}`, style: "subtitulo", margin: [0, 0, 0, 10] },
      { text: `Sucursal: ${obtenerNombreSucursalReporte()}`, style: "subtitulo", margin: [0, 0, 0, 6] },
      { text: `Dirección: ${obtenerDireccionSucursalReporte()}`, style: "subtitulo", margin: [0, 0, 0, 10] },
      { text: `Terminos evaluados: ${terminosEvaluados}`, style: "subtitulo", margin: [0, 0, 0, 6] },
      { text: `Cobertura Exitosa: ${coberturaExitosa} de ${terminosEvaluados}`, style: "subtitulo", margin: [0, 0, 0, 6] },
      { text: `Resultado relevante: ${counts.R} de ${terminosEvaluados}`, style: "subtitulo", margin: [0, 0, 0, 6] },
      { text: `R: ${counts.R}  P: ${counts.P}  I: ${counts.I}  V: ${counts.V}`, style: "subtitulo", margin: [0, 0, 0, 10] }
    );

    const resumenBody = [
      [
        { text: "Termino", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" },
        { text: "Elementos Encontrados", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" },
        { text: "Calificacion", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" }
      ]
    ];

    resultados.forEach((r) => {
      const titulos = Array.isArray(r.productosEncontrados) ? r.productosEncontrados : [];
      const totalResultados = (r.totalResultados !== undefined && r.totalResultados !== null)
        ? Number(r.totalResultados) || 0
        : titulos.length;
      resumenBody.push([
        { text: String(r.termino || ""), style: "textoResumen", alignment: "left" },
        { text: String(totalResultados), style: "textoResumen", alignment: "center" },
        { text: String(r.calificacion || ""), style: "textoResumen", alignment: "center" }
      ]);
    });

    contenido.push({ text: "Resumen de terminos", style: "subtitulo", margin: [0, 10, 0, 8] });
    contenido.push({
      table: { widths: ["55%", "25%", "20%"], body: resumenBody },
      layout: "lightHorizontalLines"
    });

    contenido.push({ text: "", pageBreak: "after" });

    // Detalle por termino (compacto)
    for (let i = 0; i < resultados.length; i++) {
      const r = resultados[i];
      const titulos = Array.isArray(r.productosEncontrados) ? r.productosEncontrados : [];
      const det = Array.isArray(r.detalles) ? r.detalles : [];
      const totalResultados = (r.totalResultados !== undefined && r.totalResultados !== null)
        ? Number(r.totalResultados) || 0
        : titulos.length;

      contenido.push(
        { text: `Termino: "${String(r.termino || "")}"`, style: "encabezadoNaranja", margin: [0, 0, 0, 10] },
        { text: `Relevancia: ${String(r.relevancia || "")}`, style: "texto" },
        { text: `Parcialmente Relevantes: ${String(r.parcialmenteRelevantes || "")}`, style: "texto" },
        { text: `Elementos Encontrados: ${String(totalResultados)}`, style: "texto" },
        { text: `Calificacion: ${String(r.calificacion || "")}`, style: "texto" },
        { text: `Hay resultados: ${r.hayResultados ? "SI" : "NO"}`, style: "texto", margin: [0, 0, 0, 10] }
      );

      if (titulos.length > 0) {
        const tablaBody = [
          [
            { text: "Producto encontrado", style: "encabezadoNaranja", fillColor: "#ffe6cc", alignment: "center" },
            { text: "Calificacion", style: "encabezadoNaranja", fillColor: "#ffe6cc", alignment: "center" }
          ]
        ];

        const max = Math.min(titulos.length, 20);
        for (let idx = 0; idx < max; idx++) {
          const t = titulos[idx];
          const d = det[idx] || {};
          tablaBody.push([
            { text: String(t || ""), style: "texto", alignment: "left" },
            { text: String(d.calificacion || "Irrelevante"), style: "texto", alignment: "center" }
          ]);
        }

        contenido.push({
          table: { widths: ["80%", "20%"], body: tablaBody },
          layout: "lightHorizontalLines"
        });
      }

      if (i < resultados.length - 1) {
        contenido.push({ text: "", pageBreak: "after" });
      }
    }

    const docDefinition = {
      content: contenido,
      styles: {
        titulo: { fontSize: 16, bold: true, color: "#ff8800", margin: [0, 0, 0, 10] },
        subtitulo: { fontSize: 11, italics: true, color: "#555", margin: [0, 0, 0, 10] },
        texto: { fontSize: 9, margin: [0, 2, 0, 2] },
        textoResumen: { fontSize: 8, margin: [0, 1, 0, 1] },
        encabezadoNaranja: { fontSize: 11, bold: true, color: "#ff8800", margin: [0, 6, 0, 4] }
      },
      defaultStyle: { font: "Roboto" },
      pageMargins: [40, 60, 40, 60]
    };

    const reportDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

    const fechaArchivo = formatearFechaArchivo(new Date(), 'America/Mexico_City');
    const pdfPath = path.join(reportDir, `${obtenerPrefijoSucursalArchivo()}ReporteBusqueda_ResultadosVacios_${fechaArchivo}.pdf`);
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const stream = fs.createWriteStream(pdfPath);
    pdfDoc.pipe(stream);
    pdfDoc.end();

    return new Promise((resolve, reject) => {
      stream.on("finish", () => resolve(pdfPath));
      stream.on("error", reject);
    });
  } catch (err) {
    console.error("Error al generar PDF Resultados Vacios:", err);
    throw err;
  }
}

// ------------------------------------------------------
//  REPORTE C6: BUSQUEDA POR CONTEXTO
// ------------------------------------------------------
async function generarReporteBusquedaContextoPDF({
  nombreTestCase = "C6_BusquedaPorContexto",
  fechaEjecucion = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" }),
  resultados = [],
  modo = "empathy"
}) {
  const esResultadosCombinados =
    resultados &&
    typeof resultados === "object" &&
    !Array.isArray(resultados) &&
    (Array.isArray(resultados.empathy) || Array.isArray(resultados.legacy));

  try {
    if (esResultadosCombinados) {
      const emp = Array.isArray(resultados.empathy) ? resultados.empathy : [];
      const leg = Array.isArray(resultados.legacy) ? resultados.legacy : [];
      if (emp.length === 0 && leg.length === 0) {
        throw new Error("El generador recibio un arreglo vacio.");
      }
    } else if (!Array.isArray(resultados) || resultados.length === 0) {
      throw new Error("El generador recibio un arreglo vacio.");
    }

    const fonts = {
      Roboto: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique"
      }
    };

    const printer = new PdfPrinter(fonts);
    printer.vfs = vfsFonts.vfs;

    const buildSection = (arr, modoLocal) => {
      const resultadosLocal = Array.isArray(arr) ? arr : [];
      const esLegacyLocal = modoLocal === "legacy";
      const titulo = esLegacyLocal ? "Busqueda por Contexto Legacy" : "Busqueda por Contexto Empathy";

      const terminosBuscados = resultadosLocal.length;
      let resultadosObtenidos = 0;
      let resultadosCorrectos = 0;
      let resultadosIncorrectos = 0;
      let totalArticulos = 0;
      let sumaMsHastaPrimer = 0;

      resultadosLocal.forEach((r) => {
        const det = Array.isArray(r.detalles) ? r.detalles : [];
        const total = Number(r.resultadosEncontrados);
        const correctos = Number(r.resultadosCorrectos);
        const incorrectos = Number(r.resultadosIncorrectos);
        const totalArts = Number(r.totalArticulos);
        const msPrimero = Number(r.msHastaPrimerResultado);

        resultadosObtenidos += Number.isFinite(total) ? total : det.length;
        resultadosCorrectos += Number.isFinite(correctos)
          ? correctos
          : det.reduce((acc, d) => acc + (d && d.correcto ? 1 : 0), 0);
        resultadosIncorrectos += Number.isFinite(incorrectos)
          ? incorrectos
          : Math.max(0, det.length - det.reduce((acc, d) => acc + (d && d.correcto ? 1 : 0), 0));

        totalArticulos += Number.isFinite(totalArts) ? totalArts : 0;
        sumaMsHastaPrimer += Number.isFinite(msPrimero) ? msPrimero : 0;
      });

      const pctCorrecto = resultadosObtenidos > 0
        ? Math.round((resultadosCorrectos / resultadosObtenidos) * 10000) / 100
        : 0;

      const tiempoBusquedaPorResultado = totalArticulos > 0
        ? Math.round((sumaMsHastaPrimer / totalArticulos) * 100) / 100
        : 0;

      const contenidoLocal = [];
      contenidoLocal.push(
        { text: titulo, style: "titulo", margin: [0, 0, 0, 10] },
        { text: `Fecha ejecucion: ${fechaEjecucion}`, style: "subtitulo", margin: [0, 0, 0, 10] },
        { text: `Sucursal: ${obtenerNombreSucursalReporte()}`, style: "subtitulo", margin: [0, 0, 0, 6] },
        { text: `Dirección: ${obtenerDireccionSucursalReporte()}`, style: "subtitulo", margin: [0, 0, 0, 10] },
        { text: `Terminos buscados: ${terminosBuscados}`, style: "subtitulo", margin: [0, 0, 0, 6] },
        { text: `Resultados obtenidos: ${resultadosObtenidos}`, style: "subtitulo", margin: [0, 0, 0, 6] },
        { text: `Resultados correctos: ${resultadosCorrectos}`, style: "subtitulo", margin: [0, 0, 0, 6] },
        { text: `Resultados incorrectos: ${resultadosIncorrectos}`, style: "subtitulo", margin: [0, 0, 0, 10] },
        { text: `Porcentaje Correcto = ${pctCorrecto}%`, style: "subtitulo", margin: [0, 0, 0, 6] },
        { text: `Tiempo busqueda por resultado = ${tiempoBusquedaPorResultado} ms`, style: "subtitulo", margin: [0, 0, 0, 10] }
      );

      const resumenBody = [
        [
          { text: "Termino", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" },
          { text: "Resultados", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" },
          { text: "Correctos", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" },
          { text: "Incorrectos", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" }
        ]
      ];

      resultadosLocal.forEach((r) => {
        resumenBody.push([
          { text: String(r.termino || ""), style: "textoResumen", alignment: "left" },
          { text: String(Number(r.resultadosEncontrados) || 0), style: "textoResumen", alignment: "center" },
          { text: String(Number(r.resultadosCorrectos) || 0), style: "textoResumen", alignment: "center" },
          { text: String(Number(r.resultadosIncorrectos) || 0), style: "textoResumen", alignment: "center" }
        ]);
      });

      contenidoLocal.push({ text: "Resumen de terminos", style: "subtitulo", margin: [0, 10, 0, 8] });
      contenidoLocal.push({
        table: { widths: ["55%", "15%", "15%", "15%"], body: resumenBody },
        layout: "lightHorizontalLines"
      });

      contenidoLocal.push({ text: "", pageBreak: "after" });

      for (let i = 0; i < resultadosLocal.length; i++) {
        const r = resultadosLocal[i];
        const det = Array.isArray(r.detalles) ? r.detalles : [];

        const terminoTexto = String(r.termino || "");
        const equivalenciasTexto = String(r.equivalencia || "");

        contenidoLocal.push(
          { text: `Termino: \"${terminoTexto}\"`, style: "encabezadoNaranja", margin: [0, 0, 0, 10] },
          { text: `Equivalencias: ${equivalenciasTexto}`, style: "texto" },
          { text: `Resultados: ${String(Number(r.resultadosEncontrados) || det.length)}`, style: "texto" },
          { text: `Resultados correctos: ${String(Number(r.resultadosCorrectos) || 0)}`, style: "texto" },
          { text: `Resultados incorrectos: ${String(Number(r.resultadosIncorrectos) || 0)}`, style: "texto", margin: [0, 0, 0, 10] }
        );

        if (det.length === 0) {
          contenidoLocal.push({ text: "Sin resultados para evaluar.", style: "texto" });
        } else {
          const tablaBody = [
            [
              { text: "Producto encontrado", style: "encabezadoNaranja", fillColor: "#ffe6cc", alignment: "center" },
              { text: "Resultado", style: "encabezadoNaranja", fillColor: "#ffe6cc", alignment: "center" }
            ]
          ];

          det.forEach((d) => {
            tablaBody.push([
              { text: String(d.titulo || ""), style: "texto", alignment: "left" },
              { text: String(d.resultado || (d.correcto ? "Correcto" : "Incorrecto")), style: "texto", alignment: "center" }
            ]);
          });

          contenidoLocal.push({
            table: { widths: ["85%", "15%"], body: tablaBody },
            layout: "lightHorizontalLines"
          });
        }

        if (i < resultadosLocal.length - 1) {
          contenidoLocal.push({ text: "", pageBreak: "after" });
        }
      }

      return contenidoLocal;
    };

    const contenido = [];
    if (esResultadosCombinados) {
      const emp = Array.isArray(resultados.empathy) ? resultados.empathy : [];
      const leg = Array.isArray(resultados.legacy) ? resultados.legacy : [];

      if (emp.length > 0) contenido.push(...buildSection(emp, "empathy"));
      if (emp.length > 0 && leg.length > 0) contenido.push({ text: "", pageBreak: "after" });
      if (leg.length > 0) contenido.push(...buildSection(leg, "legacy"));
    } else {
      contenido.push(...buildSection(resultados, modo));
    }

    const docDefinition = {
      content: contenido,
      styles: {
        titulo: { fontSize: 18, bold: true, color: "#ff8800", margin: [0, 0, 0, 10] },
        subtitulo: { fontSize: 12, italics: true, color: "#555", margin: [0, 0, 0, 10] },
        texto: { fontSize: 10, margin: [0, 2, 0, 2] },
        textoResumen: { fontSize: 9, margin: [0, 1, 0, 1] },
        encabezadoNaranja: { fontSize: 12, bold: true, color: "#ff8800", margin: [0, 6, 0, 4] }
      },
      defaultStyle: { font: "Roboto" },
      pageMargins: [40, 60, 40, 60]
    };

    const reportDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

    const fechaArchivo = formatearFechaArchivo(new Date(), 'America/Mexico_City');
    const pdfPath = path.join(reportDir, `${obtenerPrefijoSucursalArchivo()}ReporteBusqueda_BusquedaPorContexto_${fechaArchivo}.pdf`);
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const stream = fs.createWriteStream(pdfPath);
    pdfDoc.pipe(stream);
    pdfDoc.end();

    return new Promise((resolve, reject) => {
      stream.on("finish", () => resolve(pdfPath));
      stream.on("error", reject);
    });
  } catch (err) {
    console.error("Error al generar PDF Busqueda por Contexto:", err);
    throw err;
  }
}

// ------------------------------------------------------
//  REPORTE C7: HOTSALE 2026 (POR TAB)
// ------------------------------------------------------
async function generarReporteHotSale2026PDF({
  sheetName = "",
  resultados = { empathy: [], legacy: [] }
}) {
  try {
    const fonts = {
      Roboto: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique"
      }
    };

    const printer = new PdfPrinter(fonts);
    printer.vfs = vfsFonts.vfs;

    const fechaHora = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
    const fechaArchivo = formatearFechaArchivo(new Date(), "America/Mexico_City");

    const reportDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

    const safeSheet = String(sheetName || "").trim();
    const pdfPath = path.join(reportDir, `${safeSheet}_${fechaArchivo}.pdf`);
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

    const buildSection = (resultadosLocal, modoLocal) => {
      const lista = Array.isArray(resultadosLocal) ? resultadosLocal : [];
      const contenidoLocal = [];

      const titulo = `${safeSheet} ${modoLocal === "legacy" ? "Legacy" : "Empathy"}`;
      const totalResultados = lista.reduce((acc, r) => acc + (Number(r.resultadosEncontrados) || 0), 0);
      const totalCorrectos = lista.reduce((acc, r) => acc + (Number(r.resultadosCorrectos) || 0), 0);
      const porcentaje = totalResultados > 0
        ? Math.round(((totalCorrectos / totalResultados) * 100) * 100) / 100
        : 0;

      contenidoLocal.push({ text: titulo, style: "titulo" });
      contenidoLocal.push({ text: `Fecha ejecucion: ${fechaHora}`, style: "subtitulo" });
      contenidoLocal.push({ text: `Sucursal evaluada: ${obtenerSucursalSeleccionada()}`, style: "texto" });
      contenidoLocal.push({ text: `Resultados totales: ${totalResultados}`, style: "texto" });
      contenidoLocal.push({ text: `Resultados correctos: ${totalCorrectos}`, style: "texto" });
      contenidoLocal.push({ text: `Porcentaje correcto: ${porcentaje}%`, style: "texto" });

      const resumenBody = [
        [
          { text: "Termino", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" },
          { text: "Resultados", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" },
          { text: "Correctos", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" },
          { text: "Porcentaje", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" }
        ]
      ];

      lista.forEach((r) => {
        const term = String(r.termino || "");
        const res = Number(r.resultadosEncontrados) || 0;
        const cor = Number(r.resultadosCorrectos) || 0;
        const pct = res > 0 ? Math.round(((cor / res) * 100) * 100) / 100 : 0;
        resumenBody.push([
          { text: term, style: "textoResumen", alignment: "left" },
          { text: String(res), style: "textoResumen", alignment: "center" },
          { text: String(cor), style: "textoResumen", alignment: "center" },
          { text: `${pct}%`, style: "textoResumen", alignment: "center" }
        ]);
      });

      contenidoLocal.push({ text: "Resumen de terminos", style: "subtitulo", margin: [0, 10, 0, 8] });
      contenidoLocal.push({
        table: { widths: ["55%", "15%", "15%", "15%"], body: resumenBody },
        layout: "lightHorizontalLines"
      });

      contenidoLocal.push({ text: "", pageBreak: "after" });

      for (let i = 0; i < lista.length; i++) {
        const r = lista[i] || {};
        const det = Array.isArray(r.detalles) ? r.detalles : [];

        const terminoTexto = String(r.termino || "");
        const equivalentesTexto = String(r.equivalentes || "");
        const resultadosEncontrados = Number(r.resultadosEncontrados) || det.length || 0;
        const resultadosCorrectos = Number(r.resultadosCorrectos) || 0;
        const pct = resultadosEncontrados > 0
          ? Math.round(((resultadosCorrectos / resultadosEncontrados) * 100) * 100) / 100
          : 0;

        contenidoLocal.push(
          { text: `Termino: \"${terminoTexto}\"`, style: "encabezadoNaranja", margin: [0, 0, 0, 10] },
          { text: `Equivalentes: ${equivalentesTexto}`, style: "texto" },
          { text: `Resultados: ${resultadosEncontrados}`, style: "texto" },
          { text: `Resultados correctos: ${resultadosCorrectos}`, style: "texto" },
          { text: `Porcentaje correcto: ${pct}%`, style: "texto", margin: [0, 0, 0, 10] }
        );

        if (det.length === 0) {
          contenidoLocal.push({ text: "Sin resultados para evaluar.", style: "texto" });
        } else {
          const tablaBody = [
            [
              { text: "Resultados", style: "encabezadoNaranja", fillColor: "#ffe6cc", alignment: "center" },
              { text: "Resultado", style: "encabezadoNaranja", fillColor: "#ffe6cc", alignment: "center" }
            ]
          ];

          det.forEach((d) => {
            tablaBody.push([
              { text: String(d.titulo || ""), style: "texto", alignment: "left" },
              { text: String(d.resultado || (d.correcto ? "Correcto" : "Incorrecto")), style: "texto", alignment: "center" }
            ]);
          });

          contenidoLocal.push({
            table: { widths: ["85%", "15%"], body: tablaBody },
            layout: "lightHorizontalLines"
          });
        }

        if (i < lista.length - 1) {
          contenidoLocal.push({ text: "", pageBreak: "after" });
        }
      }

      return contenidoLocal;
    };

    const contenido = [];
    const emp = Array.isArray(resultados.empathy) ? resultados.empathy : [];
    const leg = Array.isArray(resultados.legacy) ? resultados.legacy : [];

    if (emp.length > 0) contenido.push(...buildSection(emp, "empathy"));
    if (emp.length > 0 && leg.length > 0) contenido.push({ text: "", pageBreak: "after" });
    if (leg.length > 0) contenido.push(...buildSection(leg, "legacy"));

    const docDefinition = {
      content: contenido,
      styles: {
        titulo: { fontSize: 18, bold: true, color: "#ff8800", margin: [0, 0, 0, 10] },
        subtitulo: { fontSize: 12, italics: true, color: "#555", margin: [0, 0, 0, 10] },
        texto: { fontSize: 10, margin: [0, 2, 0, 2] },
        textoResumen: { fontSize: 9, margin: [0, 1, 0, 1] },
        encabezadoNaranja: { fontSize: 12, bold: true, color: "#ff8800", margin: [0, 6, 0, 4] }
      },
      defaultStyle: { font: "Roboto" },
      pageMargins: [40, 60, 40, 60]
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const stream = fs.createWriteStream(pdfPath);
    pdfDoc.pipe(stream);
    pdfDoc.end();

    return new Promise((resolve, reject) => {
      stream.on("finish", () => resolve(pdfPath));
      stream.on("error", reject);
    });
  } catch (err) {
    console.error("Error al generar PDF HotSale 2026:", err);
    throw err;
  }
}

module.exports = {
  generarReportePDF,
  generarReporteCoincidenciasPDF,
  generarReporteFrecuenciaAltaPDF,
  generarReporteLongTailPDF,
  generarReporteResultadosVaciosPDF,
  generarReporteBusquedaContextoPDF,
  generarReporteHotSale2026PDF
};
