// ============================================================================
// URL GOOGLE APPS SCRIPT
// ============================================================================
const API_URL = "https://script.google.com/macros/s/AKfycbwW3mbb6T8qsxc0hBEJwjraG2cBX-8mmkkfdBvzXn_Mdb7MFUXjh61VUOHCzfQLk60X/exec";

let correoActivo = null;
let candidatas = [];

const formCorreo = document.getElementById("form-correo");
const inputCorreo = document.getElementById("input-correo");
const mensajeEstado = document.getElementById("mensaje-estado");
const indicadorVoto = document.getElementById("indicador-voto");

// ============================================================================
// 1. CARGAR CANDIDATAS Y RESULTADOS DESDE GOOGLE SHEETS
// ============================================================================
async function cargarDatosDesdeServidor() {
  try {
    const respuesta = await fetch(`${API_URL}?accion=inicializar`);
    const datos = await respuesta.json();
    if (datos.ok) {
      candidatas = datos.candidatas;
      actualizarUI();
    }
  } catch (error) {
    console.error("Error conectando con la base de datos:", error);
  }
}

// ============================================================================
// 2. VERIFICAR CORREO EN TIEMPO REAL
// ============================================================================
formCorreo.addEventListener("submit", async (e) => {
  e.preventDefault();
  const correoIngresado = inputCorreo.value.trim().toLowerCase();
  const botonSubmit = formCorreo.querySelector("button");

  botonSubmit.disabled = true;
  botonSubmit.textContent = "Verificando...";

  try {
    const respuesta = await fetch(
      `${API_URL}?accion=verificar&correo=${encodeURIComponent(correoIngresado)}`
    );
    const resultado = await respuesta.json();

    if (resultado.ok) {
      correoActivo = correoIngresado;
      mostrarMensaje("Correo verificado. Selecciona a tu candidata.", "exito");
    } else if (resultado.motivo === "YA_VOTO") {
      correoActivo = null;
      mostrarMensaje("Voto bloqueado: Este correo ya emitió su voto.", "advertencia");
    } else {
      correoActivo = null;
      mostrarMensaje("Acceso denegado: Correo no registrado en la lista.", "error");
    }
  } catch (error) {
    mostrarMensaje("Error de conexión. Intenta nuevamente.", "error");
  } finally {
    botonSubmit.disabled = false;
    botonSubmit.textContent = "Verificar Correo";
    actualizarUI();
  }
});

// ============================================================================
// 3. EMITIR VOTO HACIA LA BASE DE DATOS
// ============================================================================
async function emitirVoto(idCandidata) {
  if (!correoActivo) return;

  const candidataElegida = candidatas.find((c) => c.id === idCandidata);
  if (!candidataElegida) return;

  const confirmar = confirm(
    `¿Confirmas tu voto único por ${candidataElegida.nombre}?\nEsta acción no se puede deshacer.`
  );
  if (!confirmar) return;

  // Bloquear botones mientras se guarda en Google Sheets
  const correoParaVotar = correoActivo;
  correoActivo = null;
  actualizarUI();
  mostrarMensaje("Registrando voto en la base de datos...", "exito");

  try {
    // Se envía como text/plain para evitar bloqueos CORS del navegador con Google Apps Script
    const respuesta = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        correo: correoParaVotar,
        idCandidata: idCandidata
      })
    });

    const resultado = await respuesta.json();

    if (resultado.ok) {
      document.getElementById("comprobante-candidata").textContent =
        `Candidata: ${candidataElegida.nombre} (${candidataElegida.grado})`;
      document.getElementById("comprobante-correo").textContent =
        `Votante registrado: ${correoParaVotar}`;
      document.getElementById("comprobante-codigo").textContent = resultado.codigo;
      document.getElementById("seccion-comprobante").classList.remove("hidden");

      inputCorreo.value = "";
      mostrarMensaje("¡Voto registrado exitosamente!", "exito");
      await cargarDatosDesdeServidor(); // Refresca los conteos reales
    } else {
      mostrarMensaje(resultado.mensaje || "No se pudo registrar el voto.", "error");
    }
  } catch (error) {
    mostrarMensaje("Error de red al guardar el voto.", "error");
  }
}

// ============================================================================
// 4. INTERFAZ VISUAL
// ============================================================================
function mostrarMensaje(texto, tipo) {
  mensajeEstado.textContent = texto;
  mensajeEstado.className = "mt-4 p-3 rounded-lg text-sm font-medium block ";
  if (tipo === "error") {
    mensajeEstado.className += "bg-red-100 text-crimson border border-red-300";
  } else if (tipo === "advertencia") {
    mensajeEstado.className += "bg-amber-100 text-amber-900 border border-amber-300";
  } else {
    mensajeEstado.className += "bg-emerald-100 text-emerald-900 border border-emerald-300";
  }
}

function renderizarCandidatas() {
  const contenedor = document.getElementById("contenedor-candidatas");
  contenedor.innerHTML = "";

  candidatas.forEach((candidata) => {
    const tarjeta = document.createElement("div");
    tarjeta.className =
      "bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between transition hover:border-[#0B669E]";

    const botonHabilitado = correoActivo !== null;

    tarjeta.innerHTML = `
      <div>
        <div class="flex items-center justify-between gap-2 mb-2">
          <span class="text-xs font-bold uppercase tracking-wider bg-navy text-gold px-2.5 py-1 rounded">
            Candidata #${candidata.id}
          </span>
          <span class="text-xs font-semibold text-shield-blue">
            ${candidata.grado}
          </span>
        </div>
        <h3 class="text-xl font-bold text-navy mt-1">${candidata.nombre}</h3>
        <p class="text-sm text-slate-600 mt-2 leading-relaxed">
          ${candidata.descripcion}
        </p>
      </div>

      <button
        onclick="emitirVoto(${candidata.id})"
        ${botonHabilitado ? "" : "disabled"}
        class="mt-5 w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition ${
          botonHabilitado
            ? "bg-shield-blue hover:bg-navy text-white cursor-pointer shadow-sm"
            : "bg-slate-200 text-slate-400 cursor-not-allowed"
        }"
      >
        ${botonHabilitado ? `Votar por ${candidata.nombre}` : "Verifica tu correo para votar"}
      </button>
    `;
    contenedor.appendChild(tarjeta);
  });
}

function renderizarResultados() {
  const contenedor = document.getElementById("contenedor-resultados");
  const totalSpan = document.getElementById("total-votos");
  contenedor.innerHTML = "";

  const totalVotos = candidatas.reduce((acc, c) => acc + (c.votos || 0), 0);
  totalSpan.textContent = `Total: ${totalVotos} ${totalVotos === 1 ? "voto" : "votos"}`;

  candidatas.forEach((candidata) => {
    const votos = candidata.votos || 0;
    const porcentaje = totalVotos > 0 ? Math.round((votos / totalVotos) * 100) : 0;

    const fila = document.createElement("div");
    fila.innerHTML = `
      <div class="flex justify-between text-sm font-semibold mb-1">
        <span class="text-navy">${candidata.nombre}</span>
        <span class="text-slate-600">${votos} votos (${porcentaje}%)</span>
      </div>
      <div class="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
        <div
          class="bg-shield-blue h-3 rounded-full transition-all duration-500"
          style="width: ${porcentaje}%"
        ></div>
      </div>
    `;
    contenedor.appendChild(fila);
  });
}

function actualizarUI() {
  if (correoActivo) {
    indicadorVoto.textContent = `Votando como: ${correoActivo}`;
    indicadorVoto.className = "text-xs font-bold px-3 py-1 rounded-full bg-gold text-navy";
  } else {
    indicadorVoto.textContent = "Verifica tu correo para votar";
    indicadorVoto.className = "text-xs font-semibold px-3 py-1 rounded-full bg-slate-200 text-slate-600";
  }
  renderizarCandidatas();
  renderizarResultados();
}

// ============================================================================
// 5. DESPLEGAR / OCULTAR LISTA DE CANDIDATAS
// ============================================================================
const btnToggleCandidatas = document.getElementById("btn-toggle-candidatas");
const contenedorCandidatas = document.getElementById("contenedor-candidatas");
const iconoToggle = document.getElementById("icono-toggle-candidatas");
const textoToggle = document.getElementById("texto-toggle-candidatas");

function alternarCandidatas(forzarMostrar = null) {
  const estaOculto = contenedorCandidatas.classList.contains("hidden");
  const mostrar = forzarMostrar !== null ? forzarMostrar : estaOculto;

  if (mostrar) {
    contenedorCandidatas.classList.remove("hidden");
    contenedorCandidatas.classList.add("grid");
    iconoToggle.classList.remove("-rotate-90");
    textoToggle.textContent = "Ocultar";
    btnToggleCandidatas.setAttribute("aria-expanded", "true");
  } else {
    contenedorCandidatas.classList.add("hidden");
    contenedorCandidatas.classList.remove("grid");
    iconoToggle.classList.add("-rotate-90");
    textoToggle.textContent = "Mostrar";
    btnToggleCandidatas.setAttribute("aria-expanded", "false");
  }
}

btnToggleCandidatas.addEventListener("click", () => alternarCandidatas());

// Despliega automáticamente las candidatas al verificar un correo válido
const actualizarUIOriginal = actualizarUI;
actualizarUI = function () {
  actualizarUIOriginal();
  if (correoActivo) {
    alternarCandidatas(true);
  }
};

// Iniciar cargando datos reales
cargarDatosDesdeServidor();
