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
//  BUSCAR SUCURSAL POR DIRECCIÓN
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
    //  CARPETA ÚNICA DE REPORTES
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
    // CONTENIDO DEL PDF (todo tu código igual)
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

      // ENCABEZADOS → ahora muestran la fecha real del scrapeo
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
    // CREACIÓN DEL PDF
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
        console.log(`📄 PDF generado: ${pdfPath}`);
        console.log(`📄 XML generado: ${xmlPath}`);
        resolve(pdfPath);
      });
      stream.on('error', reject);
    });

  } catch (err) {
    console.error('❌ Error al generar PDF:', err);
    throw err;
  }
}


// ------------------------------------------------------
//  ⚡ NUEVO: REPORTE DE COINCIDENCIAS (C1, C2, C3, C4)
// ------------------------------------------------------
async function generarReporteCoincidenciasPDF({
  nombreTestCase = "TestCase",
  fechaEjecucion = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" }),
  resultados = [],
  modo = "empathy"
}) {
  const esLegacy = modo === "legacy";
  try {
    // ---------------------------
    //  ADAPTADOR DE DATOS
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

    const resultadosAdaptados = resultados.map(r => {
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
    const legacyStats = resultadosAdaptados.map(t => {
      const total = t.listaDetallada.length;
      const correctos = t.listaDetallada.filter(x => x.correccion || x.equivalencia).length;
      const incorrectos = total - correctos;
      return { total, correctos, incorrectos };
    });
    const legacySinErrores = legacyStats.filter(s => s.total > 0 && s.incorrectos === 0).length;
    const legacyParcial = legacyStats.filter(s => s.total > 0 && s.correctos > 0 && s.incorrectos > 0).length;
    const legacyFallidos = legacyStats.filter(s => s.total === 0 || s.correctos === 0).length;

    // ---------------------------
    // CONFIG PDF
    // ---------------------------
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

    const contenido = [];

    // ---------------------------
    // RESUMEN GENERAL
    // ---------------------------
    contenido.push(
      { text: esLegacy ? "Reporte Errores Ortograficos Legacy" : "Reporte Errores Ortograficos Empathy", style: "titulo", margin: [0, 0, 0, 10] },
      { text: `Fecha ejecucion: ${fechaEjecucion}`, style: "subtitulo", margin: [0, 0, 0, 10] },
      { text: `Sucursal evaluada: ${Object.keys(config.RecogerEnDirecciones || {})[0] || "Por definir"}`, style: "subtitulo", margin: [0, 0, 0, 10] },
      { text: `Terminos buscados: ${totalEvaluados}`, style: "subtitulo", margin: [0, 0, 0, 10] }
    );

    if (tieneCalificacion) {
      contenido.push(
        { text: `CC: ${metricas.CC}`, style: "subtitulo" },
        { text: `CP: ${metricas.CP}`, style: "subtitulo" },
        { text: `SR: ${metricas.SR}`, style: "subtitulo" },
        { text: `SN: ${metricas.SN}`, style: "subtitulo" },
        { text: "\n" }
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
        { text: "SN: No hay correccion ni equivalencias, o no hay resultados.", style: "textoDef" }
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
      const correccionEsperadaTexto = termino.ccProductos === totalEncontrados && totalEncontrados > 0 ? "Si" : "No";

      contenido.push(
        { text: `Busqueda: ${termino.termino}`, style: "texto" },
        { text: `Correccion: ${correccionTexto}`, style: "texto" },
        { text: `Equivalencias: ${equivalenciasTexto}`, style: "texto" },
        { text: `Resultados encontrados: ${totalEncontrados}`, style: "texto" }
      );
      if (!esLegacy) {
        contenido.push(
          { text: `Correccion esperada: ${correccionEsperadaTexto}`, style: "texto" },
          { text: `Calificacion busqueda: ${calificacionTexto}`, style: "texto", margin: [0, 0, 0, 10] }
        );
      } else {
        contenido.push({ text: "", style: "texto", margin: [0, 0, 0, 10] });
      }
      if (esLegacy) {
        const totalLegacy = termino.listaDetallada.length;
        const correctosLegacy = termino.listaDetallada.filter(x => x.correccion || x.equivalencia).length;
        const incorrectosLegacy = totalLegacy - correctosLegacy;
        contenido.push({ text: `Correctos: ${correctosLegacy} | Incorrectos: ${incorrectosLegacy}`, style: "texto" });
      }

      const total = termino.listaDetallada.length;
      const totalCoinc = termino.listaDetallada.filter(x => x.coincide).length;


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
        tablaBody.push([
          { text: row.texto, style: "texto", alignment: "left" },
          row.correccion
            ? { text: "Correccion", alignment: "center", color: "green", fontSize: 11 }
            : row.equivalencia
              ? { text: "Equivalencia", alignment: "center", color: "#ff9900", fontSize: 11 }
              : { text: "Incorrecto", alignment: "center", color: "red", fontSize: 11 }
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

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const pdfPath = path.join(reportDir, `reporteCoincidencias_${nombreTestCase}_${ts}.pdf`);
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
    const sumaProm = resultados.reduce((acc, r) => acc + (Number(r.calificacionPromedio) || 0), 0);
    const promBusqueda = terminosEvaluados > 0 ? Math.round((sumaProm / terminosEvaluados) * 100) / 100 : 0;

    // Promedio global ponderado por resultados (no por terminos).
    let totalResultados = 0;
    let sumaCalificaciones = 0;
    resultados.forEach((r) => {
      const det = Array.isArray(r.detalles) ? r.detalles : [];
      totalResultados += det.length;
      sumaCalificaciones += det.reduce((acc, d) => acc + (Number(d.calificacion) || 0), 0);
    });
    const promPorResultado = totalResultados > 0
      ? Math.round((sumaCalificaciones / totalResultados) * 100) / 100
      : 0;

    const titulo = esLegacy ? "Frecuencia Alta Legacy" : "Frecuencia Alta Empathy";

    const contenido = [];
    contenido.push(
      { text: titulo, style: "titulo", margin: [0, 0, 0, 10] },
      { text: `Fecha ejecucion: ${fechaEjecucion}`, style: "subtitulo", margin: [0, 0, 0, 10] },
      { text: `Calificacion promedio busqueda: ${promBusqueda}`, style: "subtitulo", margin: [0, 0, 0, 6] },
      { text: `Calificacion promedio por resultado: ${promPorResultado}`, style: "subtitulo", margin: [0, 0, 0, 6] },
      { text: `Terminos evaluados: ${terminosEvaluados}`, style: "subtitulo", margin: [0, 0, 0, 10] }
    );

    const resumenBody = [
      [
        { text: "Termino", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" },
        { text: "Calificacion Promedio", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" },
        { text: "Resultados Evaluados", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" }
      ]
    ];

    resultados.forEach((r) => {
      const det = Array.isArray(r.detalles) ? r.detalles : [];
      resumenBody.push([
        { text: String(r.termino || ""), style: "textoResumen", alignment: "left" },
        { text: String(Number(r.calificacionPromedio) || 0), style: "textoResumen", alignment: "center" },
        { text: String(det.length), style: "textoResumen", alignment: "center" }
      ]);
    });

    contenido.push({ text: "Resumen de terminos", style: "subtitulo", margin: [0, 10, 0, 8] });
    contenido.push({
      table: { widths: ["55%", "25%", "20%"], body: resumenBody },
      layout: "lightHorizontalLines"
    });

    contenido.push({ text: "", pageBreak: "after" });

    // Detalle por termino
    for (let i = 0; i < resultados.length; i++) {
      const r = resultados[i];
      const det = Array.isArray(r.detalles) ? r.detalles : [];

      contenido.push(
        { text: `Termino: \"${String(r.termino || "")}\"`, style: "encabezadoNaranja", margin: [0, 0, 0, 10] },
        { text: `Calificacion Promedio: ${String(Number(r.calificacionPromedio) || 0)}`, style: "texto" },
        { text: `Categoria: ${String(r.categoriaYAttr || "")}`, style: "texto" },
        { text: `Marca: ${String(r.marca || "")}`, style: "texto" },
        { text: `Atributo: ${String(r.attrSecundario || "")}`, style: "texto" },
        { text: `Mismo universo: ${String(r.intencionDiferente || "")}`, style: "texto" },
        { text: `Hay resultados: ${r.hayResultados ? "SI" : "NO"}`, style: "texto", margin: [0, 0, 0, 10] }
      );

      if (!r.hayResultados || det.length === 0) {
        contenido.push({ text: "Busqueda sin resultados para evaluar.", style: "texto" });
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

        contenido.push({
          table: { widths: ["85%", "15%"], body: tablaBody },
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

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const pdfPath = path.join(reportDir, `reporteFrecuenciaAlta_${nombreTestCase}_${ts}.pdf`);
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
    const sumaProm = resultados.reduce((acc, r) => acc + (Number(r.calificacionPromedio) || 0), 0);
    const promBusqueda = terminosEvaluados > 0 ? Math.round((sumaProm / terminosEvaluados) * 100) / 100 : 0;

    // Promedio global ponderado por resultados (no por terminos).
    let totalResultados = 0;
    let sumaCalificaciones = 0;
    resultados.forEach((r) => {
      const det = Array.isArray(r.detalles) ? r.detalles : [];
      totalResultados += det.length;
      sumaCalificaciones += det.reduce((acc, d) => acc + (Number(d.calificacion) || 0), 0);
    });
    const promPorResultado = totalResultados > 0
      ? Math.round((sumaCalificaciones / totalResultados) * 100) / 100
      : 0;

    const titulo = esLegacy ? "Long Tail Legacy" : "Long Tail Empathy";

    const contenido = [];
    contenido.push(
      { text: titulo, style: "titulo", margin: [0, 0, 0, 10] },
      { text: `Fecha ejecucion: ${fechaEjecucion}`, style: "subtitulo", margin: [0, 0, 0, 10] },
      { text: `Calificacion promedio busqueda: ${promBusqueda}`, style: "subtitulo", margin: [0, 0, 0, 6] },
      { text: `Calificacion promedio por resultado: ${promPorResultado}`, style: "subtitulo", margin: [0, 0, 0, 6] },
      { text: `Terminos evaluados: ${terminosEvaluados}`, style: "subtitulo", margin: [0, 0, 0, 10] }
    );

    const resumenBody = [
      [
        { text: "Termino", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" },
        { text: "Calificacion Promedio", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" },
        { text: "Resultados Evaluados", style: "encabezadoNaranja", alignment: "center", fillColor: "#ffe6cc" }
      ]
    ];

    resultados.forEach((r) => {
      const det = Array.isArray(r.detalles) ? r.detalles : [];
      resumenBody.push([
        { text: String(r.termino || ""), style: "textoResumen", alignment: "left" },
        { text: String(Number(r.calificacionPromedio) || 0), style: "textoResumen", alignment: "center" },
        { text: String(det.length), style: "textoResumen", alignment: "center" }
      ]);
    });

    contenido.push({ text: "Resumen de terminos", style: "subtitulo", margin: [0, 10, 0, 8] });
    contenido.push({
      table: { widths: ["55%", "25%", "20%"], body: resumenBody },
      layout: "lightHorizontalLines"
    });

    contenido.push({ text: "", pageBreak: "after" });

    // Detalle por termino
    for (let i = 0; i < resultados.length; i++) {
      const r = resultados[i];
      const det = Array.isArray(r.detalles) ? r.detalles : [];

      contenido.push(
        { text: `Termino: \"${String(r.termino || "")}\"`, style: "encabezadoNaranja", margin: [0, 0, 0, 10] },
        { text: `Calificacion Promedio: ${String(Number(r.calificacionPromedio) || 0)}`, style: "texto" },
        { text: `Categoria: ${String(r.categoria || "")}`, style: "texto" },
        { text: `Marca: ${String(r.marca || "")}`, style: "texto" },
        { text: `Especificacion: ${String(r.especificacion || "")}`, style: "texto" },
        { text: `Formato: ${String(r.formato || "")}`, style: "texto" },
        { text: `Intencion: ${String(r.intencion || "")}`, style: "texto" },
        { text: `Hay resultados: ${r.hayResultados ? "SI" : "NO"}`, style: "texto", margin: [0, 0, 0, 10] }
      );

      if (!r.hayResultados || det.length === 0) {
        contenido.push({ text: "Busqueda sin resultados para evaluar.", style: "texto" });
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

        contenido.push({
          table: { widths: ["85%", "15%"], body: tablaBody },
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

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const pdfPath = path.join(reportDir, `reporteLongTail_${nombreTestCase}_${ts}.pdf`);
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

module.exports = {
  generarReportePDF,
  generarReporteCoincidenciasPDF,
  generarReporteFrecuenciaAltaPDF,
  generarReporteLongTailPDF
};
